const assert=require('node:assert/strict');
module.exports=async({evaluate,send,ig,popup,delay,screenshot,profileNetwork})=>{
  const img=(code,id=code)=>({code,pk:id,media_type:1,user:{username:'artist'},caption:{text:'Profile #art'},image_versions2:{candidates:[{url:`https://s.cdninstagram.com/${code}.jpg`,width:1200,height:1600}]}});
  const mixed={...img('MIX'),media_type:8,carousel_media_count:2,carousel_media:[img('FIRST'),{media_type:2,video_versions:[{url:'https://v.cdninstagram.com/profile-video.mp4',width:1080,height:1920}]}]};
  await send('browsingContext.activate',{context:ig});
  await send('browsingContext.setViewport',{context:ig,viewport:{width:1000,height:800}});
  await evaluate(ig,`history.pushState({},'','/artist/');document.body.style.cssText='background:#0d1114;color:#eee;font-family:sans-serif';document.querySelector('main').style.cssText='width:720px;margin:30px auto';
    document.querySelector('main').innerHTML='<header style="display:flex;gap:28px;margin-bottom:32px"><div style="width:110px;height:110px;border-radius:60px;background:#536670"></div><section id="profile-info"><h2>artist</h2><p>3 posts · 900 followers · 140 following</p><p>Profile fixture</p></section></header><div id="profile-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px"><a id="tile" href="/p/MIX/" style="position:relative;display:block;height:310px;background:#64767f"><img width="238" height="310" src="https://s.cdninstagram.com/first.jpg"><span style="position:absolute;top:50%;left:28%;color:white">♡ 120　◯ 4</span></a><a href="/reel/VIDEO/" style="display:block;height:310px;background:#526170"><img width="238" height="310" src="https://s.cdninstagram.com/second.jpg"></a><a href="/p/LAST/" style="display:block;height:310px;background:#657573"><img width="238" height="310" src="https://s.cdninstagram.com/third.jpg"></a></div>';
    window.profileMixed=${JSON.stringify(mixed)};window.profileOther=${JSON.stringify(img('LAST'))};window.profileVideo=${JSON.stringify({...img('VIDEO'),media_type:2,video_versions:[{url:'https://v.cdninstagram.com/standalone.mp4'}]})};
    window.apiCalls=[];window.openedPost=0;document.getElementById('tile').addEventListener('click',e=>{e.preventDefault();window.openedPost++});
    window.profilePages=[{user:{username:'artist'},items:[profileMixed],more_available:true,next_max_id:'page2'},{user:{username:'artist'},items:[profileMixed,profileVideo,profileOther],more_available:false}];
    window.require=name=>{if(name==='PolarisConfig')return {getIGAppID:()=> '123456'};if(name==='PolarisWWWClaim')return {getWWWClaim:()=> 'test-session-claim'};if(name!=='PolarisInstapi')throw new Error('Unexpected module');return {apiGet:async(path,options)=>{if(!path.includes('/media/'))throw new Error('Unsupported Polaris endpoint');return {data:{items:[profileMixed]}};}}};
    window.fetch=()=>{throw new Error('Page fetch is wrapped and unavailable');};true`);
  profileNetwork.pages=JSON.parse(await evaluate(ig,'JSON.stringify(profilePages)'));
  const wait=async expr=>{for(let i=0;i<60;i++){if(await evaluate(ig,expr))return;await delay(100);}assert.fail(expr);};
  const click=async(selector,dx=18,dy=18)=>{
    const r=JSON.parse(await evaluate(ig,`JSON.stringify(document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().toJSON())`));
    await send('input.performActions',{context:ig,actions:[{type:'pointer',id:'profile-mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',x:Math.round(r.x+dx),y:Math.round(r.y+dy),duration:0},{type:'pointerDown',button:0},{type:'pointerUp',button:0}]}]});
  };
  const enter=()=>send('input.performActions',{context:ig,actions:[{type:'key',id:'profile-keys',actions:[{type:'keyDown',value:'\uE007'},{type:'keyUp',value:'\uE007'}]}]});
  const tab=()=>send('input.performActions',{context:ig,actions:[{type:'key',id:'profile-keys',actions:[{type:'keyDown',value:'\uE004'},{type:'keyUp',value:'\uE004'}]}]});
  await wait(`document.querySelectorAll('[data-eagle-profile-tile]').length===3`);
  // Reopen the popup on a profile before a single hover event. This was the
  // user's dead end: generic timeline selection failed and buried diagnostics.
  await send('browsingContext.reload',{context:popup,wait:'complete'});await delay(500);
  await evaluate(popup,`(async()=>{window.bg=await browser.runtime.getBackgroundPage();window.igTab=(await browser.tabs.query({})).find(t=>t.url==='https://www.instagram.com/artist/');return true;})()`);
  // Recreate the mock in the new test realm; reloading the fixture page makes
  // functions installed by its old realm dead objects (not a production issue).
  await evaluate(popup,`bg.profilePayloads=[];bg.fetch=async(url,opts)=>{if(opts?.method==='POST'){bg.testPayload=JSON.parse(opts.body);bg.profilePayloads.push(bg.testPayload);}return new Response(JSON.stringify({status:'success',data:String(url).includes('/api/folder/list')?[]:{version:'4.0.0'}}),{headers:{'content-type':'application/json'}})};checkEagle()`);
  assert.equal(await evaluate(popup,`document.querySelector('.actions,#author,#diagnostics')===null`),true);
  assert.equal(await evaluate(popup,`document.querySelectorAll('.tag-options input:checked').length === 3`),true);
  // This fixture opens popup.html in a tab; production correctly rejects tab
  // messages. Exercise its settings renderer directly. The full suite tests
  // real action-popup messaging separately.
  await evaluate(popup,`(async()=>{window.request=message=>bg.route(message);status('Use the download buttons on Instagram.');await folders();return true;})()`);
  assert.equal(await evaluate(popup,`document.getElementById('status').classList.contains('error')`),false,await evaluate(popup,`document.getElementById('status').textContent`));
  assert.equal(await evaluate(popup,`typeof bg.saveProfile`),'undefined');
  assert.equal(await evaluate(popup,`browser.runtime.getManifest().permissions.includes('menus')`),false);
  console.log('PASS settings-only popup; no hover requirement, menus permission or bulk worker');
  await delay(600);
  assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-control]').length`),0);
  assert.equal(await evaluate(ig,`document.querySelector('[data-eagle-profile-all]')===null`),true);
  assert.equal(await evaluate(ig,`getComputedStyle(document.querySelector('[data-eagle-profile-tile]')).opacity`),'0');
  const hover=JSON.parse(await evaluate(ig,`JSON.stringify(document.querySelector('#tile').getBoundingClientRect().toJSON())`));
  await send('input.performActions',{context:ig,actions:[{type:'pointer',id:'profile-mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',x:Math.round(hover.x+40),y:Math.round(hover.y+40),duration:0}]}]});
  await delay(250);assert.equal(await evaluate(ig,`getComputedStyle(document.querySelector('[data-eagle-profile-tile]')).opacity`),'1');
  await evaluate(ig,`document.getElementById('tile').setAttribute('data-private','PRIVATE-SECRET');document.querySelector('#tile img').alt='PRIVATE-CAPTION';true`);
  await delay(300);
  const diagnostic=JSON.parse(await evaluate(popup,`(async()=>JSON.stringify(await browser.tabs.sendMessage(igTab.id,{type:'eagle:profile-layout'})))()`));
  assert.equal(diagnostic.ok,true);assert.equal(diagnostic.layout.schema,1);assert.ok(diagnostic.layout.tree.length>1);
  assert.ok(!/https:|PRIVATE-|test-session-claim|artist|MIX/.test(JSON.stringify(diagnostic)));
  await screenshot('profile-hover-firefox.png');
  await click('#tile [data-eagle-profile-tile]');await delay(1200);
  let payloads=JSON.parse(await evaluate(popup,'JSON.stringify(bg.profilePayloads)'));
  assert.equal(payloads.length,1,await evaluate(ig,`document.getElementById('instagram-eagle-status')?.textContent`));assert.equal(payloads[0].items.length,2);assert.equal(payloads[0].items[1].url,'https://v.cdninstagram.com/profile-video.mp4');
  assert.equal(await evaluate(ig,'openedPost'),0);assert.equal(await evaluate(ig,'location.pathname'),'/artist/');
  console.log('PASS hover icon is grid-only, follows the thumbnail, saves the full mixed post without opening it');

  assert.equal(profileNetwork.requests.length,0);
  console.log('PASS profile grid never starts account-wide feed requests');

  // Reproduce a link wider than its thumbnail with stats anchored to a cell.
  // Changing that static link to relative used to move/resize Instagram's stats.
  await evaluate(ig,`document.getElementById('profile-grid').innerHTML='<div id="cell" style="position:relative;width:238px;height:310px"><a id="tile" href="/p/MIX/" style="display:block;width:476px;height:310px"><div id="media-wrap" style="width:238px;height:310px"><img style="display:block;width:100%;height:100%" src="https://s.cdninstagram.com/first.jpg"><div id="native-stats" style="position:absolute;top:50%;left:0;width:100%;display:flex;justify-content:center;gap:16px;white-space:nowrap;color:white"><span>♡ 19K</span><span>◯ 41</span></div></div></a></div>';
    window.statsBefore=document.getElementById('native-stats').getBoundingClientRect().toJSON();true`);
  await wait(`document.querySelectorAll('[data-eagle-profile-tile]').length===1`);await delay(400);
  const checkLayout=async()=>{
    const result=JSON.parse(await evaluate(ig,`JSON.stringify((()=>{const a=document.getElementById('tile'),img=a.querySelector('img').getBoundingClientRect(),b=a.querySelector('[data-eagle-profile-tile]').getBoundingClientRect(),s=document.getElementById('native-stats').getBoundingClientRect();return {position:getComputedStyle(a).position,x:b.x+b.width/2-(img.x+img.width/2),y:b.y+b.height/2-(img.y+img.height*.7),statsWidth:s.width,imgWidth:img.width,statsHeight:s.height};})())`));
    assert.equal(result.position,'static');assert.ok(Math.abs(result.x)<1);assert.ok(Math.abs(result.y)<1);assert.equal(result.statsWidth,result.imgWidth);assert.ok(result.statsHeight<30);
  };
  await checkLayout();
  assert.equal(await evaluate(ig,`document.getElementById('native-stats').getBoundingClientRect().x===statsBefore.x`),true);
  await click('#tile [data-eagle-profile-tile]');await screenshot('profile-hover-contained-firefox.png');
  await evaluate(ig,`document.getElementById('cell').style.width='190px';document.getElementById('media-wrap').style.width='190px';document.getElementById('cell').style.transform='scale(.85)';true`);await delay(500);await checkLayout();
  console.log('PASS thumbnail-centered placement under wide static links, native stat dimensions unchanged, resize and transformed ancestor');

  // Native overlay presence/size must NEVER change the icon coordinate space.
  await evaluate(ig,`window.stableIcon=document.querySelector('[data-eagle-profile-tile]');window.iconBefore=stableIcon.getBoundingClientRect().toJSON();true`);
  await evaluate(ig,`document.getElementById('cell').style.transform='';document.getElementById('tile').insertAdjacentHTML('beforeend','<div class="_aajz" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#0005"><span>♡ 19K　◯ 41</span></div>');true`);
  await wait(`document.querySelector('#tile > [data-eagle-profile-tile]')!==null`);
  for(const height of [310,240,380]){
    await evaluate(ig,`document.getElementById('cell').style.height='${height}px';document.querySelector('#tile img').style.height='150px';true`);
    await delay(220);
    const offsets=JSON.parse(await evaluate(ig,`JSON.stringify((()=>{const o=document.querySelector('#cell').getBoundingClientRect(),b=document.querySelector('[data-eagle-profile-tile]').getBoundingClientRect();return [b.x+b.width/2-o.x-o.width/2,b.y+b.height/2-o.y-o.height*.7];})())`));
    assert.ok(offsets.every(n=>Math.abs(n)<1));
  }
  await evaluate(ig,`const o=document.querySelector('._aajz');o.replaceWith(o.cloneNode(true));true`);await delay(500);
  assert.equal(await evaluate(ig,`document.querySelectorAll('#tile > [data-eagle-profile-tile]').length`),1);
  await evaluate(ig,`window.iconBefore=stableIcon.getBoundingClientRect().toJSON();document.querySelector('._aajz').style.cssText='position:absolute;top:40%;left:20%;width:60%;height:20%;background:#0005';true`);await delay(300);
  assert.equal(await evaluate(ig,`JSON.stringify(stableIcon.getBoundingClientRect().toJSON())===JSON.stringify(iconBefore)`),true);
  await click('#tile [data-eagle-profile-tile]');await screenshot('profile-native-overlay-firefox.png');
  await evaluate(ig,`document.querySelector('._aajz').remove();true`);await delay(400);
  assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-profile-tile]').length`),1);
  assert.equal(await evaluate(ig,`stableIcon===document.querySelector('[data-eagle-profile-tile]')&&JSON.stringify(stableIcon.getBoundingClientRect().toJSON())===JSON.stringify(iconBefore)`),true);
  console.log('PASS one stable tile anchor across letterboxing, tile sizes, and full-size/partial/missing native overlays');

  // Mouse focus is not keyboard focus. A mouse-down followed by dragging out
  // leaves focus behind without firing the download; it must not strand an icon.
  const brect=JSON.parse(await evaluate(ig,`JSON.stringify(stableIcon.getBoundingClientRect().toJSON())`));
  await send('input.performActions',{context:ig,actions:[{type:'pointer',id:'profile-mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',x:Math.round(brect.x+19),y:Math.round(brect.y+19),duration:0},{type:'pointerDown',button:0},{type:'pointerMove',x:900,y:50,duration:0},{type:'pointerUp',button:0}]}]});
  await delay(150);assert.equal(await evaluate(ig,`getComputedStyle(stableIcon).opacity`),'0');
  await evaluate(ig,`stableIcon.tabIndex=-1;stableIcon.focus();true`);await tab();await delay(100);
  assert.equal(await evaluate(ig,`stableIcon.hasAttribute('data-keyboard-focus')`),true);
  await click('#profile-info h2',10,10);await delay(100);
  assert.equal(await evaluate(ig,`getComputedStyle(stableIcon).opacity`),'0');
  console.log('PASS mouse focus cannot strand the icon after leaving; keyboard focus still reveals it');

  await evaluate(ig,`document.getElementById('profile-grid').append(document.getElementById('tile').cloneNode(true));true`);await delay(600);
  assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-profile-tile]').length`),2);
  assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-profile-all]').length`),0);
  await evaluate(ig,`history.pushState({},'','/');true`);await delay(800);
  assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-profile-tile],[data-eagle-profile-all]').length`),0);
  console.log('PASS lazy grid insertion, cloned stale controls, route cleanup without bulk header controls');
};
