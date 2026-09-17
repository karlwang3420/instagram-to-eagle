const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
module.exports=async({evaluate,send,ig,popup,delay,screenshot})=>{
  const base='moz-extension://353c8f5f-334f-48b0-8ff5-80f36bda6801/';
  assert.equal(await evaluate(popup,`(async()=>!!(await browser.tabs.query({})).find(t=>t.url===browser.runtime.getURL('popup/popup.html?setup=1')))()`),true,'First install opens setup');
  await send('browsingContext.navigate',{context:popup,url:base+'popup/popup.html?setup=1',wait:'complete'});
  await evaluate(popup,`(async()=>{const tab=await browser.tabs.getCurrent();await browser.tabs.update(tab.id,{active:true});return true;})()`);
  await evaluate(popup,`(async()=>{window.bg=await browser.runtime.getBackgroundPage();bg.uiRequests=[];bg.fetch=async(url,opts)=>{bg.uiRequests.push({url,method:opts?.method});if(opts?.method==='POST')bg.testPayload=JSON.parse(opts.body);return new Response(JSON.stringify({status:'success',data:String(url).includes('/api/folder/list')?[{id:'F1',name:'References',children:[]}]:{version:'4.0.0'}}));};await refresh();return true;})()`);
  const waitFor=async expression=>{for(let i=0;i<60;i++){if(await evaluate(popup,expression))return;await delay(100);}assert.fail(await evaluate(popup,`document.body.innerText`));};
  const click=async selector=>{
    const result=await send('script.evaluate',{expression:`document.querySelector(${JSON.stringify(selector)}).click();true`,target:{context:popup},awaitPromise:true,userActivation:true});
    assert.notEqual(result.type,'exception',JSON.stringify(result));
  };
  const capture=async(name,compact=false)=>{
    if(!screenshot)return;
    const markup=await evaluate(popup,`(()=>{const clone=document.querySelector('.sheet').cloneNode(true);for(const input of clone.querySelectorAll('input')){input.toggleAttribute('checked',document.getElementById(input.id).checked);}for(const option of clone.querySelectorAll('select option')){option.toggleAttribute('selected',option.value===document.getElementById('folder').value);}clone.querySelector('img').src=${JSON.stringify('data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'../../icons/icon-48.png')).toString('base64'))};return clone.outerHTML;})()`);
    // Firefox BiDi cannot screenshot privileged extension scopes. Render the
    // actual menu DOM/state + exact packaged CSS in the isolated fixture tab.
    await evaluate(ig,`(()=>{document.head.innerHTML='';document.body.innerHTML=${JSON.stringify(markup)};document.body.className=${JSON.stringify(compact?'':'setup-page')};const style=document.createElement('style');style.textContent=${JSON.stringify(fs.readFileSync(path.join(__dirname,'../../popup/popup.css'),'utf8'))};document.head.append(style);document.getElementById('instagram-eagle-status')?.remove();return true;})()`);
    await send('browsingContext.activate',{context:ig});
    await send('browsingContext.setViewport',{context:ig,viewport:{width:900,height:1100}});
    await delay(200);
    await evaluate(ig,`document.getElementById('instagram-eagle-status')?.remove();true`);
    await screenshot(name,compact?{x:0,y:0,width:380,height:await evaluate(ig,'document.body.getBoundingClientRect().height')}:null,ig);
  };
  assert.equal(await evaluate(popup,`document.querySelectorAll('.tag-options input:checked').length`),3);
  assert.equal(await evaluate(popup,`document.querySelector('.tag-options input').id`),'tagDefaults');
  assert.equal(await evaluate(popup,`document.getElementById('tags')===null`),true);
  await evaluate(popup,`document.getElementById('folder').value='F1';document.getElementById('folder').dispatchEvent(new Event('change'));true`);
  await waitFor(`(async()=>(await browser.storage.local.get('folderId')).folderId==='F1')()`);
  await click('label:has(#tagHashtags)');await click('label:has(#tagCreator)');await click('label:has(#tagDefaults)');
  await waitFor(`(async()=>{const s=await browser.storage.local.get();return s.tagHashtags===false&&s.tagCreator===false&&s.tagDefaults===false&&s.folderId==='F1';})()`);
  await send('browsingContext.reload',{context:popup,wait:'complete'});
  // Rebind mock transport after reloading its owning test realm.
  await evaluate(popup,`(async()=>{window.bg=await browser.runtime.getBackgroundPage();bg.uiRequests=[];bg.fetch=async(url,opts)=>{bg.uiRequests.push({url,method:opts?.method});return new Response(JSON.stringify({status:'success',data:String(url).includes('/api/folder/list')?[{id:'F1',name:'References'}]:{version:'4.0.0'}}));};await refresh();return true;})()`);
  await waitFor(`document.querySelectorAll('.tag-options input:checked').length===0 && document.getElementById('folder').value==='F1'`);
  assert.deepEqual(JSON.parse(await evaluate(popup,`(async()=>{const s=await bg.importSettings();return JSON.stringify(bg.EagleCore.payload({meta:{postURL:'https://www.instagram.com/p/A/',author:'artist',caption:'#art'}},[{url:'https://s.cdninstagram.com/a.jpg'}],s).items[0].tags);})()`)),[]);
  console.log('PASS all tag switches default on; all off persists across reopening and produces zero tags; destination is retained');
  // Revoking a real grant must stop the background before any local HTTP call.
  assert.equal(await evaluate(popup,`browser.permissions.remove({origins:['http://127.0.0.1/*']})`),true);
  await waitFor(`!document.getElementById('accessPanel').hidden && document.getElementById('eagleAccess').textContent==='Needed'`);
  await evaluate(popup,`bg.uiRequests=[];true`);
  assert.match(await evaluate(popup,`bg.eagle('/api/item/addFromURLs',{items:[]}).then(()=>'',e=>e.message)`),/Allow access.*Nothing was sent/);
  assert.equal(await evaluate(popup,`bg.uiRequests.length`),0);
  assert.equal(await evaluate(popup,`browser.action.getBadgeText({})`),'!');
  await click('label:has(#tagCreator)');
  await waitFor(`(async()=>(await browser.storage.local.get('tagCreator')).tagCreator===true)()`);
  assert.equal(await evaluate(popup,`(async()=>(await browser.storage.local.get('folderId')).folderId)()`),'F1');
  // Exercise explicit denial without invoking the headless auto-grant prompt.
  await evaluate(popup,`window.nativeRequest=browser.permissions.request;browser.permissions.request=async()=>false;true`);
  await click('#grantAccess');await waitFor(`document.getElementById('accessStatus').textContent.includes('not granted')`);
  assert.equal(await evaluate(popup,`(async()=>(await EagleAccess.state()).ready)()`),false);
  await evaluate(popup,`browser.permissions.request=nativeRequest;true`);
  await capture('setup-access-needed.png');
  // Firefox BiDi refuses native pointer actions on extension pages, and its
  // synthetic activation does not satisfy permissions.request. Model the native
  // approval boundary only; real revocation and background preflight ran above.
  await evaluate(popup,`window.nativeContains=browser.permissions.contains;window.bgNativeContains=bg.browser.permissions.contains;browser.permissions.request=async spec=>{window.requestedOrigins=spec.origins;browser.permissions.contains=async p=>p.origins.every(x=>EagleAccess.origins.includes(x));bg.browser.permissions.contains=async p=>p.origins.every(x=>EagleAccess.origins.includes(x));await bg.updateAccessBadge();return true;};true`);
  await click('#grantAccess');await waitFor(`document.getElementById('grantAccess').hidden && document.getElementById('connection').textContent==='Eagle connected'`);
  assert.deepEqual(JSON.parse(await evaluate(popup,'JSON.stringify(requestedOrigins)')),['https://www.instagram.com/*','https://instagram.com/*','http://127.0.0.1/*']);
  assert.equal(await evaluate(popup,`(async()=>(await EagleAccess.state()).ready)()`),true);
  await waitFor(`(async()=>(await browser.action.getBadgeText({}))==='')()`);
  console.log('PASS real revocation blocks POST; offline tag changes preserve folder; simulated native approval/denial updates setup and requests only declared origins');
  await click('label:has(#tagHashtags)');await click('label:has(#tagDefaults)');
  await waitFor(`document.querySelectorAll('.tag-options input:checked').length===3`);
  await capture('setup-ready.png');
  // Render exactly the compact popup CSS without changing its markup or scripts.
  await evaluate(popup,`document.body.classList.remove('setup-page');document.getElementById('accessPanel').hidden=true;true`);
  await capture('menu.png',true);
  assert.ok(await evaluate(popup,'document.body.getBoundingClientRect().height')<600,'Popup fits without scrolling');
  assert.equal(await evaluate(popup,`document.querySelector('.sheet').scrollWidth<=380`),true);
  console.log('PASS compact menu has no horizontal overflow and fits below 600px; setup and compact screenshots captured');
};
