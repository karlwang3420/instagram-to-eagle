const assert = require('node:assert/strict');
module.exports = async ({evaluate,send,waitFor,ig,popup,delay,screenshot}) => {
  const show = (text,failed=false) => evaluate(popup,`browser.tabs.sendMessage(igTab.id,{type:'eagle:toast',text:${JSON.stringify(text)},failed:${failed}}).then(()=>true)`);
  const exists = () => evaluate(ig,`!!document.getElementById('instagram-eagle-status')`);
  const rect = () => evaluate(ig,`JSON.stringify((()=>{const b=document.getElementById('instagram-eagle-status'),r=b.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:innerWidth-r.right,bottom:innerHeight-r.bottom,count:document.querySelectorAll('#instagram-eagle-status').length,text:b.textContent}})())`).then(JSON.parse);
  const pointer = async (x,y,click=false) => send('input.performActions',{context:ig,actions:[{type:'pointer',id:'toast-mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',x:Math.round(x),y:Math.round(y),duration:0},...(click?[{type:'pointerDown',button:0},{type:'pointerUp',button:0}]:[])]}]});
  await send('browsingContext.activate',{context:ig});
  await send('browsingContext.setViewport',{context:ig,viewport:{width:900,height:650}});
  await pointer(10,10);
  await show('Saved 3 images to Eagle'); await delay(200);
  let r = await rect();
  assert.ok(Math.abs(r.right-16)<0.1); assert.ok(Math.abs(r.bottom-16)<0.1); assert.ok(r.width<=320.1); assert.ok(r.height<=48);
  assert.equal(await evaluate(ig,`document.activeElement===document.body`),true);
  await screenshot('toast-success-firefox.png');
  await delay(3100); assert.equal(await exists(),false);
  console.log('PASS compact bottom-right success, no focus stealing, automatic dismissal');

  await show('Saved to Eagle'); await delay(1000);
  const error = 'Could not connect to Eagle. Open Eagle, then try again.';
  await show(error,true); await delay(2300);
  r = await rect(); assert.equal(r.count,1); assert.equal(r.text,error); assert.ok(r.height<110);
  await screenshot('toast-error-firefox.png');
  await delay(5900); assert.equal(await exists(),false);
  console.log('PASS error replaces previous message, survives old timer, dismisses after 8 seconds');

  await show('Saved to Eagle'); await delay(200); r=await rect();
  await pointer(r.x+15,r.y+15); await delay(3300); assert.equal(await exists(),true);
  await pointer(10,10); await delay(3200); assert.equal(await exists(),false);
  console.log('PASS hover pauses dismissal and leaving restarts it');

  await show('Saved to Eagle'); await delay(200);
  // Tab backwards from the page body reaches the last tabbable element: the close button.
  await evaluate(ig,`document.activeElement.blur();true`);
  await send('input.performActions',{context:ig,actions:[{type:'key',id:'toast-keyboard',actions:[{type:'keyDown',value:'\uE008'},{type:'keyDown',value:'\uE004'},{type:'keyUp',value:'\uE004'},{type:'keyUp',value:'\uE008'}]}]});
  assert.equal(await evaluate(ig,`document.activeElement.id`),'instagram-eagle-status');
  await delay(3300); assert.equal(await exists(),true);
  await send('input.performActions',{context:ig,actions:[{type:'key',id:'toast-keyboard',actions:[{type:'keyDown',value:'\uE007'},{type:'keyUp',value:'\uE007'}]}]});
  assert.equal(await exists(),false);
  console.log('PASS keyboard focus pauses timer; Enter dismisses notification');

  const key = value => send('input.performActions',{context:ig,actions:[{type:'key',id:'toast-keyboard',actions:[{type:'keyDown',value},{type:'keyUp',value}]}]});
  const showOffline = async () => { await evaluate(popup,`browser.tabs.sendMessage(igTab.id,{type:'eagle:toast',text:'unused',failed:true,code:'eagle-offline'}).then(()=>true)`); await delay(250); };
  // Full path: a trusted click on a real control while the Eagle API refuses connections.
  await evaluate(popup,`window.reachableFetch=bg.fetch;bg.fetch=async()=>{throw new TypeError('connection refused')};true`);
  const control = JSON.parse(await evaluate(ig,`JSON.stringify((()=>{const h=[...document.querySelectorAll('[data-eagle-control]')].find(c=>{const b=c.getBoundingClientRect();return !c.hidden&&b.width>0&&b.top>=0&&b.bottom<=innerHeight});const b=h.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})())`));
  await pointer(control.x,control.y,true); await delay(600);
  await evaluate(popup,`bg.fetch=window.reachableFetch;true`);
  r = await rect();
  assert.equal(r.count,1); assert.match(r.text,/^Open Eagle to save this/);
  assert.ok(Math.abs(r.x+r.width/2-450)<1,'dialog is horizontally centered'); assert.ok(Math.abs(r.y-650*0.33)<1,'dialog sits a third of the way down');
  assert.equal(await evaluate(ig,`document.activeElement.id`),'instagram-eagle-status');
  await pointer(10,10); await screenshot('toast-eagle-offline-firefox.png');
  await delay(8500); assert.equal(await exists(),true);
  console.log('PASS a download click with Eagle closed opens a focused, centered dialog a third of the way down that stays until answered');

  await key(''); assert.equal(await exists(),false);
  await showOffline();
  await send('input.performActions',{context:ig,actions:[{type:'key',id:'toast-keyboard',actions:[{type:'keyDown',value:''},{type:'keyDown',value:''},{type:'keyUp',value:''},{type:'keyUp',value:''}]}]});
  await key(''); assert.equal(await exists(),false);
  await showOffline(); await show('Saved to Eagle'); await delay(200); r = await rect();
  assert.equal(r.count,1); assert.ok(Math.abs(r.right-16)<0.1); assert.ok(Math.abs(r.bottom-16)<0.1);
  await delay(3100); assert.equal(await exists(),false);
  console.log('PASS Escape and Not now dismiss the dialog; a later notice replaces it at the bottom right');

  await showOffline(); r = await rect();
  await pointer(r.x+r.width-60,r.y+r.height-32,true); await delay(300);
  r = await rect(); assert.match(r.text,/^If your browser asks/);
  await pointer(10,10); await screenshot('toast-eagle-opening-firefox.png');
  await delay(10000); assert.equal(await exists(),false);
  console.log('PASS Open Eagle explains the next step, then dismisses itself');

  // A connection that takes 1.5 seconds to fail, as Firefox sees on Windows.
  await evaluate(popup,`bg.fetch=()=>new Promise((_,reject)=>setTimeout(()=>reject(new TypeError('connection refused')),1500));true`);
  await pointer(control.x,control.y,true); await delay(250);
  assert.equal(await exists(),false,'no prompt before the early threshold');
  await delay(500); r = await rect(); assert.match(r.text,/^Open Eagle to save this/);
  await pointer(r.x+r.width-60,r.y+r.height-32,true); await delay(200);
  assert.match((await rect()).text,/^If your browser asks/);
  await pointer(10,10); await delay(1200);
  assert.match((await rect()).text,/^If your browser asks/,'the late failure must not reopen the prompt');
  await key(''); assert.equal(await exists(),false);
  console.log('PASS slow failure prompts after 500ms and the late failure keeps the Open Eagle state');

  // A busy Eagle answers late: the prompt clears itself and the save still completes.
  await evaluate(popup,`bg.testPayload=null;bg.fetch=(url,opts)=>new Promise(resolve=>setTimeout(()=>resolve(window.reachableFetch(url,opts)),1200));true`);
  await pointer(control.x,control.y,true); await delay(800);
  assert.match((await rect()).text,/^Open Eagle to save this/);
  await waitFor(popup,`!!bg.testPayload`);
  await evaluate(popup,`bg.fetch=window.reachableFetch;true`);
  await delay(300); assert.match((await rect()).text,/^Sent /);
  await delay(3100); assert.equal(await exists(),false);
  console.log('PASS a slow but running Eagle clears the prompt and still saves');

  await send('browsingContext.setViewport',{context:ig,viewport:{width:280,height:600}});
  const literal = '<img src=x onerror=alert(1)> ' + 'LongErrorDetails'.repeat(30);
  await show(literal,true); await delay(200); r=await rect();
  assert.equal(r.text,literal); assert.ok(Math.abs(r.right-16)<0.1); assert.ok(Math.abs(r.bottom-16)<0.1);
  assert.ok(r.width<=248.1); assert.ok(r.x>=15.9); assert.ok(r.height<=264);
  assert.equal(await evaluate(ig,`document.querySelector('#instagram-eagle-status img')===null`),true);
  await screenshot('toast-narrow-firefox.png');
  await pointer(r.x+r.width-20,r.y+20,true); assert.equal(await exists(),false);
  console.log('PASS narrow-screen wrapping, long error containment, literal text safety and mouse dismissal');
  assert.equal(await evaluate(popup,`browser.runtime.getBackgroundPage().then(bg=>{const a=new bg.Audio(browser.runtime.getURL('sounds/success.ogg'));return a.play().then(()=>a.duration>0.5&&a.duration<1)})`),true);
  console.log('PASS success sound plays from the background page without a user gesture');
};
