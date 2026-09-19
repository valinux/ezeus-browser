// Exercise the real locally built game through an isolated Chromium CDP session.
import fs from 'node:fs/promises';
const debug=process.env.EZEUS_BROWSER_DEBUG_PORT||'9347';
const url=process.argv[2]||'http://127.0.0.1:8787/?benchmark';
const fixture=process.env.EZEUS_NATIVE_FIXTURE?await fs.readFile(process.env.EZEUS_NATIVE_FIXTURE):null;
const page=await(await fetch(`http://127.0.0.1:${debug}/json/new?${encodeURIComponent(url)}`,{method:'PUT'})).json();
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),exceptions=[];
let seq=0;
await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
ws.onmessage=({data})=>{
  const m=JSON.parse(data);
  if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(Error(JSON.stringify(m.error)));else p?.resolve(m.result);}
  if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);
};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{
  const r=await send('Runtime.evaluate',{expression,returnByValue:true,userGesture:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
let outcome;
try {
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1400,height:1100,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url});
  for(let i=0;i<100;i++){
    if(await evaluate('!!window.eZeusPrototype'))break;
    await new Promise(r=>setTimeout(r,100));
  }
  let launched=false;
  for(let i=0;i<600;i++) {
    outcome=await evaluate('({state:window.eZeusPrototype,isolated:crossOriginIsolated})');
    if(i%30===0)console.log(JSON.stringify({phase:outcome.state.phase,files:outcome.state.filesLoaded}));
    if(['failed','exited'].includes(outcome.state.phase)||exceptions.length)break;
    if(outcome.state.phase==='ready'&&!launched){
      if(fixture){
        const encoded=JSON.stringify(fixture.toString('base64'));
        await evaluate(`Module.FS.mkdirTree('/runtime/Save/Browser Test');Module.FS.writeFile('/runtime/Save/Browser Test/native Athens.ez',Uint8Array.from(atob(${encoded}),c=>c.charCodeAt(0)));true`);
      }
      await evaluate('eZeusPrototype.start()');launched=true;
    }
    if(outcome.state.firstFrame){await new Promise(r=>setTimeout(r,8000));break;}
    await new Promise(r=>setTimeout(r,500));
  }
  outcome=await evaluate('({state:window.eZeusPrototype,isolated:crossOriginIsolated})');
  const result={...outcome,runtimeExceptions:exceptions,url,targetId:page.id};
  await fs.writeFile('logs/browser-game-validation.json',JSON.stringify(result,null,2)+'\n');
  const shot=await send('Page.captureScreenshot',{format:'png'});
  await fs.writeFile('logs/browser-game-check.png',Buffer.from(shot.data,'base64'));
  console.log(JSON.stringify(result,null,2));
  if(!outcome.state.firstFrame||outcome.state.phase==='failed'||exceptions.length)process.exitCode=1;
}finally{
  // Only leave the game running when explicitly requested for manual inspection.
  if(process.env.EZEUS_KEEP_BROWSER_OPEN!=='1')await send('Target.closeTarget',{targetId:page.id});
  ws.close();
}
