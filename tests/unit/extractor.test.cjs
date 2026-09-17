const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function fixture(post){
  const root={href:'https://www.instagram.com/p/A/',querySelectorAll:()=>[],__reactProps$fixture:{post}};
  const c=vm.createContext({URL,AbortSignal,setTimeout,clearTimeout,Node:class{},location:{hostname:'www.instagram.com'},window:{},document:{querySelector:()=>root,querySelectorAll:()=>[]}});
  for(const file of ['shared/core.js','page/posts.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../..',file),'utf8'),c);
  return c;
}

test('clicked blob player captures nearest media ID, not full-post or neighbor IDs',async()=>{
  const post={code:'A',media_type:8,carousel_media:[{pk:'101',media_type:2},{pk:'102',media_type:1},{pk:'103',media_type:2}]};
  const c=fixture(post),root=c.document.querySelector();
  const active={tagName:'VIDEO',src:'blob:player',__reactFiber$fixture:{memoizedProps:{},return:{memoizedProps:{videoFBID:'103'},return:{memoizedProps:{post}}}}};
  root.querySelector=()=>active;
  const context={marker:'abc',code:'A',elementURL:'blob:player',current:{type:'video'}};
  let result=await c.extractInstagramPost(context,false,'video');assert.deepEqual(Array.from(result.activeMediaIds),['103']);
  active.__reactFiber$fixture.return={key:'103_42',memoizedProps:{}};
  result=await c.extractInstagramPost(context,false,'video');assert.deepEqual(Array.from(result.activeMediaIds),['103']);
  active.__reactFiber$fixture.return={memoizedProps:{post},return:{memoizedProps:{id:'101'}}};
  result=await c.extractInstagramPost(context,false,'video');assert.equal(result.activeMediaIds.length,0);
  active.src='blob:changed';await assert.rejects(c.extractInstagramPost(context,false,'video'),/video changed/);
});

test('player hints are frozen before asynchronous metadata response changes the player',async()=>{
  const post={code:'A',media_type:8,carousel_media:[{pk:'101',media_type:2},{pk:'103',media_type:2}]};
  const c=fixture(post),root=c.document.querySelector();
  const active={tagName:'VIDEO',src:'blob:player',__reactProps$fixture:{mediaId:'103'}};
  root.querySelector=()=>active;
  c.fetch=async()=>{active.__reactProps$fixture.mediaId='101';return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({items:[post]})};};
  const result=await c.extractInstagramPost({marker:'abc',code:'A',elementURL:'blob:player',current:{type:'video'}},true,'video');
  assert.deepEqual(Array.from(result.activeMediaIds),['103']);
});
test('shared media references survive extraction and whole-post normalization',async()=>{
  const versions={candidates:[{url:'https://s.cdninstagram.com/shared.jpg'}]};
  const post={code:'A',caption:{text:'fixture'},media_type:8,carousel_media_count:2,carousel_media:[{pk:'1',media_type:1,image_versions2:versions},{pk:'2',media_type:1,image_versions2:versions}]};
  const c=fixture(post),dom={marker:'abc',code:'A',url:'https://www.instagram.com/p/A/'};
  const result=await c.extractInstagramPost(dom,false);
  const selected=c.EagleCore.select(c.EagleCore.normalize(result.post,dom),dom,'post');
  assert.equal(selected.length,2);assert.equal(selected[0].url,selected[1].url);
});
test('actual cycles are removed without deleting shared sibling objects',async()=>{
  const version={url:'https://s.cdninstagram.com/image.jpg'};
  const post={code:'A',media_type:1,image_versions2:{candidates:[version,version]}};version.back=post;
  const c=fixture(post),{post:plain}=await c.extractInstagramPost({marker:'abc',code:'A'},false);
  assert.equal(plain.image_versions2.candidates[0].url,version.url);
  assert.equal(plain.image_versions2.candidates[1].url,version.url);
  assert.doesNotThrow(()=>JSON.stringify(plain));
});

