const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../stories.js'), 'utf8');
const owner = {pk:'42', username:'artist'};
const image = pk => ({pk, media_type:1, image_versions2:{candidates:[{url:`https://s.cdninstagram.com/${pk}.jpg`}]}});
const video = pk => ({pk, media_type:2, video_versions:[{url:`https://v.cdninstagram.com/${pk}.mp4`}]});
const reel = {id:'42', user:owner, items:[image('101'), video('102'), video('103')]};
function fixture({props={postId:'102'}, api, fetch, timers}={}) {
  class Node {}
  const active = new Node(); active.src = 'blob:https://www.instagram.com/clicked';
  active.__reactFiber$test = {memoizedProps:props};
  const root = new Node(); root.querySelector = () => active; root.querySelectorAll = () => [active];
  const calls = [], rawCalls = [];
  const world = {require(name) {
    assert.equal(name,'PolarisInstapi');
    return {async apiGet(route, options) {
      calls.push({route, options});
      if (api) return api(route, options, active);
      return {data:route.includes('reels_tray') ? {tray:[{user:owner}]} : {reels:{42:reel}, reels_media:[reel]}};
    }};
  }};
  const sandbox = vm.createContext({Node, window:world, location:{hostname:'www.instagram.com'},
    document:{querySelector:()=>root,querySelectorAll:()=>[]}, URL, AbortSignal,
    setTimeout:timers?.setTimeout || setTimeout, clearTimeout:timers?.clearTimeout || clearTimeout,
    fetch:async (route,opts) => {rawCalls.push(route); return fetch ? fetch(route,opts) : new Response('{}',{headers:{'content-type':'application/json'}});}});
  vm.runInContext(source,sandbox);
  const context = {marker:'12345678-1234-1234-1234-123456789abc',author:'artist',storyId:'',elementURL:active.src,current:{type:'video'}};
  return {context, active, root, calls, rawCalls,
    run:async (network=true,all=false) => JSON.parse(JSON.stringify(await sandbox.extractInstagramStories(context,network,all)))};
}
test('page client resolves ID-only blob player to second Story, with no raw fetch', async()=>{
  const f=fixture(), result=await f.run();
  assert.equal(result.currentStoryId,'102');
  assert.equal(result.items[0].video_versions[0].url,'https://v.cdninstagram.com/102.mp4');
  assert.equal(result.items.length,1); assert.equal(f.rawCalls.length,0);
  assert.deepEqual(f.calls.map(c=>c.route),['/api/v1/feed/reels_tray/','/api/v1/feed/reels_media/']);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[1].options)),{query:{reel_ids:'42'}});
});
test('nearest compound media fiber key resolves without full media props', async()=>{
  const f=fixture({props:{}}); f.active.__reactFiber$test.return={key:'103_42',memoizedProps:{}};
  assert.equal((await f.run()).currentStoryId,'103');
});
test('preview and DOM-only extraction never call page or network clients', async()=>{
  const f=fixture(); await f.run(false);
  assert.equal(f.calls.length,0); assert.equal(f.rawCalls.length,0);
});
test('batch verifies account and includes all items rather than only active item', async()=>{
  const f=fixture(), result=await f.run(true,true);
  assert.equal(result.complete,true); assert.deepEqual(result.items.map(i=>i.pk),['101','102','103']);
});
test('no active identity never becomes first Story; batch remains allowed', async()=>{
  const f=fixture({props:{}}), result=await f.run();
  assert.equal(result.currentStoryId,''); assert.equal(result.items.length,0);
  assert.equal((await f.run(true,true)).items.length,3);
});
test('conflicting player IDs are rejected, even if one matches returned media', async()=>{
  const f=fixture({props:{postId:'102',mediaId:'103'}});
  assert.equal((await f.run()).items.length,0);
});
test('reel collection props do not imply first or last child is active', async()=>{
  const f=fixture({props:{reel}});
  assert.equal((await f.run()).items.length,0);
});
test('wrong-account response is rejected even with matching media ID', async()=>{
  const f=fixture({api:async route=>({data:route.includes('reels_tray') ? {tray:[{user:owner}]} : {reels:{42:{...reel,user:{pk:'42',username:'other'}}}}})});
  assert.equal((await f.run()).items.length,0);
});
test('incomplete account lists cannot be batch imported', async()=>{
  const f=fixture({api:async route=>({data:route.includes('reels_tray') ? {tray:[{user:owner}]} : {reels:{42:{...reel,has_more:true}}}})});
  assert.equal((await f.run(true,true)).complete,false);
});
test('page module failure falls back to read-only reels_media request', async()=>{
  const f=fixture({api:async()=>{throw Error('Unavailable')},fetch:async route=>new Response(JSON.stringify(route.includes('web_profile_info')?{data:{user:owner}}:{reels:{42:reel}}),{headers:{'content-type':'application/json'}})});
  assert.equal((await f.run()).currentStoryId,'102');
  assert.ok(f.rawCalls.includes('/api/v1/feed/reels_media/?reel_ids=42'));
});
test('hung page client times out and does not prevent fallback', async()=>{
  const f=fixture({api:()=>new Promise(()=>{}), timers:{setTimeout:fn=>setTimeout(fn,0),clearTimeout},
    fetch:async route=>new Response(JSON.stringify(route.includes('web_profile_info')?{data:{user:owner}}:{reels_media:[reel]}),{headers:{'content-type':'application/json'}})});
  assert.equal((await f.run()).currentStoryId,'102');
});
test('autoplay during API lookup preserves captured click identity', async()=>{
  const f=fixture({api:async(route,options,active)=>{
    active.src='blob:https://www.instagram.com/advanced'; active.__reactFiber$test.memoizedProps={postId:'103'};
    return {data:route.includes('reels_tray')?{tray:[{user:owner}]}:{reels_media:[reel]}};
  }});
  assert.equal((await f.run()).currentStoryId,'102');
});
test('autoplay before extraction rejects stale element identity', async()=>{
  const f=fixture(); f.active.src='blob:https://www.instagram.com/advanced';
  await assert.rejects(f.run(), /Story advanced/); assert.equal(f.calls.length,0);
});
