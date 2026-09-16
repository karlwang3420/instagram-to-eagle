/* Runs only on demand in the Instagram page. Never returns session or React state. */
async function extractInstagramStories(context, allowNetwork, allStories) {
  if (!/^(www\.)?instagram\.com$/.test(location.hostname)
      || !/^[a-f0-9-]{36}$/.test(context.marker) || (context.storyId && !/^\d+$/.test(context.storyId))
      || !/^[\w.]+$/.test(context.author)) throw new Error('Invalid story selection.');
  const root = document.querySelector(`[data-eagle-selection="${context.marker}"]`);
  if (!root) throw new Error('The story viewer changed. Click its download button again.');
  const id = item => String(item?.pk || item?.id || '').split('_')[0];
  const sameName = name => name?.toLowerCase() === context.author.toLowerCase();
  const sameUser = user => sameName(user?.username);
  const media = item => item && (item.image_versions2 || item.display_url || item.display_resources || item.video_versions || item.video_resources || item.video_url);
  const hasVideo = item => !!(item?.video_url || item?.video_versions?.length || item?.video_resources?.length);
  const score = item => (hasVideo(item) ? 10 : 0) + (item?.image_versions2 || item?.display_url ? 2 : 0);
  const candidates = new Map(), activeIDs = new Set(), notes = [];
  let user = null, current = null, fullReel = null;
  function registerReel(reel, fromNetwork = false) {
    const owner = reel?.user || reel?.owner;
    if (!sameUser(owner) || !Array.isArray(reel.items) || !reel.items.length) return;
    if (context.storyId && !reel.items.some(item => id(item) === context.storyId)) return;
    if (reel.items.some(item => !/^\d+$/.test(id(item)) || ((item.user || item.owner) && !sameUser(item.user || item.owner)))) return;
    user = owner;
    const count = reel.media_count ?? reel.reel_media_count ?? reel.total_count;
    const complete = (fromNetwork && count === undefined) || (Number.isInteger(count) && count === reel.items.length);
    if (complete && !reel.has_more && !reel.has_next_page && !reel.page_info?.has_next_page) {
      if (!fullReel || reel.items.reduce((sum,item)=>sum+score(item),0) >= fullReel.items.reduce((sum,item)=>sum+score(item),0)) fullReel = reel;
    }
  }
  function inspect(start) {
    const seen = new WeakSet(), queue = [{obj:start,author:null}], found = new Set();
    for (let i = 0; i < queue.length && i < 10000; i++) {
      const {obj,author} = queue[i];
      if (!obj || typeof obj !== 'object' || seen.has(obj) || obj instanceof Node || obj === window) continue;
      seen.add(obj);
      const owner = obj.user || obj.owner;
      const scope = owner?.username || author;
      if (sameUser(obj) && /^\d+$/.test(id(obj))) user = obj;
      if (media(obj) && /^\d+$/.test(id(obj)) && (!scope || sameName(scope))) {
        found.add(id(obj));
        if (!candidates.has(id(obj)) || score(obj) > score(candidates.get(id(obj)))) candidates.set(id(obj),obj);
        if (sameUser(owner)) user = owner;
      }
      registerReel(obj);
      if (queue.length < 25000) for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(obj))) {
        if (['return','sibling','child','stateNode','_owner','alternate','window','document'].includes(key)) continue;
        if (descriptor.value && typeof descriptor.value === 'object') queue.push({obj:descriptor.value,author:scope});
      }
    }
    return found;
  }
  // Hints come from the element captured by the trusted click, not the first
  // item of the account's list. Autoplay may have changed the element meanwhile.
  const active = root.querySelector(`[data-eagle-active-media="${context.marker}"]`);
  const activeUnchanged = active && (!context.elementURL || (active.currentSrc || active.src || '') === context.elementURL);
  if (!allStories && active && !activeUnchanged) throw new Error('The Story advanced before it could be identified. Click its download button again.');
  // A player often carries only an ID, not the image/video URL payload. Read
  // shallow media identity fields on its nearest fiber before fetching data.
  // Never treat user IDs, arbitrary nested IDs, or a whole reel as its identity.
  function playerIDs(props) {
    const found = new Set();
    if (!props || typeof props !== 'object') return found;
    for (const value of [props.id, props.postId, props.mediaId, props.media?.pk, props.media?.id,
      props.post?.id, props.storyItem?.pk, props.storyItem?.id]) {
      if (typeof value !== 'string' || !/^\d+(?:_\d+)?$/.test(value)) continue;
      found.add(value.split('_')[0]);
    }
    return found;
  }
  function captureHints(props, key) {
    const found = inspect(props);
    // A multi-item collection is not evidence for the current slide.
    if (found.size > 1) return true;
    for (const value of playerIDs(props)) found.add(value);
    if (!found.size && typeof key === 'string' && /^\d+_\d+$/.test(key)) found.add(key.split('_')[0]);
    for (const value of found) activeIDs.add(value);
    return found.size > 0;
  }
  if (!context.storyId && activeUnchanged) {
    for (const key of Object.keys(active)) {
      if (key.startsWith('__reactProps$')) {
        captureHints(active[key]);
      }
      if (key.startsWith('__reactFiber$')) {
        let fiber = active[key];
        for (let n = 0; fiber && n < 20; n++, fiber = fiber.return) {
          if (captureHints(fiber.memoizedProps, fiber.key)) break;
        }
      }
    }
  }
  const elements = [root, ...Array.from(root.querySelectorAll('*')).slice(0,120)];
  for (let el = root.parentElement,n = 0; el && n < 5; el = el.parentElement,n++) elements.push(el);
  for (const el of elements) for (const key of Object.keys(el)) {
    if (key.startsWith('__reactProps$')) inspect(el[key]);
    if (key.startsWith('__reactFiber$')) {
      let fiber = el[key];
      for (let n = 0; fiber && n < 10; n++,fiber = fiber.return) { inspect(fiber.memoizedProps); inspect(fiber.memoizedState); }
    }
  }
  function fingerprint(value) {
    try { const url = new URL(value); return url.protocol === 'https:' ? url.origin+url.pathname : null; } catch { return null; }
  }
  function matchesVisible(item) {
    const urls = [item.display_url,item.video_url,...(item.image_versions2?.candidates || []).map(v=>v.url),
      ...(item.display_resources || []).map(v=>v.src || v.url),...(item.video_versions || item.video_resources || []).map(v=>v.url || v.src)]
      .map(fingerprint).filter(Boolean);
    return [context.current?.url,context.current?.preview].map(fingerprint).filter(Boolean).some(url=>urls.includes(url));
  }
  function resolveCurrent() {
    if (context.storyId) { current = candidates.get(context.storyId) || null; return; }
    const hints = new Set([...candidates.values()].filter(matchesVisible).map(id));
    for (const value of activeIDs) hints.add(value);
    if (!hints.size && fullReel?.items.length === 1) hints.add(id(fullReel.items[0]));
    current = hints.size === 1 ? candidates.get([...hints][0]) || null : null;
  }
  resolveCurrent();
  if (!current || (allStories && !fullReel)) for (const script of document.querySelectorAll('script[type="application/json"]')) {
    if (script.textContent.length > 8000000 || !script.textContent.includes(context.storyId || context.author)) continue;
    try { inspect(JSON.parse(script.textContent)); } catch { /* Not a story payload. */ }
  }
  resolveCurrent();
  async function read(path) {
    const response = await fetch(path, {credentials:'same-origin',redirect:'error',
      headers:{'X-IG-App-ID':'936619743392459','X-IG-WWW-Claim':'0'},signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error(`Instagram returned HTTP ${response.status}`);
    if (!response.headers.get('content-type')?.includes('json')) throw new Error('Instagram returned a login or non-JSON response');
    return response.json();
  }
  function acceptReel(reel) {
    if (!sameUser(reel?.user || reel?.owner)) return;
    inspect(reel); registerReel(reel,true); resolveCurrent();
  }
  const needsData = () => allStories ? !fullReel || fullReel.items.some(item=>(item.media_type===2 || item.is_video) && !hasVideo(item))
    : !current || (context.current?.type==='video' && !hasVideo(current));
  // Use the site's own request client when available. It handles the current
  // session headers without copying cookies/claims across the extension bridge.
  // Only fixed read-only endpoints are callable; never execute page procedures
  // or URLs supplied by messages, and never take the first item as current.
  async function pageRead(api, path, query) {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(() => api.apiGet(path, {query})),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Instagram Story API timed out')), 8000); })
      ]);
    } finally { clearTimeout(timer); }
  }
  function acceptMediaResponse(data, accountID) {
    const reels = [data?.reels?.[accountID], ...(Array.isArray(data?.reels_media) ? data.reels_media : [])];
    for (const reel of reels) {
      if (!reel || String(reel.id ?? id(reel.user || reel.owner)) !== accountID) continue;
      acceptReel(reel);
    }
  }
  if (allowNetwork && needsData()) {
    try {
      const api = typeof window.require === 'function' ? window.require('PolarisInstapi') : null;
      if (typeof api?.apiGet === 'function') {
        if (!user || !/^\d+$/.test(id(user))) {
          const response = await pageRead(api, '/api/v1/feed/reels_tray/', {is_following_feed:false});
          const matches = (Array.isArray(response?.data?.tray) ? response.data.tray : [])
            .filter(reel => sameUser(reel.user) && /^\d+$/.test(id(reel.user)));
          const owners = new Map(matches.map(reel => [id(reel.user), reel.user]));
          if (owners.size === 1) user = [...owners.values()][0];
        }
        if (user && /^\d+$/.test(id(user))) {
          const accountID = id(user);
          const response = await pageRead(api, '/api/v1/feed/reels_media/', {reel_ids:accountID});
          acceptMediaResponse(response?.data, accountID);
        }
      }
    } catch { notes.push('Instagram page-side Story API unavailable'); }
  }
  if (allowNetwork && needsData()) {
    try {
      if (!user) { const profile=await read(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(context.author)}`); if (sameUser(profile.data?.user)) user=profile.data.user; }
    } catch (e) { notes.push(e.message); }
    if (user && /^\d+$/.test(id(user))) {
      try { acceptMediaResponse(await read(`/api/v1/feed/reels_media/?reel_ids=${id(user)}`), id(user)); } catch (e) { notes.push(e.message); }
      if (needsData()) try { acceptReel((await read(`/api/v1/feed/user/${id(user)}/story/`)).reel); } catch (e) { notes.push(e.message); }
      if (needsData()) try {
        const variables=encodeURIComponent(JSON.stringify({reel_ids:[id(user)],precomposed_overlay:false}));
        const json=await read(`/graphql/query/?query_hash=303a4ae99711322310f25250d988f3b7&variables=${variables}`);
        acceptReel(json.data?.reels_media?.find(r=>sameUser(r.user || r.owner) && String(r.id)===id(user)));
      } catch (e) { notes.push(e.message); }
    }
  }
  const items=allStories && fullReel ? fullReel.items : current ? [current] : [];
  const fields=['pk','id','media_type','is_video','__typename','image_versions2','display_resources','display_url','video_versions','video_resources','video_url','caption','edge_media_to_caption','taken_at','taken_at_timestamp'];
  return {complete:allStories ? !!fullReel : !!current,currentStoryId:current ? id(current) : '',note:[...new Set(notes)].join('; '),
    items:items.map(item=>Object.fromEntries(fields.filter(k=>item[k]!==undefined).map(k=>[k,item[k]]))),
    user:{username:context.author,full_name:user?.full_name || ''}};
}
