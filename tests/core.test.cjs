const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../core.js');
const C = globalThis.EagleCore;
const image = (id, extra = {}) => ({ pk: id, media_type: 1, image_versions2: { candidates: [{ url: `https://s.cdninstagram.com/${id}.jpg`, width: 1080, height: 1350 }, { url: `https://s.cdninstagram.com/${id}-small.jpg`, width: 320, height: 400 }] }, ...extra });
const video = { pk: 'v', media_type: 2, video_versions: [{ url: 'https://v.cdninstagram.com/reel.mp4', width: 1080, height: 1920 }], has_audio: true };
const dom = { code: 'Test123', url: 'https://www.instagram.com/p/Test123/', current: { type: 'image', url: 'https://s.cdninstagram.com/b.jpg?token=old' }, visibleText: 'Visible text' };
const post = { code: 'Test123', user: { username: 'artist', full_name: 'An Artist' }, caption: { text: 'Full caption\n#illustration #設計 #illustration' }, taken_at: 1700000000, like_count: 0, media_type: 8, carousel_media_count: 3, carousel_media: [image('a'), video, image('b')], location: { name: 'Studio' } };
test('mixed carousel preserves image order, skips video and keeps concise metadata with automatic tags', () => {
  const r = C.normalize(post, dom), media = C.select(r, dom, 'all'), p = C.payload(r, media, { folderId: 'F1', tags: ['reference'] });
  assert.equal(r.complete, true); assert.deepEqual(media.map(m => m.index), [1, 3]);
  assert.equal(p.folderId, 'F1'); assert.equal(p.items[1].url, 'https://s.cdninstagram.com/b.jpg');
  assert.deepEqual(p.items[0].tags, ['Instagram', '@artist', 'illustration', '設計']);
  assert.equal(p.items[0].name, '@artist · Full caption · 01');
  assert.ok(p.items.every(item => item.annotation === ''));
  assert.equal(p.items[0].website, dom.url);
});
test('current image is the selected slide even when its signed query changed', () => {
  assert.equal(C.select(C.normalize(post, dom), dom, 'current')[0].index, 3);
});
test('partial carousel never silently reports all images', () => {
  const r = C.normalize({ ...post, carousel_media: [image('a')] }, dom);
  assert.equal(r.complete, false); assert.throws(() => C.select(r, dom, 'all'), /full carousel/);
  assert.equal(C.normalize({ media_type: 8 }, dom).complete, false);
});
test('Reel resolves a direct video, not its thumbnail', () => {
  const d = { ...dom, url: 'https://www.instagram.com/reel/Test123/', current: { type: 'video', url: 'blob:https://www.instagram.com/test' } };
  const r = C.normalize({ ...video, product_type: 'clips' }, d);
  assert.equal(C.select(r, d, 'reel')[0].url, 'https://v.cdninstagram.com/reel.mp4');
  const item = C.payload(r, C.select(r, d, 'reel')).items[0];
  assert.equal(item.annotation, '');
  assert.deepEqual(item.tags, ['Instagram', 'Reel']);
  assert.equal(item.website, d.url);
  assert.throws(() => C.select(C.normalize(null, d), d, 'reel'), /streaming\/blob/);
});
test('current image cannot accidentally save a video poster', () => {
  assert.throws(() => C.select(C.normalize(post, dom), { ...dom, current: { type: 'video' } }, 'current'), /video/);
});
test('timeline video resolves a direct file behind a blob player and keeps simple metadata', () => {
  const d = { ...dom, current: { type: 'video', url: 'blob:https://www.instagram.com/player' } };
  const r = C.normalize({ ...video, user: post.user, caption: post.caption }, d);
  const item = C.payload(r, C.select(r, d, 'video')).items[0];
  assert.equal(item.url, 'https://v.cdninstagram.com/reel.mp4');
  assert.equal(item.website, dom.url); assert.equal(item.annotation, '');
  assert.deepEqual(item.tags, ['Instagram', '@artist', 'illustration', '設計']);
  assert.throws(() => C.select(r, dom, 'video'), /video slide/);
  assert.throws(() => C.select(C.normalize(null, d), d, 'video'), /streaming\/blob/);
});
test('video carousel selects the matching poster and refuses ambiguous blob slides', () => {
  const second = { ...video, pk: 'v2', image_versions2: image('poster2').image_versions2, video_versions: [{ url: 'https://v.cdninstagram.com/second.mp4' }] };
  const r = C.normalize({ ...post, carousel_media: [video, image('a'), second] }, dom);
  const d = { ...dom, current: { type: 'video', url: 'blob:https://www.instagram.com/player', preview: 'https://s.cdninstagram.com/poster2.jpg?new=1' } };
  assert.equal(C.select(r, d, 'video')[0].url, 'https://v.cdninstagram.com/second.mp4');
  assert.throws(() => C.select(r, { ...d, current: { type: 'video', url: d.current.url } }, 'video'), /identify this video/);
  assert.equal(C.select(C.normalize(post, dom), { ...d, current: { type: 'video', url: d.current.url } }, 'video')[0].index, 2);
});
test('missing media is not mislabeled as a video', () => {
  assert.throws(() => C.select(C.normalize(post, dom), { ...dom, current: null }, 'current'), /active slide could not be identified/);
});
test('captured full carousel index selects second video despite identical posters',()=>{
  const first={...video,image_versions2:image('shared').image_versions2};
  const last={...first,pk:'v2',video_versions:[{url:'https://v.cdninstagram.com/second.mp4'}]};
  const data=C.normalize({...post,carousel_media:[first,image('a'),last]},dom);
  const selected={...dom,slideIndex:3,slideCount:3,current:{type:'video',url:'blob:https://www.instagram.com/player',preview:'https://s.cdninstagram.com/shared.jpg'}};
  assert.equal(C.select(data,selected,'video')[0].url,'https://v.cdninstagram.com/second.mp4');
  for(const change of [{slideIndex:0},{slideIndex:4},{slideIndex:1.5},{slideCount:5}]) assert.throws(()=>C.select(data,{...selected,...change},'video'),/position/);
  assert.throws(()=>C.select(data,{...selected,slideIndex:2},'video'),/changed/);
  assert.throws(()=>C.select(data,{...selected,slideIndex:null},'video'),/identify this video/);
  const unavailable={...data,media:data.media.map((m,i)=>i===2?{...m,url:null}:m)};
  assert.throws(()=>C.select(unavailable,selected,'video'),/no direct downloadable/);
});
test('image rendition resolves original quality without relying on carousel position',()=>{
  const selected={...dom,slideIndex:3,slideCount:3,current:{type:'image',url:'https://s.cdninstagram.com/b-small.jpg'}};
  assert.equal(C.select(C.normalize(post,dom),selected,'current')[0].url,'https://s.cdninstagram.com/b.jpg');
});

