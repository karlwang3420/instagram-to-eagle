/* Linked post tiles share one hover UI; privileged actions originate in trusted clicks. */
(() => {
  if (globalThis.EagleProfileControls) return;
  const Detection = globalThis.EagleDetection;
  const UI = globalThis.EagleUI;
  if (!Detection || !UI) throw new Error('Eagle detection and UI must load before grid controls.');
  const { linkInfo, isGridMedia } = Detection;
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
  const toast=UI.toast;
  globalThis.EagleProfileControls={isGridMedia};
  const make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
  const button=(text,label)=>{const b=make('button',text);b.type='button';b.title=label||text;b.setAttribute('aria-label',label||text);return b;};
  const downloadIcon=UI.downloadIcon;
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
    const bottomRight=/^\/explore(?:\/|$)/.test(location.pathname);
    record.host.toggleAttribute('data-corner',bottomRight);
    const r=(bottomRight?media:frame).getBoundingClientRect(),parent=record.host.offsetParent;
    if(!parent){record.host.hidden=true;return;}
    record.host.setAttribute('data-eagle-anchor','stable-tile');
    record.host.style.transform=bottomRight?'translate(-100%,-100%)':'translate(-50%,-50%)';
    const x=bottomRight?r.right:r.left+r.width/2;
    const y=bottomRight?r.bottom:r.top+r.height*.7;
    const inset=bottomRight?8:0;
    const s=getComputedStyle(parent);
    if(parent===document.body&&s.position==='static'&&s.transform==='none'&&s.perspective==='none'&&!/(layout|paint|strict|content)/.test(s.contain)){
      record.host.style.left=(x+scrollX-inset)+'px';record.host.style.top=(y+scrollY-inset)+'px';return;
    }
    const p=parent.getBoundingClientRect();
    const sx=p.width/parent.offsetWidth||1,sy=p.height/parent.offsetHeight||1;
    record.host.style.left=((x-p.left)/sx-parent.clientLeft+parent.scrollLeft-inset)+'px';
    record.host.style.top=((y-p.top)/sy-parent.clientTop+parent.scrollTop-inset)+'px';
  }
  function mountTile(a) {
    if(tiles.has(a)){positionTile(a,tiles.get(a));return;}
    const host=make('eagle-profile-control');host.setAttribute('data-eagle-profile-tile','');
    host.style.cssText='position:absolute;width:38px;height:38px;box-sizing:border-box;margin:0;padding:0;transform:translate(-50%,-50%);z-index:4;display:block';
    const shadow=host.attachShadow({mode:'closed'}),style=make('style');
    style.textContent=styles+`:host{opacity:0;pointer-events:none}:host([data-visible]),:host([data-keyboard-focus]){opacity:1;pointer-events:auto}button{display:grid;place-items:center;width:38px;height:38px;color:white;filter:drop-shadow(0 1px 3px #0009)}button:hover{opacity:.75}svg{width:30px;height:30px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}@media(hover:none){:host{opacity:1;pointer-events:auto}}`;
    style.textContent+=`:host([data-corner]) button{border-radius:50%;background:#242626;filter:none}:host([data-corner]) button:hover:enabled{background:#3a3c3c;opacity:1}:host([data-corner]) svg{width:24px;height:24px}`;
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
    timer=null;
    const wanted=new Set();
    for(const a of document.querySelectorAll('a[href]')) {
      if(isGridMedia(a))wanted.add(a);
    }
    for(const [a,record]of tiles)if(!a.isConnected||!wanted.has(a))removeTile(a,record);
    for(const orphan of document.querySelectorAll('[data-eagle-profile-tile]'))if(![...tiles.values()].some(r=>r.host===orphan))orphan.remove();
    for(const a of wanted)mountTile(a);
    scheduleHover();
    // Remove stale bulk UI left behind by an earlier version.
    for(const orphan of document.querySelectorAll('[data-eagle-profile-all],[data-eagle-profile-dialog]'))orphan.remove();
  }
  const schedule=()=>{if(!timer)timer=setTimeout(refresh,180);};
  new MutationObserver(records=>{if(records.some(r=>!(r.target instanceof Element&&r.target.closest(UI.ownedSelector))))schedule();})
    .observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['href','src','class','hidden','inert','aria-hidden','aria-label','style','width','height']});
  window.addEventListener('resize',schedule,{passive:true});
  let lastPath=location.pathname;
  setInterval(()=>{if(lastPath!==location.pathname){lastPath=location.pathname;schedule();}},500);
  browser.runtime.onMessage.addListener(message=>{
    if(message.type==='eagle:profile-layout'){
      const visible=[...document.querySelectorAll('a[href]')].filter(a=>{
        if(!isGridMedia(a))return false;
        const r=a.getBoundingClientRect();return r.width>=100&&r.height>=100&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;
      }).slice(0,4).map(layoutSnapshot);
      const remembered=lastLayoutPath===location.pathname?lastLayout:null;
      const chosen=remembered||visible[0];
      return Promise.resolve(chosen?{ok:true,layout:{...chosen,capture:remembered?'remembered-hover':'visible-grid',visibleTiles:visible}}:
        {ok:false,error:'No post tiles are visible. Scroll to the post grid, then reopen this panel. No hovering is required.'});
    }
    if(message.type==='eagle:resolve-profile'){
      const intent=intents.get(message.marker);intents.delete(message.marker);
      if(!intent||intent.mode!==message.mode||Date.now()-intent.created>60000)return Promise.resolve({ok:false});
      return Promise.resolve({ok:true,context:intent.context});
    }
  });
  schedule();
})();
