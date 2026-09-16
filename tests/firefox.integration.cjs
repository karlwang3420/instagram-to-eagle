const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const work = path.resolve(__dirname, '../work');
fs.mkdirSync(work, { recursive: true });
const addonArgument = process.argv.slice(2).find(arg => !arg.startsWith('--'));
const addon = path.resolve(addonArgument || path.join(__dirname, '..'));
const delay = ms => new Promise(r => setTimeout(r, ms));
const testProfile = fs.mkdtempSync(path.join(work, 'firefox-run-'));
fs.copyFileSync(path.join(__dirname, 'firefox-profile.js'), path.join(testProfile, 'user.js'));
const port = 20000 + Math.floor(Math.random() * 10000);
const firefox = process.env.FIREFOX_BIN || (process.platform === 'win32' ? 'C:/Program Files/Mozilla Firefox/firefox.exe' : 'firefox');
const child = spawn(firefox, ['--headless', '--no-remote', '--profile', testProfile, '--remote-debugging-port', String(port), '--remote-allow-system-access', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = ''; child.stderr.on('data', d => { logs += d; }); child.stdout.on('data', d => { logs += d; });
let ws, id = 0; const pending = new Map();
const profileNetwork={pages:[],requests:[],status:200};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const n = ++id;
    const timer = setTimeout(() => { pending.delete(n); reject(new Error('Timed out: ' + method)); }, 25000);
    pending.set(n, { resolve, reject, timer }); ws.send(JSON.stringify({ id: n, method, params }));
  });
}
async function evaluate(context, expression) {
  const result = await send('script.evaluate', { expression, target: { context }, awaitPromise: true });
  if (result.type === 'exception') throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(context, expression, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(context, expression)) return;
    await delay(100);
  }
  assert.fail('Timed out waiting for: ' + expression);
}
async function controlRect(context, kind = 'media', code = 'B') {
  return JSON.parse(await evaluate(context, `JSON.stringify(document.querySelector('[data-eagle-control="${kind}"][data-eagle-post="${code}"]').getBoundingClientRect().toJSON())`));
}
async function clickControl(context, kind = 'media', code = 'B') {
  const r = await controlRect(context, kind, code);
  await send('input.performActions',{context,actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',x:Math.round(r.right-18),y:Math.round(r.top+18),duration:0},{type:'pointerDown',button:0},{type:'pointerUp',button:0}]}]});
}
(async () => {
  try {
    for (let i = 0; i < 100; i++) {
      try { ws = new WebSocket(`ws://127.0.0.1:${port}/session`); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }); break; }
      catch { if (i === 99) throw new Error('Firefox did not start: ' + logs.slice(-2000)); await delay(200); }
    }
    ws.onmessage = e => {
      const data = JSON.parse(e.data);
      if (data.id) {
        const p = pending.get(data.id); if (!p) return; pending.delete(data.id); clearTimeout(p.timer);
        data.type === 'error' ? p.reject(new Error(JSON.stringify(data))) : p.resolve(data.result);
      } else if (data.method === 'network.beforeRequestSent' && data.params.isBlocked) {
        const url = data.params.request.url;
        const api = url.includes('/api/v1/media/');
        const cdn = new URL(url).hostname !== 'www.instagram.com';
        const storyAPI = url.includes('/graphql/query/');
        const storyFeedAPI = /\/api\/v1\/feed\/user\/\d+\/story\//.test(url);
        const profileAPI = url.includes('/api/v1/users/web_profile_info/');
        if(profileNetwork.pages.length&&(profileAPI||/\/api\/v1\/feed\/user\/[^/]+\/username\//.test(url))){
          profileNetwork.requests.push(data.params.request);
          const body=profileAPI?{data:{user:{username:'artist'}}}:profileNetwork.pages[new URL(url).searchParams.has('max_id')?1:0];
          send('network.provideResponse',{request:data.params.request.request,statusCode:profileNetwork.status,headers:[{name:'Content-Type',value:{type:'string',value:'application/json'}}],body:{type:'base64',value:Buffer.from(JSON.stringify(body)).toString('base64')}}).catch(e=>console.error(e.message));
          return;
        }
        const body = cdn ? '<svg xmlns="http://www.w3.org/2000/svg" width="460" height="300"><rect width="460" height="300" fill="#789"/></svg>' : storyFeedAPI ? JSON.stringify({reel:storyFeedReel}) : storyAPI ? JSON.stringify({data:{reels_media:storyNetworkReels}}) : profileAPI ? JSON.stringify({data:{user:{id:'42',username:'artist'}}}) : api ? JSON.stringify({ items: [fixturePost] }) : fixture;
        send('network.provideResponse', { request: data.params.request.request, statusCode: storyAPI && failStoryGraphQL ? 403 : 200, headers: [{ name: 'Content-Type', value: { type: 'string', value: cdn ? 'image/svg+xml' : api || storyAPI || storyFeedAPI || profileAPI ? 'application/json' : 'text/html' } }], body: { type: 'base64', value: Buffer.from(body).toString('base64') } }).catch(e => console.error(e.message));
      }
    };
    const session = await send('session.new', { capabilities: { alwaysMatch: { acceptInsecureCerts: true } } });
    console.log('Firefox:', session.capabilities.browserVersion);
    const installed = await send('webExtension.install', { extensionData: { type: 'path', path: addon } });
    assert.equal(installed.extension, 'instagram-to-eagle@local.karl'); console.log('PASS actual Firefox temporary extension installation');
    await send('session.subscribe', { events: ['network.beforeRequestSent'] });
    await send('network.addIntercept', { phases: ['beforeRequestSent'], urlPatterns: ['www.instagram.com','s.cdninstagram.com','v.cdninstagram.com'].map(hostname=>({type:'pattern',protocol:'https',hostname})) });
    const { context: ig } = await send('browsingContext.create', { type: 'tab' });
    await send('browsingContext.navigate', { context: ig, url: 'https://www.instagram.com/', wait: 'complete' });
    const { context: popup } = await send('browsingContext.create', { type: 'tab' });
    await send('browsingContext.navigate', { context: popup, url: 'moz-extension://353c8f5f-334f-48b0-8ff5-80f36bda6801/popup.html', wait: 'complete' });
    const status = await evaluate(popup, `(async()=>{window.bg=await browser.runtime.getBackgroundPage(); const x=await bg.eagle('/api/application/info');return x.version})()`);
    assert.equal(typeof status, 'string'); console.log('PASS extension host permission and CSP reach the actual Eagle API (read only)');
    const preview = JSON.parse(await evaluate(popup, `(async()=>{const tabs=await browser.tabs.query({});window.igTab=tabs.find(t=>t.url==='https://www.instagram.com/');window.p=await bg.preview(igTab.id);return JSON.stringify(p)})()`));
    assert.equal(preview.author, 'artist'); assert.equal(preview.images, 2); assert.ok(preview.image.endsWith('/b.jpg'));
    console.log('PASS actual content script selects visible third slide and correct post');
    // The browser now uses real extension messaging and MAIN-world extraction.
    // Replace only the local Eagle transport, so no test assets enter the user's library.
    await evaluate(popup, `bg.fetch=async(url,opts)=>{if(opts?.method==='POST')bg.testPayload=JSON.parse(opts.body);return new Response(JSON.stringify({status:'success',data:String(url).includes('/api/folder/list')?[]:{version:'4.0.0'}}),{headers:{'content-type':'application/json'}})};true`);
    const payload = JSON.parse(await evaluate(popup, `(async()=>{await bg.route({type:'save',token:p.token,mode:'all'});return JSON.stringify(bg.testPayload)})()`));
    assert.equal(payload.items.length, 2); assert.equal(payload.items[1].url, 'https://s.cdninstagram.com/b.jpg');
    assert.ok(payload.items.every(item => item.annotation === ''));
    assert.equal(payload.items[0].name, '@artist · Full caption #illustration #設計 · 01');
    assert.equal(payload.items[0].website, 'https://www.instagram.com/p/B/');
    assert.deepEqual(payload.items[0].tags, ['Instagram', '@artist', 'illustration', '設計']);
    console.log('PASS all-images flow sends short titles, source links and automatic tags with blank annotations, excluding video and neighboring post');
    const currentPayload = JSON.parse(await evaluate(popup, `(async()=>{await bg.route({type:'save',token:p.token,mode:'current'});return JSON.stringify(bg.testPayload)})()`));
    assert.equal(currentPayload.items.length, 1); assert.equal(currentPayload.items[0].url, 'https://s.cdninstagram.com/b.jpg'); console.log('PASS current-image flow');
    if(process.argv.includes('--public-only')) {
      await require('./public-browser.cjs')({evaluate,send,ig,popup,delay,screenshot:async(name,clip,context=popup)=>{
        const shot=await send('browsingContext.captureScreenshot',{context,origin:'document',...(clip?{clip:{type:'box',...clip}}:{})});
        fs.writeFileSync(path.join(work,name),Buffer.from(shot.data,'base64'));
      }});
      console.log('ALL PUBLIC SETUP / SETTINGS CHECKS PASSED. Eagle imports were mocked.');
      return;
    }
    if(process.argv.includes('--post-regressions')) {
      await require('./post-regressions.cjs')({evaluate,send,ig,popup,delay});
      console.log('ALL POST REGRESSION CHECKS PASSED. Eagle imports were mocked.');
      return;
    }
    if(process.argv.includes('--profile-only')) {
      await require('./profile-browser.cjs')({evaluate,send,ig,popup,delay,profileNetwork,screenshot:async name=>{
        const shot=await send('browsingContext.captureScreenshot',{context:ig,origin:'viewport'});
        fs.writeFileSync(path.join(work,name),Buffer.from(shot.data,'base64'));
      }});
      console.log('ALL PROFILE CHECKS PASSED. Eagle imports were mocked.');
      return;
    }
    if(process.argv.includes('--toast-only')) {
      await require('./toast-browser.cjs')({evaluate,send,ig,popup,delay,screenshot:async name=>{
        const shot=await send('browsingContext.captureScreenshot',{context:ig,origin:'viewport'});
        fs.writeFileSync(path.join(work,name),Buffer.from(shot.data,'base64'));
      }});
      console.log('ALL NOTIFICATION CHECKS PASSED. Eagle imports were mocked.');
      return;
    }
    if(process.argv.includes('--carousel-only')) {
      await require('./carousel-browser.cjs')({evaluate,send,ig,popup,delay,screenshot:async name=>{
        const shot=await send('browsingContext.captureScreenshot',{context:ig,origin:'viewport'});
        fs.writeFileSync(path.join(work,name),Buffer.from(shot.data,'base64'));
      }});
      console.log('ALL STRUCTURAL CAROUSEL CHECKS PASSED. Eagle imports were mocked.');
      return;
    }
    const walked = JSON.parse(await evaluate(popup, `(async()=>{const ctx=await bg.selection(igTab.id);return JSON.stringify(await browser.tabs.sendMessage(igTab.id,{type:'eagle:carousel',marker:ctx.marker}))})()`));
    assert.equal(walked.ok, true); assert.deepEqual(walked.items.map(m=>m.type), ['image','video','image']);
    assert.equal(await evaluate(ig, 'window.slide'), 2); console.log('PASS carousel walk and restoration in Firefox');
    if(process.argv.includes('--binding')) {
      await send('browsingContext.activate',{context:ig});
      await evaluate(ig, `document.getElementById('post').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true}));document.querySelector('main').style.paddingBottom='1500px';window.scrollTo(0,document.getElementById('post').offsetHeight+150);true`);
      assert.ok(await evaluate(ig, `document.querySelector('#post .viewport').getBoundingClientRect().bottom<0`));
      const offscreen=JSON.parse(await evaluate(popup,`(async()=>JSON.stringify(await bg.selection(igTab.id,true)))()`));
      assert.equal(offscreen.code,'B');assert.equal(offscreen.current?.type,'image');assert.equal(offscreen.current.url,'https://s.cdninstagram.com/b.jpg');
      console.log('PASS active photo remains selected after the entire media frame scrolls off-screen');
      await evaluate(ig,`window.scrollTo(0,0);const hiddenVideo=document.createElement('video');hiddenVideo.src='https://v.cdninstagram.com/hidden.mp4';hiddenVideo.id='hidden-video';hiddenVideo.setAttribute('aria-hidden','true');hiddenVideo.style.cssText='position:absolute;inset:0;width:460px;height:300px';document.querySelector('#post .viewport').append(hiddenVideo);true`);
      const withHidden=JSON.parse(await evaluate(popup,`(async()=>JSON.stringify(await bg.selection(igTab.id,true)))()`));
      assert.equal(withHidden.current?.type,'image');assert.equal(withHidden.current.url,'https://s.cdninstagram.com/b.jpg');
      await evaluate(ig,`document.getElementById('hidden-video').remove();window.slide=1;render();true`);
      const videoSlide=JSON.parse(await evaluate(popup,`(async()=>JSON.stringify(await bg.selection(igTab.id,true)))()`));
      assert.equal(videoSlide.current?.type,'video');
      await evaluate(ig,`window.slide=2;render();const nestedLink=document.createElement('a');nestedLink.href='/p/B/';nestedLink.id='nested-post-link';document.querySelector('#post .viewport').append(nestedLink);const orphan=document.createElement('div');orphan.setAttribute('data-eagle-toolbar','');document.getElementById('post').append(orphan);const owner=document.createElement('div');owner.id='rerender-owner';document.getElementById('post').before(owner);owner.append(document.getElementById('post'));true`);
      await delay(700);
      assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-control="media"][data-eagle-post="B"]').length`),1);
      assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-control="media"]').length`),2);
      assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-toolbar]').length`),0);
      console.log('PASS nested matching links, orphan controls and wrapper changes leave one media control per post');
      await evaluate(ig,`document.getElementById('nested-post-link').remove();document.getElementById('rerender-owner').replaceWith(document.getElementById('post'));document.querySelector('main').style.paddingBottom='';true`);
      await delay(400);
    }
    if (process.argv.includes('--inline')) {
      await send('browsingContext.activate',{context:ig});
      await delay(400);
      assert.equal(await evaluate(ig, 'document.querySelectorAll("[data-eagle-control=media]").length'), 2);
      console.log('PASS media controls appear on div-based feed posts without article elements');
      await evaluate(ig, `const extra=document.getElementById('neighbor').cloneNode(true);extra.id='dynamic';extra.querySelector('[data-eagle-control]')?.remove();extra.querySelector('a[href*="/p/"]').href='/p/D/';document.querySelector('main').append(extra);extra.scrollIntoView();true`);
      for(let i=0;i<30;i++){if(await evaluate(ig,'document.querySelectorAll("[data-eagle-control=media][data-eagle-post=D]").length'))break;await delay(100);}
      assert.equal(await evaluate(ig, 'document.querySelectorAll("[data-eagle-control=media][data-eagle-post=D]").length'),1);
      await evaluate(ig, 'document.getElementById("dynamic").remove();window.scrollTo(0,0);true');
      await delay(300);
      assert.equal(await evaluate(ig, 'document.querySelectorAll("[data-eagle-control=media]").length'),2);
      console.log('PASS new posts get exactly one media control and removed posts are cleaned up');
      await send('browsingContext.activate',{context:ig});
      const frame=JSON.parse(await evaluate(ig,`JSON.stringify(document.querySelector('#post .viewport').getBoundingClientRect().toJSON())`));
      const bookmark=JSON.parse(await evaluate(ig,`JSON.stringify(document.querySelector('#post [aria-label="Save"]').getBoundingClientRect().toJSON())`));
      const mediaButton=await controlRect(ig), batchButton=await controlRect(ig,'all');
      assert.ok(Math.abs(mediaButton.right-(frame.right-12))<1);assert.ok(Math.abs(mediaButton.top-(frame.top+12))<1);
      assert.ok(Math.abs(batchButton.right-(bookmark.left-12))<1);assert.ok(Math.abs((batchButton.top+18)-(bookmark.top+bookmark.height/2))<1);
      await evaluate(ig,`window.scrollTo(0,20);true`);await delay(100);
      assert.ok(Math.abs((await controlRect(ig)).top-(mediaButton.top-20))<1);
      await evaluate(ig,`window.scrollTo(0,0);document.getElementById('instagram-eagle-status')?.remove();true`);await delay(300);
      console.log('PASS icon placement matches image top-right and bottom bookmark row, and tracks scrolling');
      assert.equal(await evaluate(ig,`document.querySelector('[data-eagle-control="all"][data-eagle-post="B"]').parentElement.parentElement === document.querySelector('#post .actions')`),true);
      assert.equal(await evaluate(ig,`getComputedStyle(document.querySelector('[data-eagle-control="all"][data-eagle-post="B"]')).position`),'relative');
      assert.equal(await evaluate(ig,`document.querySelector('[data-eagle-control="media"][data-eagle-post="B"]').parentElement === document.querySelector('#post .viewport')`),true);
      const shot=await send('browsingContext.captureScreenshot',{context:ig,origin:'viewport'});
      fs.writeFileSync(path.join(work,'inline-buttons-firefox.png'),Buffer.from(shot.data,'base64'));
      await evaluate(popup, 'bg.testPayload=null;true');
      await clickControl(ig);
      await delay(1600);
      const inlinePayload=JSON.parse(await evaluate(popup,'JSON.stringify(bg.testPayload)'));
      assert.equal(inlinePayload?.items?.length,1);assert.equal(inlinePayload.items[0].url,'https://s.cdninstagram.com/b.jpg');
      console.log('PASS trusted click on the in-post Current image button imports that exact slide');
      await evaluate(popup,'bg.testPayload=null;true');
      await clickControl(ig,'all');
      await delay(1600);
      const allPayload=JSON.parse(await evaluate(popup,'JSON.stringify(bg.testPayload)'));
      assert.equal(allPayload?.items?.length,3);
      console.log('PASS in-post All media button imports images and video from only the selected post');
      // At the last slide Instagram can remove Next and use an unlabeled back
      // button, then replace the entire media wrapper. Post identity must stick.
      await evaluate(ig,`window.slide=0;render();true`);await delay(300);
      await evaluate(ig,`window.slide=2;render();window.savedArrows=document.querySelector('#post .arrows').innerHTML;document.querySelector('#post [aria-label="Next"]').remove();document.querySelector('#post [aria-label="Previous"]').removeAttribute('aria-label');true`);
      await delay(500);
      assert.equal(await evaluate(ig,`getComputedStyle(document.querySelector('[data-eagle-control="media"][data-eagle-post="B"]')).visibility`),'visible');
      await evaluate(popup,'bg.testPayload=null;true');await clickControl(ig,'all');await delay(1600);
      const lastBatch=JSON.parse(await evaluate(popup,'JSON.stringify(bg.testPayload)'));
      assert.equal(lastBatch?.items?.length,3);
      await evaluate(popup,'bg.testPayload=null;true');await clickControl(ig);await delay(1600);
      const lastSingle=JSON.parse(await evaluate(popup,'JSON.stringify(bg.testPayload)'));
      assert.equal(lastSingle?.items?.length,1);assert.equal(lastSingle.items[0].url,'https://s.cdninstagram.com/b.jpg');
      await evaluate(ig,`window.originalPost=document.getElementById('post');const replacement=originalPost.cloneNode(true);replacement.__reactProps$fixture=originalPost.__reactProps$fixture;originalPost.replaceWith(replacement);true`);await delay(500);
      assert.equal(await evaluate(ig,`getComputedStyle(document.querySelector('[data-eagle-control="media"][data-eagle-post="B"]')).visibility`),'visible');
      await evaluate(popup,'bg.testPayload=null;true');await clickControl(ig,'all');await delay(1600);
      assert.equal(JSON.parse(await evaluate(popup,'JSON.stringify(bg.testPayload)'))?.items?.length,3);
      await evaluate(ig,`document.getElementById('post').replaceWith(originalPost);document.querySelector('#post .arrows').innerHTML=savedArrows;document.querySelector('#post [aria-label="Previous"]').onclick=()=>{window.slide--;render()};document.querySelector('#post [aria-label="Next"]').onclick=()=>{window.slide++;render()};render();true`);await delay(500);
      console.log('PASS last slide keeps current-image overlay and all-images action after Next removal, unlabeled Back, and whole-post replacement');
      // Instagram also uses a two-cell grid: left actions + bookmark wrapper.
      // Adding an unplanned third grid child used to push bookmark onto row two.
      await evaluate(ig, `const oldRow=document.querySelector('#post .actions');const row=document.createElement('section');row.className='actions';row.id='grid-actions';row.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) 40px;gap:12px;height:auto;margin-top:10px;width:460px';const left=document.createElement('div');left.id='left-actions';left.style.cssText='display:flex;align-items:center;gap:12px;width:100%';for(const b of oldRow.querySelectorAll('button:not([aria-label="Save"])'))left.append(b);const saved=document.createElement('span');saved.id='bookmark-cell';saved.style.cssText='display:block;width:40px';saved.append(oldRow.querySelector('[aria-label="Save"]'));row.append(left,saved);oldRow.replaceWith(row);window.bookmarkClicks=0;saved.querySelector('button').addEventListener('click',()=>window.bookmarkClicks++);true`);
      await delay(600);
      for (const width of [460,340,280]) {
        await evaluate(ig,`document.getElementById('grid-actions').style.width='${width}px';true`);
        await delay(100);
        const rects=JSON.parse(await evaluate(ig,`JSON.stringify(['#grid-actions','#left-actions button','#bookmark-cell button','#grid-actions [data-eagle-control="all"]'].map(s=>document.querySelector(s).getBoundingClientRect().toJSON()))`));
        const [row,left,bookmark,download]=rects;
        assert.ok(Math.abs((bookmark.top+bookmark.height/2)-(left.top+left.height/2))<1,'bookmark must stay on the native action baseline');
        assert.ok(Math.abs((download.top+download.height/2)-(bookmark.top+bookmark.height/2))<1,'download and bookmark must share one row');
        assert.ok(download.right<=bookmark.left && bookmark.right<=row.right+1,'both buttons must fit without overlap');
        assert.ok(row.height<=44,'action row must not grow a second line');
      }
      await evaluate(ig,`document.getElementById('grid-actions').style.width='460px';document.querySelector('#bookmark-cell button').click();true`);
      assert.equal(await evaluate(ig,'window.bookmarkClicks'),1);
      const gridShot=await send('browsingContext.captureScreenshot',{context:ig,origin:'viewport'});
      fs.writeFileSync(path.join(work,'bookmark-row-firefox.png'),Buffer.from(gridShot.data,'base64'));
      console.log('PASS two-column grid action row keeps download and original bookmark aligned at 460/340/280px without replacing the bookmark');
      await evaluate(ig, 'window.slide=1;render();true'); await delay(500);
      await evaluate(popup,'bg.testPayload=null;true');
      await clickControl(ig); await delay(1600);
      const slideVideo=JSON.parse(await evaluate(popup,'JSON.stringify(bg.testPayload)'));
      assert.equal(slideVideo?.items?.[0]?.url,'https://v.cdninstagram.com/video.mp4');
      assert.equal(slideVideo.items[0].website,'https://www.instagram.com/p/B/');
      console.log('PASS current-video circle downloads the selected timeline carousel video');
      await evaluate(ig,`const player=document.querySelector('#post .track video');const nested=document.createElement('article');nested.id='nested-video-slide';nested.style.cssText='flex:0 0 460px;width:460px;height:300px';nested.innerHTML='<a href="/p/B/" hidden>Same post</a>';player.before(nested);nested.append(player);true`);await delay(600);
      assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-control="all"][data-eagle-post="B"]').length`),1);
      assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-control="media"][data-eagle-post="B"]').length`),1);
      await evaluate(popup,'bg.testPayload=null;true');await clickControl(ig);await delay(1600);
      assert.equal(JSON.parse(await evaluate(popup,'JSON.stringify(bg.testPayload)'))?.items?.[0]?.url,'https://v.cdninstagram.com/video.mp4');
      await evaluate(ig,`window.slide=2;render();true`);await delay(400);
      assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-control="all"][data-eagle-post="B"]').length`),1);
      console.log('PASS mixed-carousel nested video article shares one control pair with image slides');

      // Arrow labels alone no longer classify a post as a carousel.
      for (const [label,postCode] of [['Go back','C'],['上一頁','LASTCN']]) {
        await evaluate(ig,`document.getElementById('neighbor').insertAdjacentHTML('beforeend','<button class="last-slide-back" aria-label="${label}" style="display:none">←</button>');true`);await delay(400);
        await waitFor(ig,`!!document.querySelector('[data-eagle-control="all"][data-eagle-post="${postCode}"]')`);
        assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-control="media"][data-eagle-post="${postCode}"]:not([hidden])').length`),0);
        await evaluate(ig,`document.querySelector('#neighbor .last-slide-back').remove();document.querySelector('#neighbor a[href*="/p/"]').href='/p/LASTCN/';true`);await delay(300);
      }

      // Replace a reused post wrapper with a single image, then a single blob video.
      for (const type of ['image','video']) {
        const singleCode=type==='image'?'SINGLEI':'SINGLEV';
        fixturePost = type === 'image' ? {pk:'1',code:'B',user:{username:'artist'},caption:{text:'Single image #reference'},...img('single')}
          : {...reelPost,product_type:'feed',caption:{text:'Timeline video #reference'}};
        fixturePost.code=singleCode;
        const mediaHTML = type === 'image' ? '<img width="460" height="300" src="https://s.cdninstagram.com/single.jpg">'
          : '<video width="460" height="300" src="blob:https://www.instagram.com/fixture"></video>';
        await evaluate(ig, `window.savedActions=document.querySelector('#post .actions')?.outerHTML||window.savedActions;document.getElementById('post').innerHTML='<header><a href="/artist/">artist</a><a href="/p/${singleCode}/">Post</a></header><div class="viewport">${mediaHTML}</div>'+window.savedActions;document.getElementById('post').__reactProps$fixture={post:${JSON.stringify(fixturePost)}};document.getElementById('instagram-eagle-status')?.remove();window.scrollTo(0,0);true`);
        await delay(600);
        assert.equal(await evaluate(ig, `getComputedStyle(document.querySelector('[data-eagle-control="media"][data-eagle-post="${singleCode}"]')).visibility`),'hidden');
        assert.equal(await evaluate(ig, `getComputedStyle(document.querySelector('[data-eagle-control="all"][data-eagle-post="${singleCode}"]')).visibility`),'visible');
        const bottom=await controlRect(ig,'all',singleCode);
        const bookmark=JSON.parse(await evaluate(ig,`JSON.stringify(document.querySelector('#post [aria-label="Save"]').getBoundingClientRect().toJSON())`));
        assert.ok(Math.abs(bottom.right-(bookmark.left-12))<1);
        assert.ok(Math.abs(bottom.top+18-(bookmark.top+bookmark.height/2))<1);
        await evaluate(popup,'bg.testPayload=null;true');
        await clickControl(ig,'all',singleCode);await delay(1600);
        const single=JSON.parse(await evaluate(popup,'JSON.stringify(bg.testPayload)'));
        assert.equal(single?.items?.length,1);
        assert.equal(single.items[0].url,type==='image'?'https://s.cdninstagram.com/single.jpg':'https://v.cdninstagram.com/reel.mp4');
        assert.equal(single.items[0].website,`https://www.instagram.com/p/${singleCode}/`);
        assert.equal(single.items[0].annotation,'');
        assert.deepEqual(single.items[0].tags,['Instagram','@artist','reference']);
        console.log(`PASS single ${type} has only one visible bottom button beside bookmark and imports the correct file`);
        if(type==='image') {
          const shot=await send('browsingContext.captureScreenshot',{context:ig,origin:'viewport'});
          fs.writeFileSync(path.join(work,'single-image-bottom-firefox.png'),Buffer.from(shot.data,'base64'));
        }
      }
      const timelinePreview=JSON.parse(await evaluate(popup,`(async()=>JSON.stringify(await bg.preview(igTab.id)))()`));
      assert.equal(timelinePreview.currentType,'video');assert.equal(timelinePreview.isReel,false);
    }
    // Expose a Reel as the selected post, with a blob player and direct URL in its data.
    await evaluate(ig, `document.getElementById('neighbor').remove();document.getElementById('post').innerHTML='<a href="/artist/">artist</a><a href="/reel/B/">Reel</a><video style="width:460px;height:300px" src="blob:https://www.instagram.com/fixture"></video>';document.getElementById('post').__reactProps$fixture={post:${JSON.stringify(reelPost)}};true`);
    fixturePost = reelPost;
    const reelPayload = JSON.parse(await evaluate(popup, `(async()=>{const p=await bg.preview(igTab.id);await bg.route({type:'save',token:p.token,mode:'reel'});return JSON.stringify(bg.testPayload)})()`));
    assert.equal(reelPayload.items[0].url, 'https://v.cdninstagram.com/reel.mp4'); assert.equal(reelPayload.items[0].website, 'https://www.instagram.com/reel/B/');
    console.log('PASS Reel flow resolves direct video behind a blob player');
    if(process.argv.includes('--inline')) {
      await send('browsingContext.activate',{context:ig});
      await delay(500);
      await evaluate(popup,'bg.testPayload=null;true');
      assert.equal(await evaluate(ig, `getComputedStyle(document.querySelector('[data-eagle-control="all"][data-eagle-post="B"]')).visibility`),'hidden');
      assert.equal(await evaluate(ig, `getComputedStyle(document.querySelector('[data-eagle-control="media"][data-eagle-post="B"]')).visibility`),'visible');
      await clickControl(ig);
      await delay(1600);
      const reelInline=JSON.parse(await evaluate(popup,'JSON.stringify(bg.testPayload)'));
      assert.equal(reelInline?.items?.[0]?.url,'https://v.cdninstagram.com/reel.mp4');
      console.log('PASS upper-right Save Reel control imports the Reel after feed navigation');
    }
    await send('script.evaluate', { expression: '(async()=>{await browser.tabs.update(igTab.id,{active:true});await browser.action.openPopup();return true})()', target: { context: popup }, awaitPromise: true, userActivation: true });
    await delay(1000);
    const popupState = JSON.parse(await evaluate(popup, `JSON.stringify(browser.extension.getViews({type:'popup'}).map(v=>({connection:v.document.getElementById('connection')?.textContent,hasDownload:!!v.document.querySelector('.actions'),folder:!!v.document.getElementById('folder'),tags:v.document.querySelectorAll('.tag-options input:checked').length})))`));
    assert.equal(popupState.length,1);assert.equal(popupState[0].connection,'Eagle 4.0.0 connected');
    assert.equal(popupState[0].hasDownload,false);assert.equal(popupState[0].folder,true);assert.equal(popupState[0].tags,3);
    const rejected=await evaluate(popup,`browser.extension.getViews({type:'popup'})[0].request({type:'save',token:p.token,mode:'reel'}).catch(e=>e.message)`);
    assert.match(rejected,/buttons on Instagram/);
    console.log('PASS settings-only toolbar popup and rejected popup download request');
    await evaluate(popup,`browser.extension.getViews({type:'popup'})[0].close();true`);
    await send('browsingContext.activate',{context:ig});
    const storyOwner = {pk:'42',username:'artist'};
    const storyItems = [{...img('101'),caption:{text:'Story image #art'}},{pk:'102',media_type:2,video_versions:[{url:'https://v.cdninstagram.com/story.mp4',width:1080,height:1920}]}];
    const storyReel = {id:'42',user:storyOwner,media_count:2,items:storyItems};
    await evaluate(ig,`history.pushState({},'','/stories/artist/102/');document.querySelector('main').style.cssText='width:100%;display:flex;align-items:center;justify-content:center;gap:20px';document.querySelector('main').innerHTML='<div id="story-neighbor" style="width:500px;height:580px;background:#777"><a href="/other/">other</a><img width="500" height="520" src="https://s.cdninstagram.com/wrong.jpg"></div><div id="story-viewer" style="position:relative;width:460px;height:620px;background:#53606a;flex:none"><header style="display:flex;align-items:center;padding:12px;justify-content:space-between"><a href="/artist/">artist</a><div id="playback-row" style="display:flex;align-items:center;gap:8px"><button aria-label="Mute" style="width:32px;height:32px">Mute</button><button aria-label="Pause" style="width:32px;height:32px">Ⅱ</button></div></header><div style="position:absolute;top:220px"><video width="460" height="180" src="blob:https://www.instagram.com/story"></video></div><span style="position:absolute;bottom:70px">Story caption</span></div>';document.querySelector('#story-viewer').__reactProps$story={reel:${JSON.stringify(storyReel)},neighbor:{id:'99',user:{username:'other'},items:[{pk:'999'}]}};document.getElementById('instagram-eagle-status')?.remove();window.scrollTo(0,0);true`);
    // On first entry the player/header can hydrate after the URL and DOM exist.
    // No slide navigation, clicks, or child replacements should be needed.
    await evaluate(ig,`document.getElementById('story-viewer').style.opacity='0';document.querySelectorAll('#playback-row button').forEach(b=>b.removeAttribute('aria-label'));true`);
    await delay(800);
    assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-post="102"]').length`),0);
    await evaluate(ig,`document.getElementById('story-viewer').style.opacity='1';document.querySelectorAll('#playback-row button').forEach((b,i)=>b.setAttribute('aria-label',i?'Pause':'Mute'));true`);
    await delay(800);
    for (const kind of ['media','all']) assert.equal(await evaluate(ig,`getComputedStyle(document.querySelector('[data-eagle-control="${kind}"][data-eagle-post="102"]')).visibility`),'visible');
    assert.equal(await evaluate(ig,'location.pathname'),'/stories/artist/102/');
    console.log('PASS first Story entry mounts controls after delayed labels/visibility without a next/back click');
    // CSSOM reveals do not create MutationObserver records. The bounded entry
    // retry must cover those too, including when re-entering the same Story.
    await evaluate(ig,`window.storySheet=document.styleSheets[0];window.storyRule=storySheet.insertRule('#story-viewer {opacity:0!important}',storySheet.cssRules.length);history.pushState({},'','/');true`);
    await waitFor(ig,`document.querySelectorAll('[data-eagle-post="102"]').length===0`);
    await evaluate(ig,`history.pushState({},'','/stories/artist/102/');true`);
    await delay(800);
    assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-post="102"]').length`),0);
    await evaluate(ig,`storySheet.deleteRule(storyRule);true`);
    await delay(900);
    assert.equal(await evaluate(ig,`document.querySelectorAll('#playback-row [data-eagle-control]').length`),2);
    console.log('PASS re-entering Stories mounts after a CSS-only reveal with no DOM mutation or slide navigation');
    const storyButton = async kind => JSON.parse(await evaluate(ig,`JSON.stringify(document.querySelector('[data-eagle-control="${kind}"][data-eagle-post="102"]').getBoundingClientRect().toJSON())`));
    const currentStoryRect = await storyButton('media'), allStoryRect = await storyButton('all');
    const muteRect = JSON.parse(await evaluate(ig,`JSON.stringify(document.querySelector('#story-viewer [aria-label="Mute"]').getBoundingClientRect().toJSON())`));
    assert.ok(currentStoryRect.right < allStoryRect.left && allStoryRect.right < muteRect.left);
    assert.ok(Math.abs(currentStoryRect.top+18-(muteRect.top+muteRect.height/2))<1);
    assert.equal(await evaluate(ig,`document.querySelector('[data-eagle-control="media"][data-eagle-post="102"]').parentElement.parentElement.id`),'playback-row');
    assert.equal(await evaluate(ig,`getComputedStyle(document.querySelector('[data-eagle-control="media"][data-eagle-post="102"]')).position`),'relative');
    const selectedStory=JSON.parse(await evaluate(popup,`(async()=>JSON.stringify(await bg.selection(igTab.id)))()`));
    assert.equal(selectedStory.author,'artist');assert.equal(selectedStory.current.type,'video');
    // Resize and re-render the native row: controls must remain actual children,
    // without viewport coordinates or a separate positioning animation loop.
    await evaluate(ig,`document.getElementById('story-viewer').style.width='420px';document.getElementById('playback-row').replaceWith(document.getElementById('playback-row').cloneNode(true));true`);
    await delay(600);
    assert.equal(await evaluate(ig,`document.querySelectorAll('#playback-row [data-eagle-control]').length`),2);
    assert.equal(await evaluate(ig,`document.querySelectorAll('#playback-row [data-eagle-group]').length`),1);
    assert.equal(await evaluate(ig,`document.querySelectorAll('#story-neighbor [data-eagle-control]').length`),0);
    const storyShot=await send('browsingContext.captureScreenshot',{context:ig,origin:'viewport'});
    fs.writeFileSync(path.join(work,'stories-controls-firefox.png'),Buffer.from(storyShot.data,'base64'));
    async function clickStory(kind) {
      const r = await storyButton(kind);
      await evaluate(popup,'bg.testPayload=null;true');
      await send('input.performActions',{context:ig,actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',x:Math.round(r.left+18),y:Math.round(r.top+18),duration:0},{type:'pointerDown',button:0},{type:'pointerUp',button:0}]}]});
      await delay(1800);
      return JSON.parse(await evaluate(popup,'JSON.stringify(bg.testPayload)'));
    }
    const currentStory = await clickStory('media');
    assert.equal(currentStory?.items?.length,1);assert.equal(currentStory.items[0].url,'https://v.cdninstagram.com/story.mp4');
    assert.equal(currentStory.items[0].website,'https://www.instagram.com/stories/artist/102/');
    const stories = await clickStory('all');
    assert.equal(stories?.items?.length,2);assert.equal(stories.items[0].website,'https://www.instagram.com/stories/artist/101/');
    assert.deepEqual(stories.items[0].tags,['Instagram','Story','@artist','art']);assert.ok(stories.items.every(item=>item.annotation===''));
    console.log('PASS letterboxed Story targets account header instead of larger neighboring media; controls are native row children through resize/re-render');
    await evaluate(ig,`delete document.getElementById('story-viewer').__reactProps$story;true`);
    await evaluate(ig,`document.getElementById('story-viewer').__reactFiber$story={memoizedProps:{},memoizedState:{data:{id:'102',is_video:true,video_resources:[{src:'https://v.cdninstagram.com/state-story.mp4',config_width:1080,config_height:1920}]}}};true`);
    const stateStory=await clickStory('media');assert.equal(stateStory?.items?.[0]?.url,'https://v.cdninstagram.com/state-story.mp4');
    await evaluate(ig,`delete document.getElementById('story-viewer').__reactFiber$story;true`);
    console.log('PASS GraphQL video_resources in React state resolves the selected Story video');
    storyNetworkReels=[{...storyReel,user:undefined,owner:storyOwner}];
    const networkStories = await clickStory('all');
    assert.equal(networkStories?.items?.length,2);
    console.log('PASS Stories same-origin profile/GraphQL fallback resolves the selected account only');
    storyFeedReel=storyReel;failStoryGraphQL=true;
    const feedStory=await clickStory('media');
    assert.equal(feedStory?.items?.[0]?.url,'https://v.cdninstagram.com/story.mp4');
    console.log('PASS account story endpoint resolves selected video when legacy GraphQL is unavailable');
    storyFeedReel=null;failStoryGraphQL=false;
    storyNetworkReels=[{id:'99',owner:{id:'99',username:'other'},items:storyItems}];
    const rejectedStories = await clickStory('all');assert.equal(rejectedStories,null);
    assert.match(await evaluate(ig,`document.getElementById('instagram-eagle-status').textContent`),/verify all stories/);
    console.log('PASS unrelated account data is rejected without sending a partial Stories batch');
    await evaluate(ig,`history.pushState({},'','/stories/artist/101/');document.querySelector('#story-viewer video').outerHTML='<img width="460" height="520" src="https://s.cdninstagram.com/101.jpg">';true`);
    await delay(700);
    const storyImage=JSON.parse(await evaluate(popup,`(async()=>{const p=await bg.preview(igTab.id);await bg.route({type:'save',token:p.token,mode:'story'});return JSON.stringify(bg.testPayload)})()`));
    assert.equal(storyImage.items[0].url,'https://s.cdninstagram.com/101.jpg');
    assert.equal(storyImage.items[0].website,'https://www.instagram.com/stories/artist/101/');
    assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-post="102"]').length`),0);
    console.log('PASS story navigation refreshes controls and current image has a safe DOM fallback');
    // Exact first-entry URL shape reported by the user: no numeric Story ID.
    const entryItems=[img('201'),img('202'),{pk:'303',media_type:2,video_versions:[{url:'https://v.cdninstagram.com/entry-story.mp4'}]}];
    const entryReel={id:'42',user:{pk:'42',username:'hori_hayung'},media_count:3,items:entryItems};
    await evaluate(ig,`history.pushState({},'','/stories/hori_hayung/');document.querySelector('#story-viewer header a').href='/hori_hayung/';document.querySelector('#story-viewer header a').textContent='hori_hayung';document.querySelector('#story-viewer img').src='https://s.cdninstagram.com/202.jpg';document.getElementById('story-viewer').__reactProps$entry={reel:${JSON.stringify(entryReel)}};true`);
    await delay(900);
    assert.equal(await evaluate(ig,`document.querySelectorAll('#playback-row [data-eagle-post="story-hori_hayung"]').length`),2);
    async function clickEntry(kind) {
      const r=JSON.parse(await evaluate(ig,`JSON.stringify(document.querySelector('[data-eagle-control="${kind}"][data-eagle-post="story-hori_hayung"]').getBoundingClientRect().toJSON())`));
      await evaluate(popup,'bg.testPayload=null;true');
      await send('input.performActions',{context:ig,actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',x:Math.round(r.left+18),y:Math.round(r.top+18),duration:0},{type:'pointerDown',button:0},{type:'pointerUp',button:0}]}]});
      await delay(1800);
      return JSON.parse(await evaluate(popup,'JSON.stringify(bg.testPayload)'));
    }
    const entryImage=await clickEntry('media');
    assert.equal(entryImage?.items?.length,1);assert.equal(entryImage.items[0].url,'https://s.cdninstagram.com/202.jpg');
    assert.equal(entryImage.items[0].website,'https://www.instagram.com/stories/hori_hayung/202/');
    const entryAll=await clickEntry('all');
    assert.equal(entryAll?.items?.length,3);
    assert.deepEqual(entryAll.items.map(item=>item.website),['201','202','303'].map(id=>`https://www.instagram.com/stories/hori_hayung/${id}/`));
    assert.equal(await evaluate(ig,'location.pathname'),'/stories/hori_hayung/');
    console.log('PASS username-only entry URL mounts both buttons and saves the visible second image or complete account batch without changing the URL');
    await evaluate(ig,`document.querySelector('#story-viewer img').outerHTML='<video width="460" height="180" src="blob:https://www.instagram.com/entry"></video>';document.querySelector('#story-viewer video').__reactProps$active={storyItem:${JSON.stringify(entryItems[2])}};true`);
    await delay(700);
    const entryVideo=await clickEntry('media');
    assert.equal(entryVideo?.items?.[0]?.url,'https://v.cdninstagram.com/entry-story.mp4');
    assert.equal(entryVideo.items[0].website,'https://www.instagram.com/stories/hori_hayung/303/');
    const entryPreview=JSON.parse(await evaluate(popup,`(async()=>JSON.stringify(await bg.preview(igTab.id)))()`));
    assert.equal(entryPreview.url,'https://www.instagram.com/stories/hori_hayung/303/');
    console.log('PASS username-only blob-video Story resolves its ID from the selected media element; popup preserves the resolved source');
    await evaluate(ig,`delete document.querySelector('#story-viewer video').__reactProps$active;true`);
    const ambiguous=await clickEntry('media');assert.equal(ambiguous,null);
    assert.match(await evaluate(ig,`document.getElementById('instagram-eagle-status').textContent`),/Could not resolve/);
    console.log('PASS ambiguous username-only blob player is rejected instead of choosing the first Story');
    // Real Firefox MAIN-world bridge, but the site's private request client is
    // mocked. No Instagram account mutation and no test imports into Eagle.
    await evaluate(ig,`delete document.getElementById('story-viewer').__reactProps$entry;
      document.querySelector('#story-viewer video').__reactFiber$player={memoizedProps:{postId:'303'}};
      window.storyPageCalls=[];
      window.storyAPIReel=${JSON.stringify(entryReel)};
      window.require=name=>{if(name!=='PolarisInstapi')throw new Error('Unexpected module');return {apiGet:async(route,options)=>{
        storyPageCalls.push({route,options});
        if(route==='/api/v1/feed/reels_tray/')return {data:{tray:[{user:{pk:'99',username:'other'}},{user:storyAPIReel.user}]}};
        if(route==='/api/v1/feed/reels_media/')return {data:{reels:{42:storyAPIReel},reels_media:[storyAPIReel]}};
        throw new Error('Unexpected endpoint');
      }}};true`);
    const apiVideo=await clickEntry('media');
    assert.equal(apiVideo?.items?.[0]?.url,'https://v.cdninstagram.com/entry-story.mp4');
    assert.equal(apiVideo.items[0].website,'https://www.instagram.com/stories/hori_hayung/303/');
    assert.deepEqual(JSON.parse(await evaluate(ig,'JSON.stringify(storyPageCalls.map(c=>c.route))')),['/api/v1/feed/reels_tray/','/api/v1/feed/reels_media/']);
    assert.ok(apiVideo.items.every(item=>item.annotation===''));
    console.log('PASS page-side API resolves ID-only blob player to correct third Story via trusted native-row click');
    const apiAll=await clickEntry('all');
    assert.equal(apiAll?.items?.length,3);
    assert.deepEqual(apiAll.items.map(item=>item.website),['201','202','303'].map(id=>`https://www.instagram.com/stories/hori_hayung/${id}/`));
    console.log('PASS page-side account batch retains each Story source URL and includes video');
    await evaluate(ig,`document.querySelector('#story-viewer video').__reactFiber$player={memoizedProps:{}};true`);
    const apiAmbiguous=await clickEntry('media');assert.equal(apiAmbiguous,null);
    console.log('PASS API list alone cannot cause current-Story action to import the first item');
    await evaluate(ig,`document.querySelector('#story-viewer video').__reactFiber$player={memoizedProps:{postId:'303'}};
      const stableRequire=window.require;
      window.require=name=>{const api=stableRequire(name);return {apiGet:async(...args)=>{
        const result=await api.apiGet(...args);
        document.querySelector('#story-viewer video').src='blob:https://www.instagram.com/next-story';
        document.querySelector('#story-viewer video').__reactFiber$player.memoizedProps={postId:'201'};
        return result;
      }}};true`);
    const apiAdvanced=await clickEntry('media');
    assert.equal(apiAdvanced?.items?.[0]?.url,'https://v.cdninstagram.com/entry-story.mp4');
    assert.equal(apiAdvanced.items[0].website,'https://www.instagram.com/stories/hori_hayung/303/');
    console.log('PASS autoplay during Story API response does not retarget the pending import');
    await require('./carousel-browser.cjs')({evaluate,send,ig,popup,delay,screenshot:async name=>{
      const shot=await send('browsingContext.captureScreenshot',{context:ig,origin:'viewport'});
      fs.writeFileSync(path.join(work,name),Buffer.from(shot.data,'base64'));
    }});
    console.log('ALL FIREFOX INTEGRATION CHECKS PASSED. Eagle imports were mocked.');
  } finally {
    if (ws?.readyState === WebSocket.OPEN) { try { await send('browser.close'); } catch {} ws.close(); }
    child.kill();
  }
})().catch(e => { console.error(e.stack); console.error(logs.slice(-1200)); process.exitCode = 1; });
const fixtureHTML = fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8');
const fixture = process.argv.includes('--inline') ? fixtureHTML.replaceAll('<article','<div').replaceAll('</article>','</div>').replace('article{','#post,#neighbor{') : fixtureHTML;
const img = id => ({pk:id,media_type:1,image_versions2:{candidates:[{url:`https://s.cdninstagram.com/${id}.jpg`,width:1080,height:1350}]}});
let fixturePost = { pk:'1',code:'B',media_type:8,carousel_media_count:3,user:{username:'artist'},caption:{text:'Full caption #illustration #設計'},carousel_media:[img('a'),{media_type:2,video_versions:[{url:'https://v.cdninstagram.com/video.mp4'}]},img('b')] };
const reelPost = {pk:'1',code:'B',media_type:2,product_type:'clips',user:{username:'artist'},caption:{text:'Reel caption'},has_audio:true,video_versions:[{url:'https://v.cdninstagram.com/reel.mp4',width:1080,height:1920}],clips_metadata:{music_info:{music_asset_info:{title:'Track',display_artist:'Musician'}}}};
let storyNetworkReels = [];
let storyFeedReel = null, failStoryGraphQL = false;