test('player media ID selects exact blob video despite timeline window count and shared posters',()=>{
  const first={...video,pk:'101',image_versions2:image('shared').image_versions2};
  const last={...first,pk:'103_42',video_id:'903',video_versions:[{url:'https://v.cdninstagram.com/last.mp4'}]};
  const data=C.normalize({...post,carousel_media:[first,image('102'),last]},dom);
  const clicked={...dom,slideIndex:2,slideCount:2,current:{type:'video',url:'blob:https://www.instagram.com/player'}};
  for(const ids of [['103'],['903'],['103','903']])assert.equal(C.select({...data,activeMediaIds:ids},clicked,'video')[0].url,'https://v.cdninstagram.com/last.mp4');
  for(const ids of [['999'],['103','101'],['103','999']])assert.throws(()=>C.select({...data,activeMediaIds:ids},clicked,'video'),/match this video player/);
  assert.throws(()=>C.select({...data,activeMediaIds:['103'],media:data.media.map(m=>({...m,url:null}))},clicked,'video'),/no direct downloadable/);
});

test('direct video or unique poster identifies a timeline clip before its relative index',()=>{
  const first={...video,pk:'101',image_versions2:image('poster-one').image_versions2};
  const second={...video,pk:'103',image_versions2:image('poster-two').image_versions2,video_versions:[{url:'https://v.cdninstagram.com/last.mp4'}]};
  const data=C.normalize({...post,carousel_media:[first,image('102'),second]},dom);
  const clicked={...dom,slideIndex:2,slideCount:2,current:{type:'video',url:'blob:https://www.instagram.com/player',preview:'https://s.cdninstagram.com/poster-two-small.jpg'}};
  assert.equal(C.select(data,clicked,'video')[0].url,'https://v.cdninstagram.com/last.mp4');
  assert.equal(C.select(data,{...clicked,current:{type:'video',url:'https://v.cdninstagram.com/last.mp4?token=new'}},'video')[0].index,3);
  assert.throws(()=>C.select(data,{...clicked,current:{type:'video',url:clicked.current.url}},'video'),/position/);
});

