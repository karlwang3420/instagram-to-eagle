const assert = require('node:assert/strict');
module.exports = async function({evaluate,send,ig,popup,delay,screenshot,waitFor}) {
  const img=pk=>({pk,media_type:1,image_versions2:{candidates:[{url:`https://s.cdninstagram.com/${pk}.jpg`}]}});
  const vid=(pk,url)=>({pk,media_type:2,image_versions2:img('shared-poster').image_versions2,video_versions:[{url}]});
  const post={code:'MIX',media_type:8,carousel_media_count:5,user:{username:'artist'},caption:{text:'Mixed #test'},
    carousel_media:[vid('v1','https://v.cdninstagram.com/first-video.mp4'),img('i2'),img('i3'),img('i4'),vid('v5','https://v.cdninstagram.com/last-video.mp4')]};
  await send('browsingContext.activate',{context:ig});
  await evaluate(ig,`history.pushState({},'','/');document.querySelector('main').style.cssText='width:500px;margin:10px auto';
    document.querySelector('main').innerHTML='<article id="structural"><header><a href="/artist/">artist</a><a href="/p/MIX/">Post</a></header><div id="structural-viewport" style="width:460px;height:300px;overflow:hidden;position:relative"><ul id="slides" style="display:flex;list-style:none;margin:0;padding:0;width:2300px;height:300px;transform:translateX(-1840px)"></ul></div><div id="dots"></div><section id="native-actions" style="display:flex;align-items:center;height:44px;gap:12px"><button aria-label="Like">Like</button><div role="button" id="native-bookmark" style="width:32px;height:36px;margin-left:auto"><svg width="24" height="24" viewBox="0 0 24 24"><polygon points="20 21 12 13.44 4 21 4 3 20 3 20 21" /></svg></div></section></article>';
    window.structuralPost=${JSON.stringify(post)};
    document.getElementById('structural').__reactProps$test={post:structuralPost};
    for(let i=0;i<5;i++) {
      const li=document.createElement('li');li.id='slide-'+(i+1);li.style.cssText='flex:0 0 460px;width:460px;height:300px';
      li.innerHTML=(i===0||i===4)?'<article style="margin:0;padding:0;border:0"><a href="/p/MIX/" hidden>same post</a><video width="460" height="300" src="blob:https://www.instagram.com/video-'+i+'" poster="https://s.cdninstagram.com/shared-poster.jpg"></video></article>':'<img width="460" height="300" src="https://s.cdninstagram.com/i'+(i+1)+'.jpg">';
      document.getElementById('slides').append(li);
      const dot=document.createElement('span');dot.className='_acnb'+(i===4?' _acnf':'');dot.style.cssText='display:inline-block;width:6px;height:6px;background:#777;margin:4px';document.getElementById('dots').append(dot);
    }
    window.structuralRender=index=>{document.getElementById('slides').style.transform='translateX('+(-460*(index-1))+'px)';document.querySelectorAll('#dots ._acnb').forEach((dot,i)=>dot.classList.toggle('_acnf',i===index-1));};
    document.getElementById('instagram-eagle-status')?.remove();window.scrollTo(0,0);true`);
  const settle=async()=>{await delay(650);};
  await settle();
  const selection=async()=>JSON.parse(await evaluate(popup,`(async()=>JSON.stringify(await bg.selection(igTab.id)))()`));
  const click=async(kind='media',code='MIX')=>{
    const r=JSON.parse(await evaluate(ig,`JSON.stringify([...document.querySelectorAll('[data-eagle-control="${kind}"][data-eagle-post="${code}"]')].find(el=>!el.hidden).getBoundingClientRect().toJSON())`));
    await evaluate(popup,'bg.testPayload=null;true');
    await send('input.performActions',{context:ig,actions:[{type:'pointer',id:'structural-mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',x:Math.round(r.left+18),y:Math.round(r.top+18),duration:0},{type:'pointerDown',button:0},{type:'pointerUp',button:0}]}]});
    await waitFor(popup,'bg.testPayload!==null');
    const payload=JSON.parse(await evaluate(popup,'JSON.stringify(bg.testPayload)'));
    assert.ok(payload,await evaluate(ig,`document.getElementById('instagram-eagle-status')?.textContent || 'No import or status from click'`));
    return payload;
  };
  let selected=await selection();
  assert.equal(selected.slideIndex,5);assert.equal(selected.slideCount,5);assert.equal(selected.current.type,'video');
  assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-control="media"][data-eagle-post="MIX"]').length`),5);
  assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-control="all"][data-eagle-post="MIX"]').length`),1);
  assert.equal(await evaluate(ig,`document.querySelectorAll('#slide-5 > [data-eagle-control="media"]:not([hidden])').length`),1);
  assert.equal(await evaluate(ig,`document.querySelector('[data-eagle-control="all"][data-eagle-post="MIX"]').parentElement.parentElement.id`),'native-actions');
  assert.equal((await click()).items[0].url,'https://v.cdninstagram.com/last-video.mp4');
  assert.equal((await click('all')).items.length,5);
  console.log('PASS fresh last-slide entry without arrows: five stable slide anchors, one native bookmark batch button, correct last of two identical-poster videos');
  if(screenshot) await screenshot('structural-carousel-firefox.png');
  // The same node stays attached to its slide through every selection change.
  await evaluate(ig,`window.lastSlideControl=document.querySelector('#slide-5 > [data-eagle-control]');structuralRender(1);true`);await settle();
  assert.equal((await selection()).slideIndex,1);
  assert.equal((await click()).items[0].url,'https://v.cdninstagram.com/first-video.mp4');
  await evaluate(ig,`structuralRender(3);true`);await settle();
  assert.equal((await click()).items[0].url,'https://s.cdninstagram.com/i3.jpg');
  await evaluate(ig,`structuralRender(5);true`);await settle();
  assert.equal(await evaluate(ig,`lastSlideControl===document.querySelector('#slide-5 > [data-eagle-control]')`),true);
  console.log('PASS pagination drives image/video selection while each overlay remains bound to its original slide');
  // Active dot and track disagree while a transition is in flight.
  await evaluate(ig,`document.querySelectorAll('#dots ._acnb').forEach((dot,i)=>dot.classList.toggle('_acnf',i===0));true`);await settle();
  await assert.rejects(selection(),/changing slides/);
  await evaluate(ig,`structuralRender(5);true`);await settle();
  // Virtualized DOM contains only slides 4 and 5; index must stay 5, not 2.
  await evaluate(ig,`for(let i=1;i<=3;i++)document.getElementById('slide-'+i).remove();document.getElementById('slides').style.width='920px';document.getElementById('slides').style.transform='translateX(-460px)';true`);await settle();
  selected=await selection();assert.equal(selected.slideIndex,5);assert.equal(selected.slideCount,5);
  assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-control="media"][data-eagle-post="MIX"]').length`),2);
  assert.equal((await click()).items[0].url,'https://v.cdninstagram.com/last-video.mp4');
  await evaluate(ig,`document.getElementById('slide-4').remove();document.getElementById('slides').style.width='460px';document.getElementById('slides').style.transform='none';true`);await settle();
  assert.equal((await selection()).slideIndex,5);
  assert.equal((await click()).items[0].url,'https://v.cdninstagram.com/last-video.mp4');
  console.log('PASS virtualized two-slide and one-slide DOM retain full pagination index; transition mismatch is rejected');
  // Replace the full post, including cloned stale hosts (without shadow roots).
  await evaluate(ig,`const old=document.getElementById('structural');const clone=old.cloneNode(true);clone.__reactProps$test={post:structuralPost};window.staleCloneControl=clone.querySelector('[data-eagle-control="media"]');old.replaceWith(clone);true`);
  for(let n=0;n<50;n++) {
    if(await evaluate(ig,`!!document.querySelector('#structural [data-eagle-control="media"]') && document.querySelector('#structural [data-eagle-control="media"]')!==staleCloneControl`)) break;
    await delay(100);
  }
  await settle();
  assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-control="all"][data-eagle-post="MIX"]').length`),1);
  assert.equal((await click()).items[0].url,'https://v.cdninstagram.com/last-video.mp4');
  console.log('PASS whole-post rerender removes orphan controls and binds one live batch control to the bookmark');
  // Timeline pagination / loaded slide windows are not the full media count.
  // Capture a visible lower-resolution rendition of the eighth image, while
  // only one slide and five dots remain mounted. Use real on-page button clicks.
  await evaluate(ig,`window.structuralPost={...structuralPost,carousel_media_count:8,carousel_media:Array.from({length:8},(_,i)=>({pk:'photo'+(i+1),media_type:1,image_versions2:{candidates:[{url:'https://s.cdninstagram.com/photo'+(i+1)+'.jpg',width:1080,height:1080},{url:'https://s.cdninstagram.com/photo'+(i+1)+'-small.jpg',width:460,height:460}]}}))};
    document.getElementById('structural').__reactProps$test={post:structuralPost};
    document.getElementById('slide-5').innerHTML='<img width="460" height="300" src="https://s.cdninstagram.com/photo8-small.jpg">';true`);
  await settle();
  selected=await selection();assert.equal(selected.slideIndex,5);assert.equal(selected.slideCount,5);
  assert.equal((await click()).items[0].url,'https://s.cdninstagram.com/photo8.jpg');
  // New/unrecognized dot classes: only the mounted two-slide window is counted.
  await evaluate(ig,`document.getElementById('dots').innerHTML='';document.getElementById('slides').innerHTML='<li style="flex:0 0 460px;width:460px;height:300px"><img width="460" height="300" src="https://s.cdninstagram.com/photo7-small.jpg"></li><li style="flex:0 0 460px;width:460px;height:300px"><img width="460" height="300" src="https://s.cdninstagram.com/photo8-small.jpg"></li>';document.getElementById('slides').style.cssText='display:flex;list-style:none;margin:0;padding:0;width:920px;height:300px;transform:translateX(-460px)';true`);
  await settle();
  selected=await selection();assert.equal(selected.slideIndex,2);assert.equal(selected.slideCount,2);
  assert.equal((await click()).items[0].url,'https://s.cdninstagram.com/photo8.jpg');
  assert.equal((await click('all')).items.length,8);
  // If Instagram doesn't expose the rendition mapping, save the actual visible
  // source; never substitute media #2 just because two DOM slides are mounted.
  await evaluate(ig,`document.querySelector('#slides li:last-child img').src='https://s.cdninstagram.com/visible-unmapped.jpg';true`);await settle();
  assert.equal((await click()).items[0].url,'https://s.cdninstagram.com/visible-unmapped.jpg');
  console.log('PASS timeline windowed dots, virtualized slides and unmatched rendition save the clicked image; complete-post batch still saves all eight');
  // Reported mixed-media timeline shape: a blob video without a poster, with
  // only two mounted slides out of eight. The active player's ID is not the
  // DOM window's second slot. Multiple videos prevent a first-video shortcut.
  await evaluate(ig,`structuralPost.code='DdWVJNUk2Q1';structuralPost.carousel_media[0]={pk:'101',media_type:2,video_versions:[{url:'https://v.cdninstagram.com/first.mp4'}]};structuralPost.carousel_media[7]={pk:'108',media_type:2,video_versions:[{url:'https://v.cdninstagram.com/eighth.mp4'}]};document.querySelector('#structural header a[href*="/p/"]').href='/p/DdWVJNUk2Q1/';document.querySelector('#slides li:last-child').innerHTML='<video width="460" height="300" src="blob:https://www.instagram.com/selected-video"></video>';window.selectedPlayer=document.querySelector('#slides video');selectedPlayer.__reactFiber$fixture={memoizedProps:{},return:{memoizedProps:{videoFBID:'108'},return:{memoizedProps:{post:structuralPost}}}};true`);
  await settle();
  selected=await selection();assert.equal(selected.slideCount,2);assert.equal(selected.current.type,'video');assert.equal(selected.current.preview,'');
  let saved=await click('media','DdWVJNUk2Q1');assert.equal(saved.items.length,1);assert.equal(saved.items[0].url,'https://v.cdninstagram.com/eighth.mp4');
  assert.equal(saved.items[0].website,'https://www.instagram.com/p/DdWVJNUk2Q1/');
  await evaluate(ig,`selectedPlayer.src='blob:https://www.instagram.com/first-video';selectedPlayer.__reactFiber$fixture.return={key:'101_42',memoizedProps:{}};true`);await settle();
  saved=await click('media','DdWVJNUk2Q1');assert.equal(saved.items.length,1);assert.equal(saved.items[0].url,'https://v.cdninstagram.com/first.mp4');
  assert.equal((await click('all','DdWVJNUk2Q1')).items.length,8);
  console.log('PASS no-poster mixed timeline blob videos use nearest player ID / compound key, retain the reported source URL, and keep whole-post downloads intact');
};
