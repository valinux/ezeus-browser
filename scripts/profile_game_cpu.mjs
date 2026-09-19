// Bounded macOS integration benchmark. Owns and closes its browser and server.
// Run from the repository root: node scripts/profile_game_cpu.mjs baseline
// Add --software only to reproduce the old CPU-only test renderer.
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const label = (process.argv[2] || 'current').replace(/[^a-zA-Z0-9_-]/g, '_');
const software = process.argv.includes('--software');
const headless = process.argv.includes('--headless');
const layoutOnly = process.argv.includes('--layout-only');
const menuOnly = process.argv.includes('--menu-only');
const debug = 9348, port = 8788;
const browserPath = process.env.EZEUS_BROWSER || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
await fs.mkdir('logs', {recursive:true});
const profileDirectory = await fs.mkdtemp(join(tmpdir(), 'ezeus-cpu-run-'));
const report = {label, date: new Date().toISOString(), softwareRequested: software, headless, phases: []};
const processes = [], connections = [];
let browser, server, cleaned = false;
function processRows() {
  return execFileSync('ps', ['-axo', 'pid=,ppid=,time='], {encoding:'utf8'}).trim().split('\n').map(line => {
    const [pid, ppid, time] = line.trim().split(/\s+/);
    return {pid:+pid, ppid:+ppid, seconds:time.split(':').reduce((total, part)=>total*60+Number(part),0)};
  });
}
function tree(rows, root) {
  const ids = new Set([root]);
  for(let changed=true; changed;) {
    changed=false;
    for(const p of rows)if(ids.has(p.ppid) && !ids.has(p.pid)){ids.add(p.pid);changed=true;}
  }
  return rows.filter(p=>ids.has(p.pid));
}
function snapshot() {
  const rows = processRows();
  return {time:performance.now(), browser:tree(rows,browser.pid), server:tree(rows,server.pid)};
}
function usage(before, after, kind) {
  const old = new Map(before[kind].map(p=>[p.pid,p.seconds]));
  const seconds = after[kind].reduce((sum,p)=>sum+Math.max(0,p.seconds-(old.get(p.pid)||0)),0);
  return +(100*seconds/((after.time-before.time)/1000)).toFixed(1);
}
function cleanup() {
  if(cleaned)return;
  cleaned=true;
  for(const c of connections)c.ws.close();
  // Only descendants of the processes launched by this script.
  const rows = processRows();
  for(const child of processes) {
    for(const p of tree(rows,child.pid).reverse()) {
      try{process.kill(p.pid,'SIGTERM');}catch{}
    }
  }
}
const watchdog = setTimeout(()=>{
  console.error('Benchmark exceeded its 180 second limit; stopping owned processes.');
  cleanup();process.exit(2);
},180000);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{cleanup();process.exit(130);});

async function jsonWhenReady(url) {
  for(let i=0;i<100;i++) {
    try {return await (await fetch(url)).json();} catch {await delay(100);}
  }
  throw Error('Timed out waiting for '+url);
}
async function connect(url) {
  const ws=new WebSocket(url), pending=new Map();let seq=0;
  await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
  ws.onmessage=({data})=>{
    const m=JSON.parse(data);
    if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(JSON.stringify(m.error))):p?.resolve(m.result);}
    if(m.method==='Runtime.exceptionThrown')(report.exceptions||=[]).push(m.params.exceptionDetails);
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async (expression,userGesture=false)=>{
    const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture});
    if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const c={ws,send,evaluate};connections.push(c);return c;
}