test('timeline window counts and relative positions cannot reject or change the clicked image',()=>{
  const data=C.normalize(post,dom);
  for(const position of [{slideIndex:2,slideCount:2},{slideIndex:1,slideCount:3},{slideIndex:5,slideCount:5},{slideIndex:null,slideCount:null}]) {
    const selected={...dom,...position,current:{type:'image',url:'https://s.cdninstagram.com/b-small.jpg?new=1'}};
    const saved=C.select(data,selected,'current');
    assert.equal(saved.length,1);assert.equal(saved[0].url,'https://s.cdninstagram.com/b.jpg');assert.equal(saved[0].index,3);
  }
});

test('unmatched visible image stays the clicked image, never a guessed carousel position',()=>{
  const data=C.normalize(post,dom);
  for(const slideCount of [2,3,5]) {
    const selected={...dom,slideIndex:1,slideCount,current:{type:'image',url:'https://s.cdninstagram.com/visible-only.jpg'}};
    const saved=C.select(data,selected,'current')[0];
    assert.equal(saved.url,selected.current.url);assert.equal(saved.index,null);
  }
  assert.throws(()=>C.select(data,{...dom,slideIndex:1,slideCount:3,current:{type:'image',url:'https://evil.test/a.jpg'}},'current'),/still loading/);
});

