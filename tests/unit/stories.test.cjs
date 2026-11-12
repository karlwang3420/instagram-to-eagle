const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../page/stories.js'), 'utf8');
// Normalized Relay records, shaped like Instagram's Stories V3 store.
function store({username='artist', itemOwner=username, latest=1103}={}) {
  const records = {
    'XDTReelDict:42': {__id:'XDTReelDict:42', __typename:'XDTReelDict', id:'42', latest_reel_media:latest,
      user:{__ref:'XDTUserDict:42'}, items:{__refs:['m101','m102','m103']}},
    'XDTUserDict:42': {__id:'XDTUserDict:42', __typename:'XDTUserDict', username, full_name:'Artist'},
    'XDTUserDict:7': {__id:'XDTUserDict:7', __typename:'XDTUserDict', username:itemOwner}
  };
  for (const [pk, type] of [['101',1],['102',2],['103',2]]) {
    records[`m${pk}`] = {__id:`m${pk}`, __typename:'XDTMediaDict', pk, id:`${pk}_42`, media_type:type, taken_at:1000 + Number(pk),
      user:{__ref:pk === '103' ? 'XDTUserDict:7' : 'XDTUserDict:42'}, image_versions2:{__ref:`i${pk}`},
      video_versions:type === 2 ? {__refs:[`v${pk}`]} : null};
    records[`i${pk}`] = {candidates:{__refs:[`c${pk}`]}};
    records[`c${pk}`] = {url:`https://s.cdninstagram.com/${pk}.jpg`, width:640};
    records[`v${pk}`] = {url:`https://v.cdninstagram.com/${pk}.mp4`, width:720};
  }
  return {getStore:() => ({getSource:() => ({getRecordIDs:() => Object.keys(records), get:key => records[key]})})};
}
function fixture({props={postId:'102'}, environment=store(), current={type:'video'}}={}) {
  class Node {}
  const active = new Node(); active.src = 'blob:https://www.instagram.com/clicked';
  active.__reactFiber$test = {memoizedProps:props, return:{memoizedProps:{value:{environment}}}};
  const root = new Node(); root.querySelector = () => active;
  const sandbox = vm.createContext({Node, location:{hostname:'www.instagram.com'}, document:{querySelector:()=>root}, URL});
  vm.runInContext(source, sandbox);
  const context = {marker:'12345678-1234-1234-1234-123456789abc', author:'artist', storyId:'', elementURL:active.src, current};
  return {context, active, run:(all=false) => JSON.parse(JSON.stringify(sandbox.extractInstagramStories(context, all)))};
}
test('ID-only blob player resolves to second Story from the page store', ()=>{
  const result = fixture().run();
  assert.equal(result.currentStoryId, '102');
  assert.equal(result.items[0].video_versions[0].url, 'https://v.cdninstagram.com/102.mp4');
  assert.equal(result.items.length, 1); assert.equal(result.user.full_name, 'Artist');
});
test('Relay record reference on the player identifies the Story', ()=>{
  assert.equal(fixture({props:{media:{__id:'m101', __fragments:{}}}}).run().currentStoryId, '101');
});
test('portal video player metadata identifies the Story video', ()=>{
  const result = fixture({props:{coreVideoPlayerMetaData:{videoFBID:'103', subOrigin:'inline'}}}).run();
  assert.equal(result.currentStoryId, '103'); assert.equal(result.items[0].video_versions[0].url, 'https://v.cdninstagram.com/103.mp4');
});
test('nearest compound media fiber key resolves without media props', ()=>{
  const f = fixture({props:{}}); f.active.__reactFiber$test = {key:'102_42', memoizedProps:{}, return:f.active.__reactFiber$test.return};
  assert.equal(f.run().currentStoryId, '102');
});
test('Story ID in the URL selects that item', ()=>{
  const f = fixture({props:{}}); f.context.storyId = '101';
  assert.equal(f.run().items[0].image_versions2.candidates[0].url, 'https://s.cdninstagram.com/101.jpg');
});
test('visible photo URL identifies the Story without player IDs', ()=>{
  const f = fixture({props:{}, current:{type:'image', url:'https://s.cdninstagram.com/101.jpg?stp=x'}});
  assert.equal(f.run().currentStoryId, '101');
});
test('batch includes all items rather than only the active item', ()=>{
  const result = fixture().run(true);
  assert.equal(result.complete, true); assert.deepEqual(result.items.map(i=>i.pk), ['101','102','103']);
});
test('batch missing the reel\'s newest Story is incomplete; single save still works', ()=>{
  const f = fixture({environment:store({latest:1104})});
  assert.equal(f.run(true).complete, false); assert.equal(f.run().currentStoryId, '102');
});
test('no active identity never becomes first Story; batch remains allowed', ()=>{
  const f = fixture({props:{}});
  assert.equal(f.run().items.length, 0); assert.equal(f.run(true).items.length, 3);
});
test('conflicting player IDs are rejected', ()=>{
  assert.equal(fixture({props:{postId:'102', mediaId:'101'}}).run().items.length, 0);
});
test('reel collection props do not imply first or last child is active', ()=>{
  assert.equal(fixture({props:{reel:{__id:'XDTReelDict:42'}}}).run().items.length, 0);
});
test('another account\'s reel is never used', ()=>{
  const result = fixture({environment:store({username:'other'})}).run();
  assert.equal(result.items.length, 0); assert.match(result.note, /not loaded/);
});
test('a reel containing another owner\'s item is rejected', ()=>{
  assert.equal(fixture({environment:store({itemOwner:'other'})}).run(true).complete, false);
});
test('missing page store reports why nothing was found', ()=>{
  const result = fixture({environment:null}).run();
  assert.equal(result.items.length, 0); assert.match(result.note, /not found/);
});
test('autoplay before extraction rejects stale element identity', ()=>{
  const f = fixture(); f.active.src = 'blob:https://www.instagram.com/advanced';
  assert.throws(() => f.run(), /Story advanced/);
});
