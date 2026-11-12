/* Runs only on demand in the Instagram page. Never returns session or React state. */
function extractInstagramStories(context, allStories) {
  if (!/^(www\.)?instagram\.com$/.test(location.hostname)
      || !/^[a-f0-9-]{36}$/.test(context.marker) || (context.storyId && !/^\d+$/.test(context.storyId))
      || !/^[\w.]+$/.test(context.author)) throw new Error('Invalid story selection.');
  const root = document.querySelector(`[data-eagle-selection="${context.marker}"]`);
  if (!root) throw new Error('The story viewer changed. Click its download button again.');
  const id = item => String(item?.pk || item?.id || '').split('_')[0];
  const sameName = name => name?.toLowerCase() === context.author.toLowerCase();
  const fiberOf = el => el && el[Object.keys(el).find(key => key.startsWith('__reactFiber$'))];
  // Hints come from the element captured by the trusted click, not the first
  // item of the account's list. Autoplay may have changed the element meanwhile.
  const active = root.querySelector(`[data-eagle-active-media="${context.marker}"]`);
  const activeUnchanged = active && (!context.elementURL || (active.currentSrc || active.src || '') === context.elementURL);
  if (!allStories && active && !activeUnchanged) throw new Error('The Story advanced before it could be identified. Click its download button again.');

  // The Stories player renders from Instagram's Relay store; its props carry
  // only record references. Read the account's reel from that store instead of
  // requesting it again: the legacy REST and query_hash endpoints are retired.
  let source = null;
  for (let fiber = fiberOf(active) || fiberOf(root); fiber && !source; fiber = fiber.return) {
    const props = fiber.memoizedProps;
    const environment = [props?.value, props?.value?.environment, props?.environment].find(value => typeof value?.getStore === 'function');
    source = environment?.getStore().getSource() || null;
  }
  const resolve = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 8) return value;
    if (value.__ref) return resolve(source.get(value.__ref), depth + 1);
    if (value.__refs) return value.__refs.map(ref => resolve(source.get(ref), depth + 1));
    if (Array.isArray(value)) return value.map(item => resolve(item, depth + 1));
    return Object.fromEntries(Object.entries(value).filter(([key]) => key === '__typename' || !key.startsWith('__'))
      .map(([key, item]) => [key, resolve(item, depth + 1)]));
  };
  const record = source && source.getRecordIDs().map(key => source.get(key))
    .find(value => value?.__typename === 'XDTReelDict' && value.items?.__refs && sameName(source.get(value.user?.__ref)?.username));
  const reel = record && resolve(record);
  const valid = reel?.items.every(item => /^\d+$/.test(id(item)) && (!item.user || sameName(item.user.username)));
  const items = valid ? reel.items : [];
  const itemIDs = new Set(items.map(id));
  // The store has no item count. A batch is complete only when the list
  // reaches the reel's newest Story.
  const reachesNewest = items.length > 0 && Math.max(...items.map(item => item.taken_at || 0)) === reel.latest_reel_media;

  // A player often carries only an ID or a Relay reference, not the media
  // payload. Read shallow identity fields on its nearest fibers. Story videos
  // render through a global video portal whose only identity is videoFBID.
  // IDs outside this account's reel are ignored; conflicting IDs identify nothing.
  function playerIDs(props, key) {
    const found = new Set();
    if (props && typeof props === 'object') {
      for (const value of [props.id, props.postId, props.mediaId, props.media?.pk, props.media?.id,
        props.post?.id, props.storyItem?.pk, props.storyItem?.id, props.coreVideoPlayerMetaData?.videoFBID]) {
        if (typeof value === 'string' && /^\d+(?:_\d+)?$/.test(value)) found.add(value.split('_')[0]);
      }
      for (const value of Object.values(props)) {
        const referenced = typeof value?.__id === 'string' && source?.get(value.__id);
        if (referenced?.pk) found.add(id(referenced));
      }
    }
    if (!found.size && typeof key === 'string' && /^\d+_\d+$/.test(key)) found.add(key.split('_')[0]);
    return [...found].filter(value => itemIDs.has(value));
  }
  function activeID() {
    if (!activeUnchanged) return '';
    for (let fiber = fiberOf(active), n = 0; fiber && n < 20; n++, fiber = fiber.return) {
      const found = playerIDs(fiber.memoizedProps, fiber.key);
      if (found.length) return found.length === 1 ? found[0] : '';
    }
    return '';
  }
  function fingerprint(value) {
    try { const url = new URL(value); return url.protocol === 'https:' ? url.origin + url.pathname : null; } catch { return null; }
  }
  function visibleID() {
    const visible = [context.current?.url, context.current?.preview].map(fingerprint).filter(Boolean);
    const matches = items.filter(item => [...(item.image_versions2?.candidates || []), ...(item.video_versions || [])]
      .some(version => visible.includes(fingerprint(version.url))));
    return matches.length === 1 ? id(matches[0]) : '';
  }
  const currentID = context.storyId || activeID() || visibleID() || (items.length === 1 ? id(items[0]) : '');
  const current = items.find(item => id(item) === currentID) || null;
  const selected = allStories ? items : current ? [current] : [];
  const fields = ['pk','id','media_type','is_video','__typename','image_versions2','video_versions','caption','taken_at'];
  return {complete: allStories ? reachesNewest : !!current, currentStoryId: current ? id(current) : '',
    note: source ? reel ? '' : 'Instagram has not loaded this account\'s Stories in the viewer' : 'Instagram\'s Story data was not found on the page',
    items: selected.map(item => Object.fromEntries(fields.filter(key => item[key] !== undefined).map(key => [key, item[key]]))),
    user: {username: context.author, full_name: reel?.user?.full_name || ''}};
}
