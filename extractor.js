/* Serialized by scripting.executeScript into Instagram's MAIN world.
   Return only the selected post, never cookies or the surrounding React tree. */
async function extractInstagramPost(context, allowNetwork, mode) {
  if (!/^(www\.)?instagram\.com$/.test(location.hostname)) throw new Error("Open Instagram first.");
  if (!/^[a-f0-9-]+$/.test(context.marker) || !/^[\w-]+$/.test(context.code)) throw new Error("Invalid post selection.");
  // Instagram also emits a shortcode followed by a 28-character suffix.
  // Keep context.code/context.url unchanged for the source link and click
  // binding, but use the canonical code for API IDs and post-data matching.
  const canonicalCode = value => {
    if(typeof value!=='string' || !/^[A-Za-z0-9_-]+$/.test(value))return '';
    return value.length>28?value.slice(0,-28):value;
  };
  const shortcode=canonicalCode(context.code);
  const root = document.querySelector(`[data-eagle-selection="${context.marker}"]`);
  if (!root) throw new Error("The selected post moved or closed. Select it again.");
  if (context.isGrid && canonicalCode(root.href?.match(/\/(?:p|reels?)\/([\w-]+)\/?(?:[?#]|$)/)?.[1]) !== shortcode) throw new Error('This profile tile changed. Select it again.');
  const links = [...root.querySelectorAll('a[href]')].map(a => a.href.match(/\/(?:p|reels?)\/([\w-]+)\/?(?:[?#]|$)/)?.[1]).filter(Boolean);
  if (links.length && !links.some(code=>canonicalCode(code)===shortcode)) throw new Error("The selected post changed. Reopen the popup.");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let numericId = 0n;
  for (const ch of shortcode) numericId = numericId * 64n + BigInt(alphabet.indexOf(ch));
  const wanted = numericId.toString();
  // Capture only the clicked player's nearest identity BEFORE network awaits.
  // A mounted slide/dot window is not an absolute position in the full post.
  const activeMediaIds = [];
  if (mode === 'video' && context.elementURL) {
    const active = root.querySelector(`[data-eagle-active-media="${context.marker}"]`);
    if (!active || active.tagName !== 'VIDEO' || (active.currentSrc || active.src || '') !== context.elementURL) {
      throw new Error('The video changed before it could be identified. Click its download button again.');
    }
    const scalarID = value => {
      if (typeof value === 'number' && !Number.isSafeInteger(value)) return '';
      const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
      return /^\d+(?:_\d+)?$/.test(text) ? text.split('_')[0] : '';
    };
    const read = (o,k) => o && typeof o === 'object' ? Object.getOwnPropertyDescriptor(o,k)?.value : undefined;
    function hints(props, key) {
      const nested = [props, read(props,'media'), read(props,'post'), read(props,'video'), read(props,'videoData')].filter(Boolean);
      // Stop at a whole-post collection, never search its first child for an ID.
      if (nested.some(o => read(o,'carousel_media') || read(o,'edge_sidecar_to_children'))) return {ids:[],stop:true};
      const values = ['id','pk','postId','mediaId','media_id','videoId','videoID','videoFBID','video_id'].map(k=>read(props,k));
      for (const o of nested.slice(1)) for(const k of ['id','pk','video_id','videoFBID']) values.push(read(o,k));
      if (typeof key === 'string' && /^\d+(?:_\d+)?$/.test(key)) values.push(key);
      const ids = [...new Set(values.map(scalarID).filter(id=>id && id!==wanted))];
      return {ids,stop:ids.length>0};
    }
    for (let el=active,depth=0; el && el!==root && depth<10; el=el.parentElement,depth++) {
      let boundary=false;
      for (const key of Object.keys(el)) {
        if (key.startsWith('__reactProps$')) {
          const found=hints(el[key]);activeMediaIds.push(...found.ids);boundary ||= found.stop;
        }
        if (key.startsWith('__reactFiber$')) {
          let fiber=el[key];
          for(let level=0;fiber && level<20;level++,fiber=fiber.return) {
            const found=hints(fiber.memoizedProps,fiber.key);
            activeMediaIds.push(...found.ids);
            if(found.stop){boundary=true;break;}
          }
        }
      }
      if(boundary)break;
    }
  }
  const matches = p => {
    const code=canonicalCode(p?.code || p?.shortcode);
    const id=String(p?.pk || p?.id || '').split('_')[0];
    return (!code || code===shortcode) && (code===shortcode || id===wanted);
  };
  const fileURL = value => {
    try {
      const u=new URL(value);
      return u.protocol==='https:' && !u.username && !u.password && (!u.port || u.port==='443')
        && ['cdninstagram.com','fbcdn.net','instagram.com'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d));
    } catch { return false; }
  };
  const completeFiles = p => {
    if(!p)return false;
    const children=p.carousel_media || p.edge_sidecar_to_children?.edges?.map(e=>e.node);
    const carousel=p.media_type===8 || p.__typename==='GraphSidecar' || !!children;
    const nodes=children || (carousel?[]:[p]);
    if(!nodes.length || (p.carousel_media_count && nodes.length!==p.carousel_media_count))return false;
    return nodes.every(n=>{
      if(!n)return false;
      const video=n.media_type===2 || n.is_video===true || n.__typename==='GraphVideo';
      const versions=video?(n.video_versions || n.video_resources):(n.image_versions2?.candidates || n.display_resources);
      return (versions || []).some(v=>fileURL(v.url || v.src)) || fileURL(video?n.video_url:n.display_url);
    });
  };
  const timeout = async task => {
    let timer;
    try {return await Promise.race([Promise.resolve().then(task),new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error('Post request timed out')),12000);
    })]);} finally {clearTimeout(timer);}
  };
  const stopForHTTP = error => {
    const status=Number(error?.status || error?.statusCode || error?.response?.status);
    if([401,403,429].includes(status))throw new Error(status===429
      ? 'Instagram rate-limited this post request (HTTP 429). Wait before retrying.'
      : 'Instagram requires access verification. Open the post normally before retrying.');
  };
  const candidates = [];
  function walk(start, budget = 16000) {
    const seen = new WeakSet();
    const queue = [start];
    for (let i = 0; i < queue.length && i < budget; i++) {
      const o = queue[i];
      if (!o || typeof o !== "object" || seen.has(o) || o instanceof Node || o === window) continue;
      seen.add(o);
      if (matches(o) && (o.image_versions2 || o.display_url || o.display_resources || o.carousel_media || o.edge_sidecar_to_children || o.video_versions || o.video_resources || o.video_url)) candidates.push(o);
      if (queue.length > budget * 3) continue;
      for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(o))) {
        if (["return", "sibling", "child", "stateNode", "_owner", "alternate", "window", "document"].includes(k)) continue;
        if (d.value && typeof d.value === "object") queue.push(d.value);
      }
    }
  }
  const elements = [root, ...Array.from(root.querySelectorAll("*")).slice(0, 160)];
  for (const el of elements) {
    for (const key of Object.keys(el)) {
      if (key.startsWith("__reactProps$")) walk(el[key], 4000);
      if (key.startsWith("__reactFiber$")) {
        let fiber = el[key];
        for (let i = 0; fiber && i < 7; i++, fiber = fiber.return) {
          walk(fiber.memoizedProps, 3000);
          if (candidates.length) break;
        }
      }
    }
    if (candidates.some(p => p.caption && (p.carousel_media || p.video_versions || p.image_versions2))) break;
  }
  if (!candidates.length) {
    for (const script of document.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]')) {
      if (script.textContent.length > 8000000 || !script.textContent.includes(shortcode)) continue;
      try { walk(JSON.parse(script.textContent)); } catch { /* Not a JSON post payload. */ }
    }
  }
  const score = p => (completeFiles(p) ? 100000 : 0) + (p.carousel_media?.length || p.edge_sidecar_to_children?.edges?.length || 1) * 10
    + (p.caption || p.edge_media_to_caption ? 5 : 0) + (p.user || p.owner ? 3 : 0) + (p.video_versions || p.video_url ? 2 : 0);
  let post = candidates.sort((a, b) => score(b) - score(a))[0] || null;
  let knownCount=Math.max(Number(post?.carousel_media_count)||0,post?.carousel_media?.length||post?.edge_sidecar_to_children?.edges?.length||0);
  const resolvedFiles=p=>completeFiles(p)
    && (p.carousel_media?.length||p.edge_sidecar_to_children?.edges?.length||1)>=knownCount;
  let networkNote = "";
  // Same-origin, read-only request using the browser's existing Instagram session.
  // No credentials are copied to Eagle or to extension storage.
  if (allowNetwork) {
    try {
      let api;
      if(context.isGrid)try{api=window.require?.('PolarisInstapi');}catch{/* Same-origin request below. */}
      let data;
      if(typeof api?.apiGet==='function'){
        const value=await timeout(()=>api.apiGet(`/api/v1/media/${wanted}/info/`,{query:{}}));
        data=value?.data || value;
      }else{
        const response=await fetch(`/api/v1/media/${wanted}/info/`,{
          credentials:'same-origin',headers:{'X-IG-App-ID':'936619743392459','X-IG-WWW-Claim':'0'},
          signal:AbortSignal.timeout(12000)
        });
        stopForHTTP(response);
        if(response.ok && response.headers.get('content-type')?.includes('json'))data=await response.json();
        else networkNote=`Instagram metadata request returned ${response.status}; using page data.`;
      }
      const resolved=data?.items?.find(matches);
      // A thumbnail response must not replace already complete page data.
      if(resolved){
        knownCount=Math.max(knownCount,Number(resolved.carousel_media_count)||0,resolved.carousel_media?.length||resolved.edge_sidecar_to_children?.edges?.length||0);
        if(resolvedFiles(resolved) || (!completeFiles(post) && !completeFiles(resolved)))post=resolved;
      }
    } catch(error) {
      // Do not try alternate endpoints after authentication or rate-limit errors.
      if(/rate-limited|access verification/.test(String(error?.message||'')))throw error;
      stopForHTTP(error);
      networkNote='Instagram metadata request was unavailable; using page data.';
    }
    if(!resolvedFiles(post)){
      // Ask Instagram's own full-post loader, rather than treating ID-only grid
      // children as downloadable files. No hardcoded GraphQL document ID or
      // copied session headers; query only the shortcode selected by the user.
      try{
        const relay=window.require?.('CometRelay');
        const environment=window.require?.('PolarisRelayEnvironment');
        const query=window.require?.('PolarisPostActionLoadPostQuery')?.POST_QUERY;
        if(typeof relay?.fetchQuery==='function' && environment && query){
          const value=await timeout(()=>relay.fetchQuery(environment,query,{
            shortcode,child_comment_count:0,fetch_comment_count:0,
            parent_comment_count:0,has_threaded_comments:false
          }).toPromise());
          // Relay may expose the result directly or behind inline fragments.
          // Walk only this response and insist on the selected post's identity.
          const before=candidates.length;
          walk(value?.data?.xdt_shortcode_media || value?.xdt_shortcode_media || value,8000);
          const resolved=candidates.slice(before).filter(resolvedFiles).sort((a,b)=>score(b)-score(a))[0];
          if(resolved){post=resolved;networkNote='';}
          else networkNote='Instagram did not return complete files for the selected post.';
        }
      }catch(error){
        stopForHTTP(error);
        networkNote='Instagram full-post lookup was unavailable; using page data.';
      }
    }
  }
  if (!post) return { post: null, note: networkNote, activeMediaIds:[...new Set(activeMediaIds)] };
  // Preserve the largest exposed count, so a shorter fallback can never claim
  // a complete carousel merely by omitting its count field.
  if(knownCount>1)post={...post,carousel_media_count:knownCount};
  const keys = ["id", "pk", "code", "shortcode", "media_type", "product_type", "caption", "user", "owner", "taken_at", "taken_at_timestamp", "location", "like_count", "comment_count", "view_count", "play_count", "video_view_count", "usertags", "coauthor_producers", "clips_metadata", "music_metadata", "carousel_media_count", "carousel_media", "image_versions2", "display_resources", "display_url", "video_versions", "video_resources", "video_url", "video_duration", "has_audio", "accessibility_caption", "original_width", "original_height", "dimensions", "edge_sidecar_to_children", "edge_media_to_caption", "edge_media_to_tagged_user", "edge_media_preview_like", "edge_liked_by", "edge_media_to_comment", "edge_media_to_parent_comment", "is_paid_partnership", "sponsor_tags", "product_tags", "fbid", "is_video", "__typename"];
  keys.push('video_id','video_fbid');
  const selected = Object.fromEntries(keys.filter(k => post[k] !== undefined).map(k => [k, post[k]]));
  // Drop cycles only, not repeated references. React/API media may share
  // image/version objects across entries; a global WeakSet erased valid files.
  const ancestors = [];
  const plain = JSON.parse(JSON.stringify(selected, function (key, value) {
    if (typeof value === "bigint") return value.toString();
    if (typeof value === "object" && value !== null) {
      while(ancestors.length&&ancestors[ancestors.length-1]!==this)ancestors.pop();
      if(ancestors.includes(value))return undefined;
      ancestors.push(value);
    }
    return value;
  }));
  return { post: plain, note: networkNote, activeMediaIds:[...new Set(activeMediaIds)] };
}