async function resizeAndCheck(c, width, height, deviceScaleFactor = 1) {
  await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor,mobile:false});
  const scale=Math.max(720/height,800/width);
  let state;
  for(let attempt=0;attempt<30;attempt++) {
    await delay(100);
    state=await c.evaluate('({rect:Module.canvas.getBoundingClientRect().toJSON(),canvas:{width:Module.canvas.width,height:Module.canvas.height},viewport:Module.browserViewport,performance:Module.gamePerformance,scrollWidth:document.body.scrollWidth,scrollHeight:document.body.scrollHeight})');
    if(state.performance.width===Math.round(width*scale) && state.performance.height===Math.round(height*scale) && state.canvas.width===state.viewport.width && state.canvas.height===state.viewport.height)break;
  }
  if(state.rect.x!==0 || state.rect.y!==0 || state.rect.width!==width || state.rect.height!==height || state.scrollWidth!==width || state.scrollHeight!==height)throw Error('The game does not fill the browser viewport.');
  if(state.canvas.width!==Math.round(width*scale) || state.canvas.height!==Math.round(height*scale) || state.performance.width!==state.canvas.width || state.performance.height!==state.canvas.height)throw Error('The engine resolution did not follow the browser viewport.');
  return {window:{width,height,deviceScaleFactor},...state};
}

