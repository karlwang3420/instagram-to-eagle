/* Independently implemented profile UI; the only privileged actions originate in trusted clicks. */
(() => {
  if (globalThis.EagleProfileControls) return;
  const reserved=new Set(['accounts','explore','reels','reel','p','stories','direct','about','developer','legal','challenge','web','api']);
  const profile=()=>{
    const m=location.pathname.match(/^\/([\w.]{1,30})(?:\/(reels|tagged))?\/?$/);
    return m&&!reserved.has(m[1].toLowerCase())?{username:m[1],tab:m[2]||'posts'}:null;
  };
  const linkInfo=a=>{
    try {const u=new URL(a.href);const m=u.pathname.match(/^\/(?:[\w.]+\/)?(p|reel|reels)\/([\w-]+)\/?$/);
      return u.origin===location.origin&&m?{code:m[2],url:`https://www.instagram.com/${m[1]==='p'?'p':'reel'}/${m[2]}/`}:null;
    } catch {return null;}
  };
  const isGridMedia=el=>!!profile()&&!el.closest('[role="dialog"]')&&!!linkInfo(el.closest('a[href]')||{});
  const tiles=new Map(),intents=new Map();let timer=null;
  let pointer=null,hoverFrame=null,lastLayout=null,lastLayoutOwner=null,lastLayoutTime=0,lastLayoutPath='';
  function layoutSnapshot(a){
    const describe=node=>{
      const r=node.getBoundingClientRect(),s=getComputedStyle(node);
      const pseudo=which=>{const p=getComputedStyle(node,which);return {present:!['none','normal',''].includes(p.content),display:p.display,opacity:p.opacity,background:p.backgroundColor};};
      return {tag:node.tagName,classes:[...node.classList].slice(0,20),rect:[r.x,r.y,r.width,r.height].map(v=>Math.round(v*10)/10),
        style:{display:s.display,position:s.position,opacity:s.opacity,visibility:s.visibility,pointerEvents:s.pointerEvents,overflowX:s.overflowX,overflowY:s.overflowY,transform:s.transform,objectFit:s.objectFit,background:s.backgroundColor},
        hovered:node.matches(':hover'),before:pseudo('::before'),after:pseudo('::after'),children:node.children.length};
    };
    const nodes=[a,...a.querySelectorAll('*')].slice(0,80);
    const ancestors=[];for(let p=a.parentElement;p&&ancestors.length<4;p=p.parentElement)ancestors.push(describe(p));
    return {schema:1,version:browser.runtime.getManifest().version,viewport:[innerWidth,innerHeight],pointer,
      icon:tiles.get(a)?.host?.isConnected?describe(tiles.get(a).host):null,nativeOverlayCount:a.querySelectorAll('._aajz').length,
      tree:nodes.map(n=>({...describe(n),parent:n===a?-1:nodes.indexOf(n.parentElement)})),ancestors};
  }
  function syncHover(){
    hoverFrame=null;
    const owner=pointer?document.elementFromPoint(pointer.x,pointer.y)?.closest('a[href]'):null;
    for(const [a,record]of tiles)record.host.toggleAttribute('data-visible',a===owner);
    if(tiles.has(owner)&&(owner!==lastLayoutOwner||Date.now()-lastLayoutTime>250)){
      lastLayout=layoutSnapshot(owner);lastLayoutOwner=owner;lastLayoutTime=Date.now();lastLayoutPath=location.pathname;
    }
  }
  const scheduleHover=()=>{if(!hoverFrame)hoverFrame=requestAnimationFrame(syncHover);};
  document.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;pointer={x:e.clientX,y:e.clientY};scheduleHover();},{capture:true,passive:true});
  document.addEventListener('pointerout',e=>{if(!e.relatedTarget){pointer=null;scheduleHover();}},{capture:true,passive:true});
  window.addEventListener('blur',()=>{pointer=null;scheduleHover();});
  document.addEventListener('scroll',scheduleHover,{capture:true,passive:true});
  const toast=(text,failed=false)=>globalThis.EagleUI?.toast(text,failed);
  globalThis.EagleProfileControls={isGridMedia};
  const make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
  const button=(text,label)=>{const b=make('button',text);b.type='button';b.title=label||text;b.setAttribute('aria-label',label||text);return b;};
  const downloadIcon=()=>{
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M12 3v12m-5-5 5 5 5-5M3 15v5a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-5');svg.append(path);return svg;
  };
  const styles=`button{all:unset;box-sizing:border-box;cursor:pointer;font:inherit}button:focus-visible{outline:2px solid #a8ccff;outline-offset:3px;border-radius:4px}button:disabled{opacity:.45;cursor:wait}`;
  function removeTile(a,record) {
    record.host.remove();
    record.resize.disconnect();
    tiles.delete(a);
  }
  function positionTile(a,record) {
    // One stable owner and coordinate system, with or without native hover
    // stats. Never reparent into transient overlays or change Instagram styles.
    const media=[...a.querySelectorAll('img,video')].find(m=>{const r=m.getBoundingClientRect();return r.width>=100&&r.height>=100;});
    if(!media){record.host.hidden=true;return;}
    const imageRect=media.getBoundingClientRect();
    let frame=media;
    for(let node=media.parentElement,depth=0;node&&node.tagName!=='MAIN'&&depth<8;node=node.parentElement,depth++){
      const r=node.getBoundingClientRect(),s=getComputedStyle(node);
      if(r.width<100||r.height<100||r.width>imageRect.width*1.35||r.height>Math.max(imageRect.height,r.width*2))continue;
      // A positioned tile may enclose a letterboxed image. Reject grid/row
      // containers (multiple post links) and oversized fragmented anchors.
      if(s.position!=='static'&&(!node.contains(a)||node.querySelectorAll('a[href]').length<=1)) {frame=node;break;}
    }
    if(record.media!==media||record.frame!==frame){record.resize.disconnect();record.resize.observe(media);if(frame!==media)record.resize.observe(frame);record.media=media;record.frame=frame;}
    if(record.host.parentElement!==a)a.append(record.host);
    record.host.hidden=false;
    const r=frame.getBoundingClientRect(),parent=record.host.offsetParent;
    if(!parent){record.host.hidden=true;return;}
    record.host.setAttribute('data-eagle-anchor','stable-tile');
    const y=r.height*.7;
    const s=getComputedStyle(parent);
    if(parent===document.body&&s.position==='static'&&s.transform==='none'&&s.perspective==='none'&&!/(layout|paint|strict|content)/.test(s.contain)){
      record.host.style.left=(r.left+scrollX+r.width/2)+'px';record.host.style.top=(r.top+scrollY+y)+'px';return;
    }
    const p=parent.getBoundingClientRect();
    const sx=p.width/parent.offsetWidth||1,sy=p.height/parent.offsetHeight||1;
    record.host.style.left=((r.left-p.left+r.width/2)/sx-parent.clientLeft+parent.scrollLeft)+'px';
    record.host.style.top=((r.top-p.top+y)/sy-parent.clientTop+parent.scrollTop)+'px';
  }
  function mountTile(a) {
    if(tiles.has(a)){positionTile(a,tiles.get(a));return;}
    const host=make('eagle-profile-control');host.setAttribute('data-eagle-profile-tile','');
    host.style.cssText='position:absolute;width:38px;height:38px;box-sizing:border-box;margin:0;padding:0;transform:translate(-50%,-50%);z-index:4;display:block';
    const shadow=host.attachShadow({mode:'closed'}),style=make('style');
    style.textContent=styles+`:host{opacity:0;pointer-events:none}:host([data-visible]),:host([data-keyboard-focus]){opacity:1;pointer-events:auto}button{display:grid;place-items:center;width:38px;height:38px;color:white;filter:drop-shadow(0 1px 3px #0009)}button:hover{opacity:.75}svg{width:30px;height:30px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}@media(hover:none){:host{opacity:1;pointer-events:auto}}`;
    const b=button('','Save all images and videos from this post to Eagle');b.append(downloadIcon());shadow.append(style,b);
    b.addEventListener('focus',()=>host.toggleAttribute('data-keyboard-focus',b.matches(':focus-visible')));
    b.addEventListener('blur',()=>host.removeAttribute('data-keyboard-focus'));
    b.addEventListener('pointerdown',()=>host.removeAttribute('data-keyboard-focus'));
    const record={host,button:b,media:null,frame:null,resize:new ResizeObserver(()=>{positionTile(a,record);scheduleHover();})};
    b.onclick=async e=>{
      e.preventDefault();e.stopPropagation();if(!e.isTrusted||b.disabled)return;
      const info=linkInfo(a);if(!info||!isGridMedia(a))return;
      b.disabled=true;const marker=crypto.randomUUID();a.setAttribute('data-eagle-selection',marker);
      // The root selection marker and the one-use action marker are separate.
      try {
        const actionMarker=crypto.randomUUID();const context={...info,marker,isGrid:true};
        intents.set(actionMarker,{context,mode:'grid',created:Date.now()});
        try {
          const reply=await browser.runtime.sendMessage({type:'eagle:profile-action',marker:actionMarker,mode:'grid'});
          if(!reply?.ok)throw new Error(reply?.error||'Could not save this post.');
        }finally{intents.delete(actionMarker);}
      }catch(error){toast(error.message,true);}
      finally{b.disabled=false;if(a.getAttribute('data-eagle-selection')===marker)a.removeAttribute('data-eagle-selection');}
    };
    tiles.set(a,record);positionTile(a,record);scheduleHover();
  }
  function refresh() {
    timer=null;const route=profile();
    const wanted=new Set();
    if(route)for(const a of document.querySelectorAll('main a[href]')) {
      if(!isGridMedia(a)||!a.querySelector('img,video')||a.closest('header'))continue;
      const r=a.getBoundingClientRect();if(r.width<100||r.height<100)continue;
      wanted.add(a);
    }
    for(const [a,record]of tiles)if(!a.isConnected||!wanted.has(a))removeTile(a,record);
    for(const orphan of document.querySelectorAll('[data-eagle-profile-tile]'))if(![...tiles.values()].some(r=>r.host===orphan))orphan.remove();
    for(const a of wanted)mountTile(a);
    scheduleHover();
    // Remove stale bulk UI left behind by an earlier version.
    for(const orphan of document.querySelectorAll('[data-eagle-profile-all],[data-eagle-profile-dialog]'))orphan.remove();
  }
  const schedule=()=>{if(!timer)timer=setTimeout(refresh,180);};
  new MutationObserver(records=>{if(records.some(r=>!(r.target instanceof Element&&r.target.closest('[data-eagle-profile-all],[data-eagle-profile-tile],[data-eagle-profile-dialog],#instagram-eagle-status'))))schedule();})
    .observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['href','src','class','hidden']});
  window.addEventListener('resize',schedule,{passive:true});
  let lastPath=location.pathname;setInterval(()=>{if(lastPath!==location.pathname){lastPath=location.pathname;schedule();}},500);
  browser.runtime.onMessage.addListener(message=>{
    if(message.type==='eagle:profile-status')return Promise.resolve({isProfile:!!profile()&&!document.querySelector('[role="dialog"]'),username:profile()?.username});
    if(message.type==='eagle:profile-layout'){
      if(!profile())return Promise.resolve({ok:false,error:'Open the affected Instagram profile to capture its layout.'});
      const visible=[...document.querySelectorAll('main a[href]')].filter(a=>{
        if(!isGridMedia(a)||!a.querySelector('img,video'))return false;
        const r=a.getBoundingClientRect();return r.width>=100&&r.height>=100&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;
      }).slice(0,4).map(layoutSnapshot);
      const remembered=lastLayoutPath===location.pathname?lastLayout:null;
      const chosen=remembered||visible[0];
      return Promise.resolve(chosen?{ok:true,layout:{...chosen,capture:remembered?'remembered-hover':'visible-grid',visibleTiles:visible}}:
        {ok:false,error:'No profile tiles are visible. Scroll to the post grid, then reopen this panel. No hovering is required.'});
    }
    if(message.type==='eagle:resolve-profile'){
      const intent=intents.get(message.marker);intents.delete(message.marker);
      if(!intent||intent.mode!==message.mode||Date.now()-intent.created>60000)return Promise.resolve({ok:false});
      return Promise.resolve({ok:true,context:intent.context});
    }
  });
  schedule();
})();
