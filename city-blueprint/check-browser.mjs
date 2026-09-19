// Run against an isolated Chromium/Brave started with --remote-debugging-port=9337.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const pages=await (await fetch('http://127.0.0.1:9337/json/list')).json();
const page=pages.find(x=>x.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),exceptions=[];
let seq=0;
await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no});
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(m.error);else p?.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails)};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value}
const assert=(v,m)=>{if(!v)throw new Error(m)};
await send('Runtime.enable');await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1180,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:pathToFileURL(path.join(here,'index.html')).href});
for(let i=0;i<40;i++){if(await evaluate('document.readyState === "complete" && !!document.querySelector("#map .building")'))break;await new Promise(r=>setTimeout(r,150))}
assert(await evaluate('document.querySelector("#plan-title").textContent === "Eight-estate promenade"'),'Initial render');
const results=[];
for(const mode of ['poseidon','zeus']){
  for(const p of ['elite','workers','support']){
    await evaluate(`document.querySelector('#mode').value=${JSON.stringify(mode)};document.querySelector('#mode').dispatchEvent(new Event('change'));document.querySelector('[data-plan="${p}"]').click();`);
    for(const diff of ['Beginner','Mortal','Hero','Titan','Olympian']){
      const info=await evaluate(`document.querySelector('#difficulty').value=${JSON.stringify(diff)};document.querySelector('#difficulty').dispatchEvent(new Event('change'));({title:document.querySelector('#plan-title').textContent,rows:document.querySelectorAll('#upgrade tr').length,score:document.querySelectorAll('#upgrade tr')[3].children[2].textContent,dimensions:document.querySelector('#dimensions').textContent})`);
      assert(info.rows===4,`${mode}/${p}/${diff}: four elite levels`);
      assert(info.score===(diff==='Beginner'?'70':'80'),`${mode}/${p}/${diff}: score`);
      results.push({mode,plan:p,difficulty:diff,status:'pass'});
    }
    const svg=await evaluate(`(()=>{const s=document.querySelector('#map').cloneNode(true);s.setAttribute('xmlns','http://www.w3.org/2000/svg');s.setAttribute('font-family','system-ui, sans-serif');const v=s.getAttribute('viewBox').split(' ');s.setAttribute('width',v[2]);s.setAttribute('height',v[3]);return new XMLSerializer().serializeToString(s)})()`);
    await fs.writeFile(path.join(here,`${mode}-${p}.svg`),svg);
  }
}
await evaluate(`document.querySelector('#mode').value='poseidon';document.querySelector('#mode').dispatchEvent(new Event('change'));document.querySelector('[data-plan="elite"]').click();document.querySelector('#difficulty').value='Hero';document.querySelector('#difficulty').dispatchEvent(new Event('change'));document.querySelector('[data-id="E1"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
assert(await evaluate('document.querySelector("#inspector").textContent.includes("Column 11, row 6")'),'Building click and coordinates');
await evaluate(`document.querySelector('#layer').value='science';document.querySelector('#layer').dispatchEvent(new Event('change'));`);
assert(await evaluate('document.querySelector("[data-id=E1]").getAttribute("opacity")==="0.18"'),'Layer focus');
await evaluate(`document.querySelector('#layer').value='all';document.querySelector('#layer').dispatchEvent(new Event('change'));document.querySelector('#grid').click();`);
assert(await evaluate(`!document.querySelector('#map rect[fill="url(#tile-grid)"]')`),'Grid toggle');
await evaluate(`document.querySelector('#grid').click();document.querySelector('#labels').click();`);
assert(await evaluate('!document.querySelector("[data-id=E1] text")'),'Label toggle');
await evaluate(`document.querySelector('#labels').click();document.querySelector('#check-reset').click();document.querySelector('[data-check="0"]').click();`);
assert(await evaluate('JSON.parse(localStorage.getItem("zeus-eight-estates-checks")).includes(0)'),'Checklist persists');
await evaluate(`document.querySelector('#check-reset').click();`);
const downloads=await fs.mkdtemp('/private/tmp/zeus-blueprint-downloads-');
await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
await evaluate(`document.querySelector('#download').click();document.querySelector('#csv').click();`);
for(let i=0;i<30;i++){const names=await fs.readdir(downloads);if(names.includes('poseidon-elite.svg')&&names.includes('poseidon-elite.csv'))break;await new Promise(r=>setTimeout(r,150))}
assert((await fs.readFile(path.join(downloads,'poseidon-elite.svg'),'utf8')).includes('Eight-estate'),'SVG export');
assert((await fs.readFile(path.join(downloads,'poseidon-elite.csv'),'utf8')).includes('Elite plot 1'),'CSV export');
// Check links to packaged files, which need not exist during an intermediate preview.
const links=await evaluate(`Array.from(document.querySelectorAll('a[href]')).map(a=>a.getAttribute('href')).filter(h=>!h.startsWith('http'))`);
const missing=[];for(const link of links){try{await fs.access(path.resolve(here,decodeURIComponent(link)))}catch{missing.push(link)}}
// Capture the full page header/map, and each civilization's complete elite grid.
await evaluate("document.querySelector('#toast').style.display='none';window.scrollTo(0,0);");
let img=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(here,'research','desktop-preview.png'),Buffer.from(img.data,'base64'));
for(const mode of ['poseidon','zeus']){
  await evaluate(`document.querySelector('#mode').value='${mode}';document.querySelector('#mode').dispatchEvent(new Event('change'));`);
  const box=await evaluate(`(()=>{const r=document.querySelector('.mapscroll').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()`);
  img=await send('Page.captureScreenshot',{format:'png',clip:box,captureBeyondViewport:true});await fs.writeFile(path.join(here,`${mode}-elite.png`),Buffer.from(img.data,'base64'));
}
await evaluate(`document.querySelector('#mode').value='poseidon';document.querySelector('#mode').dispatchEvent(new Event('change'));`);
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
const mobile=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,wide:Array.from(document.querySelectorAll("body *")).filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,cls:e.className?.baseVal||e.className,right:e.getBoundingClientRect().right}))})');if(mobile.scroll>mobile.width)console.log(JSON.stringify(mobile));assert(mobile.scroll<=mobile.width,'No whole-page overflow at mobile width');
img=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(here,'research','mobile-preview.png'),Buffer.from(img.data,'base64'));
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1180,deviceScaleFactor:1,mobile:false});
const pdf=await send('Page.printToPDF',{landscape:true,printBackground:true,preferCSSPageSize:true});await fs.writeFile(path.join(here,'Blueprint-Poseidon.pdf'),Buffer.from(pdf.data,'base64'));
const report={status:exceptions.length?'FAIL':'pass',states:results,checks:['initial load','30 civilization/district/difficulty states','building inspector','layer focus','tile and label toggles','checklist persistence','SVG and CSV downloads','390px mobile overflow','SVG/PNG/PDF exports'],runtimeExceptions:exceptions,missingLocalLinks:missing};
await fs.writeFile(path.join(here,'browser-validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,states:results.length,runtimeExceptions:exceptions.length,missingLocalLinks:missing},null,2));
await send('Browser.close');ws.close();
assert(!exceptions.length,'Runtime exceptions');
