const assert = require('node:assert/strict');
module.exports = async ({evaluate,send,ig,popup,delay,screenshot}) => {
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

  await send('browsingContext.setViewport',{context:ig,viewport:{width:280,height:600}});
  const literal = '<img src=x onerror=alert(1)> ' + 'LongErrorDetails'.repeat(30);
  await show(literal,true); await delay(200); r=await rect();
  assert.equal(r.text,literal); assert.ok(Math.abs(r.right-16)<0.1); assert.ok(Math.abs(r.bottom-16)<0.1);
  assert.ok(r.width<=248.1); assert.ok(r.x>=15.9); assert.ok(r.height<=264);
  assert.equal(await evaluate(ig,`document.querySelector('#instagram-eagle-status img')===null`),true);
  await screenshot('toast-narrow-firefox.png');
  await pointer(r.x+r.width-20,r.y+20,true); assert.equal(await exists(),false);
  console.log('PASS narrow-screen wrapping, long error containment, literal text safety and mouse dismissal');
};
