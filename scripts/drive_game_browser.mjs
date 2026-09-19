// Canvas coordinates are game pixels, independent of the page's canvas position.
// Usage: node scripts/drive_game_browser.mjs '[{"type":"click","x":640,"y":360}]'
import fs from 'node:fs/promises';
const report=JSON.parse(await fs.readFile('logs/browser-game-validation.json','utf8'));
const pages=await(await fetch('http://127.0.0.1:9347/json/list')).json();
const page=pages.find(p=>p.id===report.targetId);
if(!page)throw Error('The test game page is no longer open.');
const ws=new WebSocket(page.webSocketDebuggerUrl),pending=new Map();let id=0;
await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
ws.onmessage=({data})=>{const m=JSON.parse(data);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const seq=++id;pending.set(seq,{resolve,reject});ws.send(JSON.stringify({id:seq,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
try {
 await send('Runtime.enable');await send('Page.enable');
 for(const action of JSON.parse(process.argv[2]||'[]')){
  if(action.type==='click'){
   const rect=await evaluate('(()=>{const c=Module.canvas,r=c.getBoundingClientRect();c.focus();return {x:r.x,y:r.y,w:r.width,h:r.height,cw:c.width,ch:c.height};})()');
   const point={x:rect.x+action.x*rect.w/rect.cw,y:rect.y+action.y*rect.h/rect.ch};
   await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
   await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
   await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  }else if(action.type==='text')await send('Input.insertText',{text:action.text});
  else if(action.type==='key'){
   const params={key:action.key,code:action.code||action.key,windowsVirtualKeyCode:action.keyCode,nativeVirtualKeyCode:action.keyCode};
   await send('Input.dispatchKeyEvent',{type:'keyDown',...params});
   await send('Input.dispatchKeyEvent',{type:'keyUp',...params});
  }else if(action.type==='evaluate')console.log(JSON.stringify(await evaluate(action.expression)));
  else if(action.type==='wait')await new Promise(r=>setTimeout(r,Math.min(action.ms,60000)));
  else throw Error('Unknown action '+action.type);
  await new Promise(r=>setTimeout(r,250));
 }
 const state=await evaluate('({state:eZeusPrototype,performance:Module.gamePerformance||null})');
 const shot=await send('Page.captureScreenshot',{format:'png'});
 const stem=process.argv[3]||'logs/browser-game-inspection';
 await fs.writeFile(stem+'.png',Buffer.from(shot.data,'base64'));
 await fs.writeFile(stem+'.json',JSON.stringify(state,null,2)+'\n');
 console.log(JSON.stringify(state,null,2));
}finally{ws.close();}