test('duplicate image URLs do not assign a guessed slide number',()=>{
  const data=C.normalize({...post,carousel_media:[image('b'),video,image('b')]},dom);
  const saved=C.select(data,{...dom,slideIndex:1,slideCount:2},'current')[0];
  assert.equal(saved.url,dom.current.url);assert.equal(saved.index,null);
});
test('source and media URL validation excludes unrelated and local hosts', () => {
  for (const u of ['http://s.cdninstagram.com/a.jpg', 'https://cdninstagram.com.evil.test/x', 'http://127.0.0.1:41595/api/library/switch', 'file:///C:/secret', 'data:image/png;base64,AAAA', 'https://user:password@s.cdninstagram.com/a']) assert.equal(C.mediaURL(u), null);
  assert.equal(C.postURL('https://www.instagram.com/p/Test123/?igsh=tracking'), dom.url);
  assert.equal(C.postURL('https://evil.test/p/Test123/'), null);
});
test('GraphQL carousel representation preserves caption and largest image', () => {
  const p = { __typename: 'GraphSidecar', edge_media_to_caption: { edges: [{ node: { text: 'Graph caption' } }] }, edge_sidecar_to_children: { edges: [{ node: { is_video: false, display_resources: [{ src: 'https://s.cdninstagram.com/small.jpg', config_width: 320, config_height: 320 }, { src: 'https://s.cdninstagram.com/large.jpg', config_width: 1080, config_height: 1080 }] } }] } };
  const r = C.normalize(p, dom); assert.equal(r.meta.caption, 'Graph caption'); assert.equal(C.select(r, dom, 'all')[0].url, 'https://s.cdninstagram.com/large.jpg');
});
test('Stories batch includes images and videos with individual sources and tags', () => {
  const d = {code:'102',storyId:'102',author:'artist',isStory:true,url:'https://www.instagram.com/stories/artist/102/',current:{type:'video',url:'blob:https://www.instagram.com/story'}};
  const data = {complete:true,user:{username:'artist'},items:[{...image('101'),caption:{text:'A story #art'}},{...video,pk:'102'}]};
  const r = C.normalizeStories(data,d);
  const selected = C.select(r,d,'stories');
  assert.deepEqual(selected.map(m=>m.type),['image','video']);
  assert.equal(C.select(r,d,'story')[0].id,'102');
  const payload = C.payload(r,selected);
  assert.deepEqual(payload.items.map(m=>m.website),['https://www.instagram.com/stories/artist/101/','https://www.instagram.com/stories/artist/102/']);
  assert.deepEqual(payload.items[0].tags,['Instagram','Story','@artist','art']);
  assert.deepEqual(payload.items[1].tags,['Instagram','Story','@artist']);
  assert.ok(payload.items.every(m=>m.annotation===''));
  assert.throws(()=>C.select({...r,complete:false},d,'stories'),/verify all stories/);
  assert.throws(()=>C.select({...r,media:[{...r.media[0],url:null}]},d,'stories'),/No partial batch/);
  assert.equal(C.postURL(d.url+'?tracking=1'),d.url);
  assert.equal(C.postURL('https://www.instagram.com/stories/artist/'),'https://www.instagram.com/stories/artist/');
  assert.equal(C.postURL('https://www.instagram.com/stories/highlights/123/'),null);
});
test('Story video never becomes a poster or an unproven streaming-only diagnosis', () => {
  const d = {code:'102',storyId:'102',author:'artist',isStory:true,url:'https://www.instagram.com/stories/artist/102/',current:{type:'video',url:'blob:https://www.instagram.com/story'}};
  const r = C.normalizeStories({complete:true,user:{username:'artist'},items:[image('102')],note:'Instagram returned HTTP 403'},d);
  assert.throws(()=>C.select(r,d,'story'),/Could not resolve.*HTTP 403/);
  const resources=C.normalizeStories({complete:true,user:{username:'artist'},items:[{id:'102',is_video:true,video_resources:[{src:'https://v.cdninstagram.com/resource.mp4',config_width:1080,config_height:1920}]}]},d);
  assert.equal(C.select(resources,d,'story')[0].url,'https://v.cdninstagram.com/resource.mp4');
});
test('username-only Stories URLs select the resolved item, not the first item', () => {
  const d={code:'story-hori_hayung',storyId:'',author:'hori_hayung',isStory:true,url:'https://www.instagram.com/stories/hori_hayung/',current:{type:'image',url:'https://s.cdninstagram.com/202.jpg'}};
  const r=C.normalizeStories({complete:true,currentStoryId:'202',user:{username:'hori_hayung'},items:[image('101'),image('202')]},d);
  assert.equal(C.select(r,d,'story')[0].id,'202');
  const item=C.payload(r,C.select(r,d,'story')).items[0];
  assert.equal(item.website,'https://www.instagram.com/stories/hori_hayung/202/');
  assert.equal(item.annotation,'');
  const unknown=C.normalizeStories({complete:false,items:[]},d);
  assert.equal(C.payload(unknown,C.select(unknown,d,'story')).items[0].website,d.url);
});

test('all eight tag combinations work independently for posts, Reels and Stories', () => {
  const base=C.normalize(post,dom);
  for (const kind of ['post','reel','story']) for(let mask=0;mask<8;mask++) {
    const result={...base,isStory:kind==='story',isReel:kind==='reel'};
    const settings={tagDefaults:!!(mask&1),tagCreator:!!(mask&2),tagHashtags:!!(mask&4),tags:['legacy-extra']};
    const expected=[...(mask&1?['Instagram',...(kind==='story'?['Story']:kind==='reel'?['Reel']:[])]:[]),...(mask&2?['@artist']:[]),...(mask&4?['illustration','設計']:[])];
    const item=C.payload(result,[base.media[0]],settings).items[0];
    assert.deepEqual(item.tags,expected);assert.equal(item.annotation,'');assert.equal(item.website,dom.url);
  }
  const perStory={...base.media[0],storyMeta:{...base.meta,author:'story_owner',caption:'#storytag'}};
  assert.deepEqual(C.payload({...base,isStory:true},[perStory]).items[0].tags,['Instagram','Story','@story_owner','storytag']);
  assert.deepEqual(C.payload({...base,meta:{...base.meta,author:'',caption:''}},[base.media[0]]).items[0].tags,['Instagram']);
});
