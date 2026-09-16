const assert=require('node:assert/strict');
module.exports=async({evaluate,send,ig,popup,delay})=>{
  const wait=async expr=>{for(let i=0;i<50;i++){if(await evaluate(ig,expr))return;await delay(100);}assert.fail(expr);};
  const click=async selector=>{
    const r=JSON.parse(await evaluate(ig,`JSON.stringify(document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().toJSON())`));
    await send('input.performActions',{context:ig,actions:[{type:'pointer',id:'regression-mouse',parameters:{pointerType:'mouse'},actions:[
      {type:'pointerMove',x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),duration:0},{type:'pointerDown',button:0},{type:'pointerUp',button:0}
    ]}]});
  };
  await send('browsingContext.activate',{context:ig});
  await send('browsingContext.setViewport',{context:ig,viewport:{width:1100,height:850}});
  const post={code:'A',media_type:8,carousel_media_count:2,user:{username:'artist'},caption:{text:'Selected #art'},carousel_media:[
    {pk:'1',media_type:1,image_versions2:{candidates:[{url:'https://s.cdninstagram.com/selected.jpg',width:1400,height:1800}]}},
    {pk:'2',media_type:2,video_versions:[{url:'https://v.cdninstagram.com/selected.mp4',width:1080,height:1920}]}
  ]};
  await evaluate(ig,`history.pushState({},'','/p/A/');document.querySelector('main').style.cssText='width:900px;margin:20px auto';
    document.querySelector('main').innerHTML='<div role="dialog"><article id="detail" style="display:flex"><div id="picture" style="width:460px;height:550px;flex:none;position:relative;overflow:hidden"><ul style="list-style:none;margin:0;padding:0;display:flex;width:920px"><li style="width:460px;flex:none"><img width="460" height="550" src="https://s.cdninstagram.com/selected.jpg"></li><li style="width:460px;flex:none"><video width="460" height="550" src="https://v.cdninstagram.com/selected.mp4"></video></li></ul><button aria-label="Next" style="position:absolute;right:8px;top:45%">Next</button></div><aside id="sidebar" style="width:330px;padding:12px;display:flex;flex-direction:column"><a href="/artist/">artist</a><a href="/p/A/"><time>1w</time></a><div id="comments"><p>A comment</p><img width="180" height="180" src="https://s.cdninstagram.com/comment.gif"><p>Another comment</p><img width="180" height="180" src="https://s.cdninstagram.com/comment2.gif"></div><section id="native-row" style="display:flex;align-items:center;margin-top:auto"><button aria-label="Like">Like</button><button aria-label="Comment">Comment</button><button aria-label="Save" style="margin-left:auto">Save</button></section></aside></article></div>';
    document.getElementById('detail').__reactProps$fixture={post:${JSON.stringify(post)}};
    window.scrollTo(0,0);true`);
  await wait(`document.querySelectorAll('[data-eagle-control="all"]:not([hidden])').length>0`);
  await delay(600);
  assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-control="all"]:not([hidden])').length`),1,'GIF comments must not create a second bottom action');
  assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-group]').length`),1);
  assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-control="media"]:not([hidden])').length`),1);
  await evaluate(popup,'bg.testPayload=null;true');
  await click('[data-eagle-control="all"]:not([hidden])');await delay(1200);
  const saved=JSON.parse(await evaluate(popup,'JSON.stringify(bg.testPayload)'));
  assert.equal(saved.items.length,2);assert.ok(saved.items.every(x=>!x.url.includes('comment')));
  assert.equal(saved.items[1].url,'https://v.cdninstagram.com/selected.mp4');
  // Re-render the entire sidebar and make its GIF larger; still one owner,
  // with the actual post media larger than the comment attachment.
  await evaluate(ig,`const s=document.getElementById('sidebar');s.replaceWith(s.cloneNode(true));document.querySelector('#comments img').width=220;true`);await delay(500);
  assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-control="all"]:not([hidden])').length`),1);
  assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-group]').length`),1);
  console.log('PASS opened carousel with nested GIF-comment sidebar has one current-media and one batch control; batch excludes comment GIFs after rerender');

  // A lone icon without Instagram stats is valid UI. Its full post must still
  // resolve after the primary response contains children with IDs but no files.
  const partial={...post,carousel_media:[{pk:'1',media_type:1},{pk:'2',media_type:2}]};
  await evaluate(ig,`history.pushState({},'','/artist/');document.querySelector('main').innerHTML='<header><h2>artist</h2></header><a id="grid-post" href="/p/A/" style="position:relative;display:block;width:238px;height:310px"><img width="238" height="310" src="https://s.cdninstagram.com/thumbnail.jpg"></a>';
    window.loaderCalls=0;window.queryCode='';document.getElementById('grid-post').__reactProps$fixture={post:${JSON.stringify(partial)}};
    window.require=name=>{
      if(name==='PolarisInstapi')return {apiGet:async()=>({data:{items:[${JSON.stringify(partial)}]}})};
      if(name==='PolarisRelayEnvironment')return {};
      if(name==='PolarisPostActionLoadPostQuery')return {POST_QUERY:{}};
      if(name==='CometRelay')return {fetchQuery:(env,q,vars)=>{loaderCalls++;queryCode=vars.shortcode;return {toPromise:async()=>({xdt_shortcode_media:{__fragments:{PolarisPostActionLoadPostQueryInlineFragmentWithoutRelatedProfiles:${JSON.stringify(post)}}}})}}};
      throw new Error('No module');
    };true`);
  await wait(`document.querySelectorAll('[data-eagle-profile-tile]').length===1`);await delay(300);
  await evaluate(popup,'bg.testPayload=null;true');
  await click('[data-eagle-profile-tile]');await delay(1500);
  const gridSaved=JSON.parse(await evaluate(popup,'JSON.stringify(bg.testPayload)'));
  assert.equal(gridSaved?.items?.length,2,await evaluate(ig,`document.getElementById('instagram-eagle-status')?.textContent`));
  assert.equal(gridSaved.items[1].url,'https://v.cdninstagram.com/selected.mp4');
  assert.equal(await evaluate(ig,'loaderCalls'),1);assert.equal(await evaluate(ig,'queryCode'),'A');
  assert.equal(await evaluate(ig,'location.pathname'),'/artist/');
  assert.equal(await evaluate(ig,`document.querySelectorAll('[data-eagle-profile-all]').length`),0);
  console.log('PASS lone hover icon resolves full mixed post through native loader and sends only selected files without navigation or bulk feature');

  const longCode='Cml1XsiSDMVpa0s418I3lIZLYF-WZyoe2aXaM00',shortCode='Cml1XsiSDMV';
  const expectedPath='/api/v1/media/3001039451545154325/info/';
  const longPost={...post,code:shortCode,pk:'3001039451545154325'};
  const longPartial={...partial,code:shortCode,pk:'3001039451545154325'};
  for(const method of ['info','relay']){
    await evaluate(ig,`document.getElementById('grid-post').href='/p/${longCode}/';
      document.getElementById('grid-post').__reactProps$fixture={post:${JSON.stringify(longPartial)}};
      window.infoPath='';window.queryCode='';window.loaderCalls=0;
      window.require=name=>{
        if(name==='PolarisInstapi')return {apiGet:async path=>{infoPath=path;return {data:{items:path===${JSON.stringify(expectedPath)}?[${JSON.stringify(method==='info'?longPost:longPartial)}]:[]}}}};
        if(name==='PolarisRelayEnvironment')return {};
        if(name==='PolarisPostActionLoadPostQuery')return {POST_QUERY:{}};
        if(name==='CometRelay')return {fetchQuery:(env,q,vars)=>{loaderCalls++;queryCode=vars.shortcode;return {toPromise:async()=>({xdt_shortcode_media:{__fragments:{PolarisPostActionLoadPostQueryInlineFragment:vars.shortcode===${JSON.stringify(shortCode)}?${JSON.stringify(longPost)}:null}}})}}};
        throw new Error('No module');
      };true`);
    await delay(300);await evaluate(popup,'bg.testPayload=null;true');
    await click('[data-eagle-profile-tile]');await delay(1500);
    const longSaved=JSON.parse(await evaluate(popup,'JSON.stringify(bg.testPayload)'));
    assert.equal(await evaluate(ig,'infoPath'),expectedPath,'Extended URL must not be decoded as a 39-character media ID');
    assert.equal(longSaved?.items?.length,2,await evaluate(ig,`document.getElementById('instagram-eagle-status')?.textContent`));
    assert.ok(longSaved.items.every(x=>x.website==='https://www.instagram.com/p/'+longCode+'/'));
    assert.equal(await evaluate(ig,'loaderCalls'),method==='info'?0:1);
    if(method==='relay')assert.equal(await evaluate(ig,'queryCode'),shortCode);
  }
  console.log('PASS exact reported extended URL uses canonical REST ID and Relay shortcode; both paths save full mixed media and retain original source URL');

};