try {
  const serverLog=await fs.open(`logs/cpu-${label}-server.log`,'w');
  report.engineBuild=process.argv.includes('--baseline-engine')?'browser-before-cpu-fix':'browser';
  server=spawn('/usr/bin/nice',['-n','10','python3','scripts/serve_dev.py','--port',String(port),'--engine-build',report.engineBuild],{stdio:['ignore',serverLog.fd,serverLog.fd]});
  processes.push(server);
  await jsonWhenReady(`http://127.0.0.1:${port}/asset-index.json`);
  const browserLog=await fs.open(`logs/cpu-${label}-browser.log`,'w');
  const args=['--no-first-run','--no-default-browser-check','--disable-background-networking',
    '--disable-component-update','--disable-sync','--disable-extensions',`--remote-debugging-port=${debug}`,
    '--remote-debugging-address=127.0.0.1',`--user-data-dir=${profileDirectory}`,
    '--window-size=1400,1100',...(headless?['--headless=new']:[]),
    ...(software?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]),'about:blank'];
  browser=spawn('/usr/bin/nice',['-n','10',browserPath,...args],{stdio:['ignore',browserLog.fd,browserLog.fd]});
  processes.push(browser);
  const version=await jsonWhenReady(`http://127.0.0.1:${debug}/json/version`);
  const browserCDP=await connect(version.webSocketDebuggerUrl);
  report.gpu=await browserCDP.send('SystemInfo.getInfo');
  console.log('GPU:',JSON.stringify(report.gpu.gpu.devices));
  if(process.argv.includes('--gpu-only')){
    report.gpuOnly=true;
  }else if(process.argv.includes('--client-only')){
    const page=await(await fetch(`http://127.0.0.1:${debug}/json/new?about:blank`,{method:'PUT'})).json();
    const c=await connect(page.webSocketDebuggerUrl);
    await c.send('Runtime.enable');await c.send('Page.enable');
    await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
    const {windowId}=await browserCDP.send('Browser.getWindowForTarget',{targetId:page.id});
    await browserCDP.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'minimized'}});
    await c.send('Page.navigate',{url:`http://127.0.0.1:${port}/`});
    await delay(2000);
    report.hiddenStartup=await c.evaluate('({hidden:document.hidden,files:window.eZeusPrototype?.filesLoaded,engineRequested:Array.from(document.scripts).some(s=>s.src.endsWith("/engine/eZeus.js"))})');
    if(!report.hiddenStartup.hidden || report.hiddenStartup.files!==0 || report.hiddenStartup.engineRequested)throw Error('A hidden client started heavy loading.');
    await browserCDP.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});
    await c.send('Page.bringToFront');
    report.automaticStarts=[];
    report.loadingSamples=[];
    for(let round=0;round<2;round++){
      const before=snapshot();
      if(round){await c.evaluate('eZeusPrototype.firstFrame=false');await c.send('Page.reload');}
      for(let i=0;i<600;i++){
        const state=await c.evaluate('({...window.eZeusPrototype,loader:document.querySelector("#loading")?{hidden:document.querySelector("#loading").hidden,title:document.querySelector("#loading-title").textContent,percent:document.querySelector("#loading-percent").textContent,detail:document.querySelector("#loading-detail").textContent,value:document.querySelector("#loading-progress").value}:null})');
        if(state?.phase==='failed')throw Error(JSON.stringify(state));
        if(state?.phase==='assets' && state.totalBytes) {
          report.loadingSamples.push({round,files:state.filesLoaded,bytes:state.bytesLoaded,totalBytes:state.totalBytes,loader:state.loader});
          if(state.loader.hidden)throw Error('Loading progress is hidden while assets load.');
          if(!round && !report.loadingScreenshot && state.loadProgress>0.2 && state.loadProgress<0.9) {
            const shot=await c.send('Page.captureScreenshot',{format:'png'});
            await fs.writeFile(`logs/cpu-${label}-loading.png`,Buffer.from(shot.data,'base64'));
            report.loadingScreenshot=true;
          }
        }
        if(state?.firstFrame)break;
        if(i===599)throw Error('Automatic startup timed out');
        await delay(100);
      }
      const after=snapshot();
      await delay(4000);
      const state=await c.evaluate('({phase:eZeusPrototype.phase,errors:eZeusPrototype.errors,files:eZeusPrototype.filesLoaded,bytes:eZeusPrototype.bytesLoaded,totalBytes:eZeusPrototype.totalBytes,totalFiles:eZeusPrototype.totalFiles,loaderHidden:document.querySelector("#loading").hidden,text:document.body.innerText,rect:Module.canvas.getBoundingClientRect().toJSON()})');
      if(state.phase!=='running' || state.text.trim() || state.errors.length || !state.loaderHidden || state.bytes!==state.totalBytes || state.files!==state.totalFiles)throw Error('Client presentation or startup failed.');
      report.automaticStarts.push({...state,seconds:+((after.time-before.time)/1000).toFixed(2),browserCPU:usage(before,after,'browser'),serverCPU:usage(before,after,'server')});
      console.log(JSON.stringify(report.automaticStarts.at(-1)));
    }
    const shot=await c.send('Page.captureScreenshot',{format:'png'});
    await fs.writeFile(`logs/cpu-${label}-client.png`,Buffer.from(shot.data,'base64'));
    report.resized=await resizeAndCheck(c,1024,768);
    report.retina=await resizeAndCheck(c,1920,1080,2);
    if(report.loadingSamples.length<2)throw Error('No intermediate loading progress was observed.');
    report.progressWithinFile=false;
    for(let i=1;i<report.loadingSamples.length;i++) {
      const a=report.loadingSamples[i-1],b=report.loadingSamples[i];
      if(a.round!==b.round)continue;
      if(b.bytes<a.bytes || b.loader.value<a.loader.value)throw Error('Loading progress went backwards.');
      if(a.files===b.files && b.bytes>a.bytes)report.progressWithinFile=true;
    }
    if(!report.progressWithinFile)throw Error('No streaming progress within a large asset was observed.');
    if(report.exceptions?.length)throw Error('Client runtime errors');
  }else {
    const startup=snapshot();
    const page=await(await fetch(`http://127.0.0.1:${debug}/json/new?http://127.0.0.1:${port}/?benchmark`,{method:'PUT'})).json();
    report.targets=(await browserCDP.send('Target.getTargets')).targetInfos.map(t=>({type:t.type,url:t.url}));
    if(report.targets.filter(t=>t.type==='page' && t.url.startsWith(`http://127.0.0.1:${port}/`)).length!==1)throw Error('Expected exactly one game page.');
    const c=await connect(page.webSocketDebuggerUrl);
    await c.send('Runtime.enable');await c.send('Page.enable');await c.send('Page.bringToFront');
    await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
    for(let i=0;i<100;i++){if(await c.evaluate('!!window.eZeusPrototype'))break;await delay(100);}
    await c.evaluate('document.querySelector("#start")?.click()');
    for(let i=0;i<600;i++){
      const state=await c.evaluate('eZeusPrototype');
      if(state.phase==='failed')throw Error(JSON.stringify(state));
      if(state.phase==='ready')break;
      if(i===599)throw Error('Startup timed out');
      await delay(100);
    }
    const fixture=await fs.readFile(process.env.EZEUS_SAVE_FIXTURE || 'fixtures/native-athens-initial.ez');
    await c.evaluate(`Module.FS.mkdirTree('/runtime/Save/Browser Test');Module.FS.writeFile('/runtime/Save/Browser Test/native Athens.ez',Uint8Array.from(atob(${JSON.stringify(fixture.toString('base64'))}),c=>c.charCodeAt(0)));true`);
    await c.evaluate('eZeusPrototype.start ? eZeusPrototype.start() : document.querySelector("#start").click()',true);
    for(let i=0;i<300;i++){
      const state=await c.evaluate('eZeusPrototype');
      if(state.phase==='failed')throw Error(JSON.stringify(state));
      if(state.firstFrame)break;
      await delay(100);
    }
    let after=snapshot();
    report.startup={seconds:+((after.time-startup.time)/1000).toFixed(2),browserCPU:usage(startup,after,'browser'),serverCPU:usage(startup,after,'server')};
    report.renderer=await c.evaluate(`(()=>{const g=Module.canvas.getContext('webgl2')||Module.canvas.getContext('webgl');if(!g)return null;const d=g.getExtension('WEBGL_debug_renderer_info');return {renderer:d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)};})()`);
    console.log('Renderer:',report.renderer,'Startup:',report.startup);
    await delay(5000);
    const metrics=()=>c.evaluate('({hidden:document.hidden,phase:eZeusPrototype.phase,errors:eZeusPrototype.errors,audioState:Module.SDL2?.audioContext?.state,performance:Module.gamePerformance||null})');
    async function measure(name) {
      await delay(1500);
      const initial=await metrics(),before=snapshot();
      const cpuBefore=await browserCDP.send('SystemInfo.getProcessInfo');
      await delay(6000);
      const after=snapshot(),final=await metrics();
      const cpuAfter=await browserCDP.send('SystemInfo.getProcessInfo');
      const cpuOld=new Map(cpuBefore.processInfo.map(p=>[p.id,p.cpuTime]));
      const processes=cpuAfter.processInfo.map(p=>({type:p.type,id:p.id,cpu:+(100*Math.max(0,p.cpuTime-(cpuOld.get(p.id)||0))/((after.time-before.time)/1000)).toFixed(1)}));
      const result={name,seconds:+((after.time-before.time)/1000).toFixed(2),browserCPU:usage(before,after,'browser'),serverCPU:usage(before,after,'server'),processes,initial,final};
      report.phases.push(result);console.log(JSON.stringify(result));
      if(name==='city-hidden' && (!initial.hidden || !final.hidden))throw Error('The hidden measurement was not hidden throughout.');
      if(name==='city-hidden' && initial.performance && initial.performance.frames!==final.performance.frames)throw Error('The background game kept rendering.');
      if(result.browserCPU>220)throw Error('Steady-state CPU exceeded 220%; stopping this diagnostic.');
    }
    async function click(x,y) {
      const r=await c.evaluate('(()=>{const c=Module.canvas,r=c.getBoundingClientRect();c.focus();return {x:r.x,y:r.y,w:r.width,h:r.height,cw:c.width,ch:c.height};})()');
      const p={x:r.x+x*r.w/r.cw,y:r.y+y*r.h/r.ch};
      await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});
      await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});
      await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
      await delay(500);
    }
    async function key(key='p',code='KeyP',windowsVirtualKeyCode=80) {
      await c.send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode});
      await c.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode});
    }
    async function screenshot(name) {
      const shot=await c.send('Page.captureScreenshot',{format:'png'});
      await fs.writeFile(`logs/cpu-${label}-${name}.png`,Buffer.from(shot.data,'base64'));
      return shot.data;
    }
    if(menuOnly) {
      report.menu={sizes:[]};
      async function checkBackground(name) {
        const png=await screenshot(name);
        // Inspect the composited frame, not a WebGL back buffer that may already
        // have been cleared. Fixed-size artwork left these edge samples black.
        const edges=await c.evaluate(`(async()=>{
          const response=await fetch('data:image/png;base64,'+${JSON.stringify(png)});
          const bitmap=await createImageBitmap(await response.blob());
          const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);
          const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();
          const w=canvas.width,h=canvas.height,result=[];
          for(const f of [0.1,0.3,0.5,0.7,0.9])for(const [x,y] of [[1,Math.floor(h*f)],[w-2,Math.floor(h*f)],[Math.floor(w*f),1],[Math.floor(w*f),h-2]]){
            const rgba=Array.from(ctx.getImageData(x,y,1,1).data);result.push({x,y,rgba});
          }
          return result;
        })()`);
        if(edges.some(p=>p.rgba[3]!==255) || edges.filter(p=>p.rgba.slice(0,3).every(v=>v<4)).length>1)throw Error('The menu background leaves empty borders.');
        return edges;
      }
      await measure('menu');
      for(const [w,h,dpr] of [[1280,720,1],[1024,768,1],[1920,800,1],[800,900,1],[1440,900,2]]) {
        const size=await resizeAndCheck(c,w,h,dpr);
        report.menu.sizes.push({...size,edges:await checkBackground(`menu-${w}x${h}`)});
      }
      // The leader control remains in the top-left corner after every resize.
      await click(90,50);await delay(1000);
      report.menu.roster=await metrics();
      if(report.menu.roster.performance.targetFps!==20)throw Error('The anchored leader button did not open the roster.');
      report.menu.roster.edges=await checkBackground('roster');
      await resizeAndCheck(c,1024,768);
      await click(480,524);await delay(1000);
      if((await metrics()).performance.targetFps!==2)throw Error('The roster Return control did not return to the main menu.');
      await click(480,458);await delay(1000);
      report.menu.settings=await metrics();
      if(report.menu.settings.performance.targetFps!==20)throw Error('The resized Settings button did not open settings.');
      report.menu.settings.edges=await checkBackground('settings');
      await resizeAndCheck(c,1920,800);
      await checkBackground('settings-wide');
      await resizeAndCheck(c,1024,768);
      await click(770,590);await delay(1000);
      if((await metrics()).performance.targetFps!==2)throw Error('The resized Settings confirmation did not return to the main menu.');
      if(process.env.EZEUS_ORIGINAL_SAVE_FIXTURE) {
      const originalSave=await fs.readFile(process.env.EZEUS_ORIGINAL_SAVE_FIXTURE);
      // This alias exists only in the disposable test browser, so the native
      // file chooser can exercise the real format check. It is not a conversion.
      const originalAlias='/runtime/Save/Browser Test/Original Zeus compatibility test.ez';
      await c.evaluate(`Module.FS.writeFile(${JSON.stringify(originalAlias)},Uint8Array.from(atob(${JSON.stringify(originalSave.toString('base64'))}),c=>c.charCodeAt(0)));true`);
      await click(480,263);await click(380,296);await click(680,525);
      report.originalSave=await c.evaluate(`({messages:eZeusPrototype.log.filter(line=>line.includes('Original Zeus compatibility test.ez') && line.includes("expected 'eZeus.ez'")),performance:Module.gamePerformance,errors:eZeusPrototype.errors})`);
      report.originalSave.fixtureProvided=true;
      report.originalSave.bytes=originalSave.length;
      if(report.originalSave.messages.length!==1 || report.originalSave.performance.boardFrame!==0 || report.originalSave.errors.length)throw Error('The original Zeus save did not produce the expected clean format rejection.');
      await screenshot('original-save-rejected');
      await c.evaluate(`Module.FS.unlink(${JSON.stringify(originalAlias)});true`);
      await click(280,525);
      }
      await click(480,263);await click(380,296);await click(680,525);
      await delay(3000);await screenshot('menu-to-city');
      report.menu.city=await metrics();
      if(!report.menu.city.performance.paused || report.menu.city.performance.day!==1 || report.menu.city.performance.boardFrame===0)throw Error('Loading a city from the resized menu failed.');
      if(report.exceptions?.length || report.menu.city.errors.length)throw Error('Menu runtime errors.');
      console.log('Menu checks passed:',report.menu.sizes.map(s=>s.window));
    }else {
    if(!layoutOnly)await measure('menu');
    await click(640,263);await click(540,296);await click(840,525);
    await delay(3000);await screenshot('city-paused');
    if(layoutOnly) {
      report.layout={initial:await metrics(),sizes:[]};
      if(!report.layout.initial.performance?.paused || !report.layout.initial.performance.boardFrame)throw Error('The city fixture did not load paused.');
      const initial=report.layout.initial.performance;
      for(const [w,h,dpr] of [[1024,768,1],[1600,900,1],[1440,900,2],[800,900,1]]) {
        const size=await resizeAndCheck(c,w,h,dpr);
        if(size.performance.day!==initial.day || !size.performance.paused)throw Error('Resizing changed the paused city state.');
        report.layout.sizes.push(size);
        await screenshot(`city-${w}x${h}`);
      }
      await resizeAndCheck(c,1280,720);
      await key('Escape','Escape',27);await delay(500);
      await screenshot('dialog-before-resize');
      report.layout.dialog=await resizeAndCheck(c,1024,768);
      await screenshot('dialog-after-resize');
      // The Resume Game button was centered near (640,240); the existing dialog
      // should move with its parent, including its hit target, to (480,240).
      await click(480,240);
      await key();await delay(3500);
      report.layout.playing=await metrics();
      if(report.layout.playing.performance.paused || report.layout.playing.performance.boardFrame<=initial.boardFrame)throw Error('The resized dialog or keyboard controls failed.');
      await key();await delay(500);await screenshot('city-resized-final');
      report.layout.final=await metrics();
      if(!report.layout.final.performance.paused || report.layout.final.errors.length || report.exceptions?.length)throw Error('Resized game failed to pause or raised errors.');
      console.log('Layout:',JSON.stringify(report.layout));
    }else {
    await measure('city-paused');
    await key();await measure('city-playing');await screenshot('city-playing');
    if(process.argv.includes('--trace')){
      await c.send('Profiler.enable');await c.send('Profiler.start');await delay(3000);
      const profile=await c.send('Profiler.stop');
      await fs.writeFile(`logs/cpu-${label}.cpuprofile`,JSON.stringify(profile.profile));
    }
    const {windowId}=await browserCDP.send('Browser.getWindowForTarget',{targetId:page.id});
    await browserCDP.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'minimized'}});
    await measure('city-hidden');
    if(process.argv.includes('--trace')){
      await c.send('Profiler.start');await delay(2000);
      const profile=await c.send('Profiler.stop');
      await fs.writeFile(`logs/cpu-${label}-hidden.cpuprofile`,JSON.stringify(profile.profile));
    }
    await browserCDP.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});
    await c.send('Page.bringToFront');await measure('city-resumed');
    await key();await screenshot('city-final');
    report.final=await c.evaluate('({state:eZeusPrototype,log:document.querySelector("#log")?.textContent.slice(-6000),pageText:document.body.innerText,canvasRect:Module.canvas.getBoundingClientRect().toJSON()})');
    if(report.final.pageText.trim())throw Error('Unexpected website text outside the game canvas.');
    if(report.exceptions?.length || report.final.state.phase==='failed')throw Error('Browser runtime errors');
    }
    }
  }
} catch(error) {
  report.error=String(error);console.error(error);process.exitCode=1;
} finally {
  cleanup();clearTimeout(watchdog);
  await fs.writeFile(`logs/cpu-${label}.json`,JSON.stringify(report,null,2)+'\n');
  await delay(500);
  await fs.rm(profileDirectory,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
