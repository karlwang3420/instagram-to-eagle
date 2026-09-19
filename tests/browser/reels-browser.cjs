const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({evaluate,send,waitFor,ig,popup,delay,screenshot}) => {
  // Actual user-supplied rail: nested Save buttons, separate count buttons,
  // and a small audio-cover image/link within the same rail container.
  const rail = fs.readFileSync(path.join(__dirname,'../fixtures/reel-action-rail.html'),'utf8');
  await send('browsingContext.activate',{context:ig});
  await send('browsingContext.setViewport',{context:ig,viewport:{width:1100,height:900}});
  await evaluate(ig, `history.pushState({},'','/reels');
    document.querySelector('main').style.cssText='width:620px;margin:20px auto';
    document.querySelector('main').innerHTML='<div id="reel-scroll" style="height:760px;overflow:auto"></div>';
    const style=document.createElement('style');
    style.textContent='.reel-card{display:flex;align-items:flex-end;gap:16px;height:730px;padding-bottom:30px;color:white;background:#101418}.reel-media{width:400px;height:710px;flex:none}.reel-media video{width:400px;height:710px;background:#53606a}.reel-rail{display:flex;flex-direction:column;align-items:center;gap:0;width:48px;flex:none}.reel-rail>div{display:flex;flex-direction:column;align-items:center;flex:none;margin-bottom:24px}.reel-rail img{width:32px;height:32px}.reel-rail svg{display:block}.reel-rail [role="button"]{cursor:pointer}';
    document.head.append(style);
    window.renderReel=(id,code,permalink)=>{
      const card=document.createElement('div');card.id=id;card.className='reel-card';
      card.innerHTML='<div class="reel-media">'+(permalink?'<a href="/reel/'+code+'/">Reel</a>':'')+'<video src="https://v.cdninstagram.com/'+code+'.mp4"></video></div>'+${JSON.stringify(rail)};
      card.lastElementChild.classList.add('reel-rail');
      card.__reactProps$fixture={post:{code,pk:code,media_type:2,product_type:'clips',user:{username:'fixture'},video_versions:[{url:'https://v.cdninstagram.com/'+code+'.mp4'}]}};
      return card;
    };
    document.getElementById('reel-scroll').append(renderReel('reel-a','REAL_A',false),renderReel('reel-b','REAL_B',false));
    window.reelEntrySheet=style.sheet;
    window.reelEntryRule=reelEntrySheet.insertRule('#reel-scroll {visibility:hidden}',reelEntrySheet.cssRules.length);true`);
  const check = async (id,code) => {
    const selector=`#${id} .reel-rail > [data-eagle-group]`;
    await waitFor(ig,`document.querySelector(${JSON.stringify(selector)})?.querySelector('[data-eagle-control="media"][data-eagle-post="${code}"]:not([hidden])')`);
    const state=JSON.parse(await evaluate(ig,`JSON.stringify((()=>{
      const group=document.querySelector(${JSON.stringify(selector)});
      const control=group.querySelector('[data-eagle-control="media"]');
      const share=group.previousElementSibling.querySelector('svg[aria-label="Share"]');
      const save=group.nextElementSibling.querySelector('svg[aria-label="Save"],svg[aria-label="Remove from saved"]');
      const r=control.getBoundingClientRect(),a=share?.getBoundingClientRect(),b=save?.getBoundingClientRect();
      return {share:!!share,save:!!save,count:document.querySelectorAll('#${id} .reel-rail > [data-eagle-group]').length,
        spacingDifference:a&&b?(r.y+r.height/2-a.y-a.height/2)-(b.y+b.height/2-r.y-r.height/2):null,
        between:!!a&&!!b&&a.bottom<=r.top&&r.bottom<=b.top,position:getComputedStyle(group).position,rect:r.toJSON()};
    })())`));
    assert.equal(state.share,true);assert.equal(state.save,true);assert.equal(state.count,1);
    assert.equal(state.between,true);assert.notEqual(state.position,'absolute');
    assert.ok(Math.abs(state.spacingDifference)<1,'Share/Download/Save centers must be evenly spaced');
    await evaluate(popup,'bg.testPayload=null;true');
    await send('input.performActions',{context:ig,actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[
      {type:'pointerMove',x:Math.round(state.rect.x+state.rect.width/2),y:Math.round(state.rect.y+state.rect.height/2),duration:0},{type:'pointerDown',button:0},{type:'pointerUp',button:0}
    ]}]});
    await waitFor(popup,'bg.testPayload!==null');
    const payload=JSON.parse(await evaluate(popup,'JSON.stringify(bg.testPayload)'));
    assert.equal(payload.items[0].website,`https://www.instagram.com/reel/${code}/`);
    assert.equal(payload.items[0].url,`https://v.cdninstagram.com/${code}.mp4`);
  };
  // The route gets its first shortcode before the player finishes layout.
  // CSSOM changes do not trigger MutationObserver or media/scroll events.
  await delay(800);
  await evaluate(ig,`history.replaceState({},'','/reels/REAL_A/');true`);
  await delay(1000);
  assert.equal(await evaluate(ig,`document.querySelectorAll('#reel-scroll [data-eagle-control]').length`),0);
  await evaluate(ig,`reelEntrySheet.deleteRule(reelEntryRule);true`);
  await check('reel-a','REAL_A');
  assert.equal(await evaluate(ig,`document.getElementById('reel-scroll').scrollTop`),0);
  console.log('PASS first Reel mounts after /reels -> /reels/shortcode and delayed layout, without scrolling');
  await screenshot('reel-captured-dom-firefox.png');
  console.log('PASS captured rail: Download is between Share and Save, despite nested buttons, audio image and audio link; correct Reel imports');
  const scrollMountMs = await evaluate(ig,`new Promise((resolve,reject)=>{
    const start=performance.now();
    const observer=new MutationObserver(()=>{
      if(document.querySelector('#reel-b .reel-rail > [data-eagle-group] [data-eagle-post="REAL_B"]:not([hidden])')){
        observer.disconnect();clearTimeout(timeout);resolve(performance.now()-start);
      }
    });
    const timeout=setTimeout(()=>{observer.disconnect();reject(new Error('Next Reel did not mount'));},2000);
    observer.observe(document.getElementById('reel-b'),{childList:true,subtree:true,attributes:true});
    history.pushState({},'','/reels/REAL_B/');document.getElementById('reel-scroll').scrollTop=760;
  })`);
  assert.ok(scrollMountMs<180,`Reel scroll should bypass the old 200ms debounce; took ${scrollMountMs}ms`);
  console.log(`PASS next Reel control mounts in ${Math.round(scrollMountMs)}ms after scroll`);
  await check('reel-b','REAL_B');
  await evaluate(ig,`const rail=document.querySelector('#reel-b .reel-rail');rail.replaceWith(rail.cloneNode(true));true`);
  await delay(600);await check('reel-b','REAL_B');
  await evaluate(ig,`document.querySelector('#reel-b svg[aria-label="Save"]').setAttribute('aria-label','Remove from saved');true`);
  await delay(300);await check('reel-b','REAL_B');
  // Unknown native layout must retain a usable top-right fallback.
  await evaluate(ig,`document.querySelector('#reel-b svg[aria-label="Share"]').setAttribute('aria-label','Changed action');true`);
  await waitFor(ig,`(()=>{const group=document.querySelector('#reel-b > [data-eagle-group]');return group&&getComputedStyle(group).position==='absolute'&&group.querySelector('[data-eagle-control="media"]')?.hidden===false})()`);
  const fallback=JSON.parse(await evaluate(ig,`JSON.stringify((()=>{const root=document.getElementById('reel-b').getBoundingClientRect(),button=document.querySelector('#reel-b > [data-eagle-group]').getBoundingClientRect();return {right:root.right-button.right,top:button.top-root.top}})())`));
  assert.ok(Math.abs(fallback.right-16)<1);assert.ok(Math.abs(fallback.top-16)<1);
  await evaluate(ig,`document.querySelector('#reel-b svg[aria-label="Changed action"]').setAttribute('aria-label','Share');true`);
  await check('reel-b','REAL_B');
  console.log('PASS unknown action layout falls back to top-right and restores inline placement when native labels return');
  await evaluate(ig,`history.pushState({},'','/reels/REAL_A/');document.getElementById('reel-scroll').scrollTop=0;true`);
  await check('reel-a','REAL_A');
  console.log('PASS scroll to next Reel without permalink, rail replacement, saved-state change, and scroll back preserve placement and correct import');
};
