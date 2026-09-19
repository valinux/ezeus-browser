import fs from 'node:fs/promises';
const base='http://127.0.0.1:9347';
const url='http://127.0.0.1:8787/probe/runtime.html';
const page=await(await fetch(`${base}/json/new?${encodeURIComponent(url)}`,{method:'PUT'})).json();
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),exceptions=[];
let seq=0;
await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const outcomes=[];
try {
 await send('Runtime.enable');await send('Page.enable');
 for(let round=0;round<2;round++){
  await send('Page.navigate',{url});
  let result;
  for(let i=0;i<120;i++){
   await new Promise(r=>setTimeout(r,250));
   const evaluated=await send('Runtime.evaluate',{expression:'({state:window.probe,log:document.querySelector("#log")?.textContent})',returnByValue:true});
   result=evaluated.result.value;
   if(['passed','failed'].includes(result?.state?.phase))break;
  }
  outcomes.push(result);
  if(result?.state?.phase!=='passed')break;
 }
 const result={outcomes,exceptions,targetId:page.id};
 await fs.writeFile('logs/browser-runtime-validation.json',JSON.stringify(result,null,2)+'\n');
 const screenshot=await send('Page.captureScreenshot',{format:'png'});
 await fs.writeFile('logs/browser-runtime-check.png',Buffer.from(screenshot.data,'base64'));
 console.log(JSON.stringify(result,null,2));
 if(outcomes.length!==2||outcomes.some(o=>o.state.phase!=='passed'||!o.state.frame)||outcomes[1].state.previous!=='worker-to-browser'||exceptions.length)process.exitCode=1;
}finally{ws.close();}