const dom={marker:'abc',code:'A',url:'https://www.instagram.com/p/A/',isGrid:true};
const partial={code:'A',media_type:8,carousel_media_count:2,carousel_media:[{pk:'1',media_type:1},{pk:'2',media_type:2}]};
const full={...partial,user:{username:'artist'},carousel_media:[
  {pk:'1',media_type:1,image_versions2:{candidates:[{url:'https://s.cdninstagram.com/original.jpg',width:1200,height:1600}]}},
  {pk:'2',media_type:2,video_versions:[{url:'https://v.cdninstagram.com/original.mp4',width:1080,height:1920}]}
]};
function networkFixture({primary=partial,relay=full,primaryError=null,relayError=null}={}){
  const c=fixture(partial),calls=[];
  c.window.require=name=>{
    if(name==='PolarisInstapi')return {apiGet:async path=>{calls.push({type:'info',path});if(primaryError)throw primaryError;return {data:{items:[primary]}};}};
    if(name==='CometRelay')return {fetchQuery:(env,query,variables)=>{calls.push({type:'relay',variables});return {toPromise:async()=>{if(relayError)throw relayError;return {xdt_shortcode_media:{__fragments:{PolarisPostActionLoadPostQueryInlineFragment:relay}}};}};}};
    if(name==='PolarisRelayEnvironment')return {};
    if(name==='PolarisPostActionLoadPostQuery')return {POST_QUERY:{}};
    throw new Error('Unexpected module');
  };
  return {c,calls};
}
test('ID-only grid children resolve to full images AND videos through native full-post loader',async()=>{
  const {c,calls}=networkFixture();
  const result=await c.extractInstagramPost(dom,true);
  const files=c.EagleCore.select(c.EagleCore.normalize(result.post,dom),dom,'post');
  assert.deepEqual(Array.from(files,x=>x.url),['https://s.cdninstagram.com/original.jpg','https://v.cdninstagram.com/original.mp4']);
  assert.equal(calls.length,2);assert.equal(calls[1].variables.shortcode,'A');
  assert.equal(calls[1].variables.fetch_comment_count,0);assert.equal(result.note,'');
});
test('failed initial lookup still uses the full-post loader; complete initial data skips it',async()=>{
  let f=networkFixture({primaryError:new Error('Unavailable')});
  assert.equal((await f.c.extractInstagramPost(dom,true)).post.carousel_media[1].video_versions[0].url,full.carousel_media[1].video_versions[0].url);
  f=networkFixture({primary:full});await f.c.extractInstagramPost(dom,true);assert.equal(f.calls.length,1);
});
test('full-post query accepts direct GraphQL sidecar shape as well as inline fragments',async()=>{
  const graphql={shortcode:'A',__typename:'GraphSidecar',edge_sidecar_to_children:{edges:[
    {node:{id:'1',display_resources:[{src:'https://s.cdninstagram.com/photo.jpg'}]}},
    {node:{id:'2',__typename:'GraphVideo',is_video:true,video_url:'https://v.cdninstagram.com/clip.mp4'}}
  ]}};
  const {c}=networkFixture({relay:graphql});
  const result=await c.extractInstagramPost(dom,true);
  assert.equal(c.EagleCore.select(c.EagleCore.normalize(result.post,dom),dom,'post').length,2);
});
test('full-post query rejects a different shortcode even if a conflicting numeric ID matches',async()=>{
  const {c}=networkFixture({relay:{...full,code:'OTHER',pk:'0'}});
  const result=await c.extractInstagramPost(dom,true);
  assert.throws(()=>c.EagleCore.select(c.EagleCore.normalize(result.post,dom),dom,'post'),/missing/);
});
test('incomplete fallback cannot silently send a subset or use video posters',async()=>{
  const {c}=networkFixture({relay:{...full,carousel_media:[full.carousel_media[0],{pk:'2',media_type:2,image_versions2:full.carousel_media[0].image_versions2}]}});
  const result=await c.extractInstagramPost(dom,true);
  assert.throws(()=>c.EagleCore.select(c.EagleCore.normalize(result.post,dom),dom,'post'),/missing/);
});
test('authentication and rate-limit failures never trigger the alternate query',async()=>{
  for(const status of [401,403,429]){
    const {c,calls}=networkFixture({primaryError:{status,message:'Blocked'}});
    await assert.rejects(c.extractInstagramPost(dom,true),/verification|rate-limited/);
    assert.equal(calls.length,1);
  }
});
test('preview makes no native requests; unavailable loader leaves missing media fail-closed',async()=>{
  const {c,calls}=networkFixture();await c.extractInstagramPost(dom,false);assert.equal(calls.length,0);
  c.window.require=name=>{if(name==='PolarisInstapi')return {apiGet:async()=>({data:{items:[partial]}})};throw new Error('No module');};
  const result=await c.extractInstagramPost(dom,true);
  assert.throws(()=>c.EagleCore.select(c.EagleCore.normalize(result.post,dom),dom,'post'),/missing/);
});
test('top-level video_resources survives extraction for native loader video results',async()=>{
  const {c}=networkFixture({relay:{code:'A',is_video:true,video_resources:[{src:'https://v.cdninstagram.com/native.mp4'}]}});
  c.document.querySelector().__reactProps$fixture.post={code:'A',media_type:2,video_versions:[]};
  const originalRequire=c.window.require;
  c.window.require=name=>name==='PolarisInstapi'?{apiGet:async()=>({data:{items:[{code:'A',media_type:2,video_versions:[]}]}})}:originalRequire(name);
  const result=await c.extractInstagramPost(dom,true);
  assert.equal(c.EagleCore.select(c.EagleCore.normalize(result.post,dom),dom,'post')[0].url,'https://v.cdninstagram.com/native.mp4');
});
test('full-post fallback cannot shrink a known carousel by omitting its media count',async()=>{
  const {c}=networkFixture({primary:{...partial,carousel_media_count:8},relay:full});
  const result=await c.extractInstagramPost(dom,true);
  assert.equal(result.post.carousel_media_count,8);
  assert.throws(()=>c.EagleCore.select(c.EagleCore.normalize(result.post,dom),dom,'post'),/verify/);
});

