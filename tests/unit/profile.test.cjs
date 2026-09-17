const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'../..',name),'utf8');
const image=(code='A')=>({code,media_type:1,user:{username:'artist'},caption:{text:'#art'},image_versions2:{candidates:[{url:`https://s.cdninstagram.com/${code}.jpg`}]}});
const video={media_type:2,video_versions:[{url:'https://v.cdninstagram.com/clip.mp4'}]};
function core(){const c=vm.createContext({URL});vm.runInContext(source('shared/core.js'),c);return c.EagleCore;}
test('whole-post mode includes images AND videos, preserving their original order',()=>{
  const c=core(),dom={url:'https://www.instagram.com/p/A/',code:'A'};
  const result=c.normalize({...image(),media_type:8,carousel_media_count:3,carousel_media:[image(),video,image('B')]},dom);
  const selected=c.select(result,dom,'post');assert.equal(selected.length,3);assert.equal(selected[1].type,'video');
  const payload=c.payload(result,selected);assert.ok(payload.items.every(x=>x.annotation===''&&x.website===dom.url));
  assert.equal(payload.items[1].url,video.video_versions[0].url);
});
test('whole-post mode rejects incomplete carousels, missing video and unsupported hosts',()=>{
  const c=core(),dom={url:'https://www.instagram.com/p/A/',code:'A'};
  for(const post of [{...image(),media_type:8,carousel_media_count:3,carousel_media:[image()]},{...image(),...video,video_versions:[]},{...image(),image_versions2:{candidates:[{url:'https://evil.test/file.jpg'}]}}])
    assert.throws(()=>c.select(c.normalize(post,dom),dom,'post'));
});

test('removed bulk and menu entry points are not shipped or registered',()=>{
  const manifest=JSON.parse(source('manifest.json'));
  assert.ok(!manifest.permissions.includes('menus'));
  assert.ok(!manifest.background.scripts.some(file=>/^profile-(data|jobs)\.js$/.test(file)));
  assert.ok(!/browser\.menus|saveProfile\(/.test(source('background/index.js')));
  assert.ok(!/Download All|confirmAll|profile-progress/.test(source('content/grid-controls.js')));
  assert.ok(!/class="actions"|id="current"|id="all"|id="reel"/.test(source('popup/popup.html')));
});
