const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  let queries=0,styles=0;
  const media=(top,width=400,height=700)=>({
    parentElement:null,
    getBoundingClientRect:()=>({left:0,right:width,top,bottom:top+height,width,height}),
    hasAttribute:()=>false,getAttribute:()=>null
  });
  const active=media(0),next=media(0);
  let elements=[...Array.from({length:100},()=>media(0,32,32)),active,
    ...Array.from({length:100},(_,i)=>media(1000+i*800))];
  const context={innerWidth:1000,innerHeight:800,
    document:{querySelectorAll(selector){assert.equal(selector,'img,video');queries++;return elements;}},
    getComputedStyle(){styles++;return {};}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../content/detection.js'),'utf8'),context);
  return {detection:context.EagleDetection,active,next,
    select(value){elements=value;},counts:()=>({queries,styles})};
}

test('Reel refresh shares one media scan and skips style reads for thumbnails/offscreen players',()=>{
  const f=fixture();
  f.detection.withSnapshot(()=>{
    for(let i=0;i<100;i++)assert.equal(f.detection.dominantVisibleMedia(),f.active);
  });
  assert.deepEqual(f.counts(),{queries:1,styles:1});
  f.select([f.next]);
  assert.equal(f.detection.withSnapshot(()=>f.detection.dominantVisibleMedia()),f.next);
  assert.deepEqual(f.counts(),{queries:2,styles:2});
});

test('empty Reel snapshots are cached, and failed refreshes cannot leave stale selection behind',()=>{
  const f=fixture();f.select([]);
  assert.throws(()=>f.detection.withSnapshot(()=>{
    assert.equal(f.detection.dominantVisibleMedia(),null);
    assert.equal(f.detection.dominantVisibleMedia(),null);
    throw new Error('refresh interrupted');
  }),/refresh interrupted/);
  assert.equal(f.counts().queries,1);
  f.select([f.next]);
  assert.equal(f.detection.dominantVisibleMedia(),f.next);
  f.select([f.active]);
  assert.equal(f.detection.dominantVisibleMedia(),f.active);
  assert.equal(f.counts().queries,3);
});
