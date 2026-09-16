const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
function fixture(granted=[]) {
  const grants=new Set(granted),fetches=[],tabs=[],badges=[],listeners={};
  const event=name=>({addListener(fn){listeners[name]=fn;}});
  const c=vm.createContext({URL,console,AbortSignal,Response,crypto:require('node:crypto').webcrypto,
    fetch:async(...args)=>{fetches.push(args);return new Response(JSON.stringify({status:'success',data:{version:'4.0.0'}}));},
    browser:{permissions:{contains:async p=>p.origins.every(x=>grants.has(x)),onAdded:event('added'),onRemoved:event('removed')},
      action:{setBadgeText:async x=>badges.push(x.text),setBadgeBackgroundColor:async()=>{},setTitle:async()=>{}},
      storage:{local:{get:async defaults=>defaults}},
      runtime:{id:'test',getURL:p=>'moz-extension://test/'+p,onMessage:event('message'),onInstalled:event('installed')},
      tabs:{create:async x=>tabs.push(x),onRemoved:event('tabRemoved')}}});
  for(const file of ['access.js','background.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  return {c,grants,fetches,tabs,badges,listeners};
}
test('missing localhost grant rejects GET and POST before any Eagle request',async()=>{
  const f=fixture(['https://www.instagram.com/*','https://instagram.com/*']);
  assert.equal((await f.c.EagleAccess.state()).eagle,false);
  await assert.rejects(f.c.eagle('/api/application/info'),/Allow access.*Nothing was sent/);
  await assert.rejects(f.c.eagle('/api/item/addFromURLs',{items:[]}),/Allow access/);
  assert.equal(f.fetches.length,0);
  f.grants.add('http://127.0.0.1/*');assert.equal((await f.c.eagle('/api/application/info')).version,'4.0.0');
  f.grants.delete('http://127.0.0.1/*');await assert.rejects(f.c.eagle('/api/item/addFromURLs',{}),/Allow access/);
  assert.equal(f.fetches.length,1);
});
test('install opens first-run setup; granted updates stay quiet; revoked updates offer setup',async()=>{
  const f=fixture(['https://www.instagram.com/*','https://instagram.com/*','http://127.0.0.1/*']);
  await f.c.installed({reason:'install'});assert.equal(f.tabs.length,1);assert.match(f.tabs[0].url,/popup.html\?setup=1$/);
  await f.c.installed({reason:'update'});assert.equal(f.tabs.length,1);
  f.grants.delete('http://127.0.0.1/*');await f.c.installed({reason:'update'});assert.equal(f.tabs.length,2);assert.equal(f.badges.at(-1),'!');
});
test('setup tab can only query settings services; arbitrary extension tabs and imports are rejected',async()=>{
  const f=fixture(['http://127.0.0.1/*']);
  const sender={id:'test',url:'moz-extension://test/popup.html?setup=1',tab:{id:1},frameId:0};
  assert.equal((await f.listeners.message({type:'status'},sender)).ok,true);
  assert.equal((await f.listeners.message({type:'save'},sender)).ok,false);
  for(const s of [{...sender,id:'other'},{...sender,url:'https://www.instagram.com/'},{...sender,url:'moz-extension://test/popup.html'},{...sender,frameId:1}]) {
    assert.equal(f.listeners.message({type:'status'},s),undefined);
  }
});