const extendedCode='Cml1XsiSDMVpa0s418I3lIZLYF-WZyoe2aXaM00';
const canonical='Cml1XsiSDMV', mediaId='3001039451545154325';
const extendedURL='https://www.instagram.com/p/'+extendedCode+'/';
const extendedDom={...dom,code:extendedCode,url:extendedURL};
const extendedFull={...full,code:canonical,pk:mediaId};
function extendedFixture(options={}){
  const f=networkFixture(options),root=f.c.document.querySelector();
  root.href=extendedURL;root.__reactProps$fixture.post={...partial,code:canonical,pk:mediaId};
  return f;
}
test('exact reported extended URL requests canonical media ID and preserves Eagle source URL',async()=>{
  const {c,calls}=extendedFixture({primary:extendedFull});
  const result=await c.extractInstagramPost(extendedDom,true);
  assert.equal(calls[0].path,'/api/v1/media/'+mediaId+'/info/');assert.equal(calls.length,1);
  const normalized=c.EagleCore.normalize(result.post,extendedDom);
  const payload=c.EagleCore.payload(normalized,c.EagleCore.select(normalized,extendedDom,'post'));
  assert.equal(payload.items.length,2);assert.ok(payload.items.every(x=>x.website===extendedURL));
});
test('extended URL Relay fallback queries only canonical shortcode and accepts canonical response',async()=>{
  const {c,calls}=extendedFixture({primary:{...partial,code:canonical},relay:extendedFull});
  const result=await c.extractInstagramPost(extendedDom,true);
  assert.equal(calls[1].variables.shortcode,canonical);
  assert.equal(c.EagleCore.select(c.EagleCore.normalize(result.post,extendedDom),extendedDom,'post').length,2);
});
test('extended URL matches page data in preview without network calls',async()=>{
  const {c,calls}=extendedFixture();c.document.querySelector().__reactProps$fixture.post=extendedFull;
  const result=await c.extractInstagramPost(extendedDom,false);
  assert.equal(result.post.code,canonical);assert.equal(calls.length,0);
});
test('extended URL finds canonical post in embedded JSON when React data is absent',async()=>{
  const {c}=extendedFixture();delete c.document.querySelector().__reactProps$fixture;
  c.document.querySelectorAll=()=>[{textContent:JSON.stringify(extendedFull)}];
  assert.equal((await c.extractInstagramPost(extendedDom,false)).post.pk,mediaId);
});
test('extended and canonical permalinks can coexist in the same selected post',async()=>{
  const {c}=extendedFixture({primary:extendedFull}),root=c.document.querySelector();
  root.querySelectorAll=selector=>selector==='a[href]'?[{href:'https://www.instagram.com/p/'+canonical+'/'}]:[];
  assert.equal((await c.extractInstagramPost(extendedDom,true)).post.pk,mediaId);
});
test('extended URL normalization still rejects a different tile or different returned post',async()=>{
  let f=extendedFixture({primary:extendedFull});
  f.c.document.querySelector().href='https://www.instagram.com/p/DIFFERENT'+extendedCode.slice(-28)+'/';
  await assert.rejects(f.c.extractInstagramPost(extendedDom,true),/tile changed/);assert.equal(f.calls.length,0);
  f=extendedFixture({primary:{...extendedFull,code:'WRONG',pk:mediaId},relay:{...extendedFull,code:'WRONG',pk:mediaId}});
  const result=await f.c.extractInstagramPost(extendedDom,true);
  assert.throws(()=>f.c.EagleCore.select(f.c.EagleCore.normalize(result.post,extendedDom),extendedDom,'post'),/missing/);
});
