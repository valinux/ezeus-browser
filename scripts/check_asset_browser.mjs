// Uses a separately launched Chromium instance; no user's browser profile.
import fs from 'node:fs/promises';
const port = process.env.EZEUS_BROWSER_DEBUG_PORT || '9347';
const url = process.argv[2] || 'http://127.0.0.1:8786/asset-parser.html';
const page = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {method:'PUT'})).json();
const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map(), exceptions = [];
let seq = 0;
await new Promise((resolve,reject) => {socket.onopen=resolve;socket.onerror=reject;});
socket.onmessage = ({data}) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request=pending.get(message.id);pending.delete(message.id);
    if(message.error) request?.reject(new Error(JSON.stringify(message.error)));
    else request?.resolve(message.result);
  }
  if(message.method==='Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
};
const send=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));
});
const evaluate=async expression=>{
  const result=await send('Runtime.evaluate',{expression,returnByValue:true});
  if(result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
let report;
try {
  await send('Runtime.enable');await send('Page.enable');
  await send('Page.navigate',{url});
  for(let i=0;i<120;i++) {
    report=await evaluate('window.assetProbe || null');
    if(report && report.status!=='loading')break;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  const native=JSON.parse(await fs.readFile('logs/text-parser-validation.json','utf8'));
  const matches=JSON.stringify(report?.result)===JSON.stringify(native);
  const result={...report,matchesNative:matches,runtimeExceptions:exceptions,url};
  await fs.writeFile('logs/browser-asset-validation.json',JSON.stringify(result,null,2)+'\n');
  const shot=await send('Page.captureScreenshot',{format:'png'});
  await fs.writeFile('logs/browser-asset-check.png',Buffer.from(shot.data,'base64'));
  console.log(JSON.stringify(result,null,2));
  if(report?.status!=='passed'||!matches||exceptions.length||report.errors.length)process.exitCode=1;
} finally {
  await send('Page.close');socket.close();
}
