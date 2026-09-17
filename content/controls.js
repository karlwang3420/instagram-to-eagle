(() => {
  if (globalThis.__instagramEagleLoaded) return;
  globalThis.__instagramEagleLoaded = true;
  let hovered = null;
  let rightClicked = null;
  const selections = new Map();
  const inlineIntents = new Map();
  const toolbars = new Map();
  let inlineBusy = false;
  let storyOwner = null;
  const Detection = globalThis.EagleDetection;
  const UI = globalThis.EagleUI;
  if (!Detection || !UI) throw new Error('Eagle detection and UI must load before post controls.');
  const { postPattern, storyRoute, visibleRect, nativePlayback, largeMedia, findStoryRoot, bookmarkControl } = Detection;
  const source = root => Detection.source(root, storyOwner);
  const rootFor = element => Detection.rootFor(element, { storyOwner });
  const toast = UI.toast;
  const { downloadPath, batchPath } = UI;
  function postMedia(root) {
    return [...root.querySelectorAll("img,video")].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width >= 140 && r.height >= 140 && !el.closest("header") && rootFor(el) === root;
    });
  }
  function carouselModel(root) {
    if (storyRoute() || /\/reels?\//.test(source(root))) return {isCarousel:false,slides:[]};
    return EagleCarouselDOM.describe(root,postMedia(root),el=>visibleRect(el,root));
  }
  function currentElement(root, model = carouselModel(root)) {
    if (model.isCarousel && !model.ready) return null;
    const candidates = model.activeSlide?.media || postMedia(root);
    const media = candidates.map(el => ({ el, area: visibleRect(el, root) })).sort((a, b) => b.area - a.area || Number(b.el.tagName === "VIDEO") - Number(a.el.tagName === "VIDEO"));
    return media[0]?.area > 0 ? media[0].el : null;
  }
  function current(root, model) {
    const el = currentElement(root, model);
    if (!el) return null;
    if (el.tagName === "VIDEO") return { type: "video", url: el.currentSrc || el.src || el.querySelector("source")?.src || "", preview: el.poster, width: el.videoWidth, height: el.videoHeight };
    const variants = el.srcset.split(",").map(s => s.trim().split(/\s+/)).sort((a, b) => parseFloat(b[1] || 0) - parseFloat(a[1] || 0));
    return { type: "image", url: variants[0]?.[0] || el.currentSrc || el.src, alt: el.alt, width: el.naturalWidth, height: el.naturalHeight };
  }
  function choose(useContext) {
    if (storyRoute()) return storyOwner = findStoryRoot();
    if (useContext && rightClicked?.isConnected) return rightClicked;
    if (hovered?.isConnected && visibleRect(hovered)) return hovered;
    const roots = [...new Set([...document.querySelectorAll('article,img,video')].filter(el => {
      const r = el.getBoundingClientRect(); return r.width >= 140 && r.height >= 140 && visibleRect(el);
    }).map(rootFor).filter(Boolean))];
    return roots.map(root => ({ root, area: visibleRect(root) })).sort((a, b) => b.area - a.area).find(x => x.area > 0)?.root;
  }
  function snapshot(root, marker) {
    if (!root?.isConnected) throw new Error("Hover an Instagram post or Reel, then open the add-on.");
    const story = storyRoute();
    if (story && root === storyOwner) {
      const active = currentElement(root);
      if (marker && active) active.setAttribute('data-eagle-active-media', marker);
      return {
        marker, code: story[2] || `story-${story[1]}`, storyId: story[2] || '', isStory: true, author: story[1],
        url: `https://www.instagram.com/stories/${story[1]}/${story[2] ? story[2] + '/' : ''}`,
        caption: '', current: current(root), elementURL: active?.currentSrc || active?.src || ''
      };
    }
    const raw = source(root);
    const code = raw?.match(postPattern)?.[1];
    if (!code) throw new Error("No post link found. Open the post or Reel and try again.");
    const isReel = /\/reels?\//.test(raw);
    const model = carouselModel(root);
    if (model.isCarousel && !model.ready) throw new Error('The carousel is changing slides. Wait for it to settle, then retry.');
    const authorLink = [...root.querySelectorAll('a[href]')].find(a => /^\/[\w.]+\/$/.test(new URL(a.href).pathname) && a.textContent.trim() && !["explore", "reels", "direct", "accounts"].includes(new URL(a.href).pathname.split("/")[1]));
    const caption = root.querySelector("h1")?.textContent || "";
    const active = currentElement(root, model);
    if (marker && active) active.setAttribute('data-eagle-active-media', marker);
    return {
      marker, code, url: `https://www.instagram.com/${isReel ? "reel" : "p"}/${code}/`,
      author: authorLink ? new URL(authorLink.href).pathname.split("/")[1] : "", caption,
      published: root.querySelector("time[datetime]")?.dateTime || "",
      visibleText: root.innerText, current: current(root,model), elementURL: active?.currentSrc || active?.src || '',
      slideIndex: model.index || null, slideCount: model.count || null
    };
  }
  function remember(root) {
    const marker = crypto.randomUUID();
    const context = snapshot(root, marker);
    const prior = root.getAttribute("data-eagle-selection");
    if (prior) selections.delete(prior);
    root.setAttribute("data-eagle-selection", marker);
    selections.set(marker, { root, context });
    for (const [id, s] of selections) if (!s.root.isConnected) selections.delete(id);
    return context;
  }
  function button(root, direction, withinPost = false) {
    const pattern = direction === "next" ? /^(next|next slide|go to next slide|下一步|下一張|下一张|下一個|下一頁|下一页|次へ|weiter|suivant|siguiente)$/i : /^(previous|back|go back|previous slide|go to previous slide|上一張|上一张|上一個|上一頁|上一页|上一步|前へ|zurück|précédent|anterior)$/i;
    return [...root.querySelectorAll('button,[role="button"]')].find(b => !b.closest('[data-eagle-control],[data-eagle-group]') && (withinPost || !b.disabled && b.getAttribute("aria-disabled") !== "true" && visibleRect(b)) && pattern.test((b.getAttribute("aria-label") || b.querySelector("[aria-label]")?.getAttribute("aria-label") || b.textContent).trim()));
  }
  const key = m => m?.type + ":" + (m?.url || m?.preview || "").split("?")[0];
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function step(root, direction, code) {
    if (!root.isConnected || snapshot(root, "").code !== code) throw new Error("The post changed while collecting. Try again.");
    const b = button(root, direction);
    if (!b) return false;
    const old = key(current(root));
    b.click();
    for (let i = 0; i < 25; i++) {
      await delay(100);
      if (key(current(root)) !== old && current(root)) { await delay(250); return true; }
    }
    throw new Error("The carousel did not advance. Open the post and retry.");
  }
  async function carousel(selection) {
    const { root, context } = selection;
    const original = key(current(root));
    let position = 0;
    let originalPosition = 0;
    let startedAtFirst = false;
    const items = [];
    const seen = new Set();
    let restorationNote = "";
    try {
      // Reach the first slide; never navigate outside the selected post.
      for (let i = 0; i < 50; i++) {
        if (!await step(root, "previous", context.code)) { startedAtFirst = true; break; }
        originalPosition++;
      }
      if (!startedAtFirst) throw new Error("Carousel exceeds the supported 50 slides.");
      let finished = false;
      for (let i = 0; i < 50; i++) {
        const m = current(root);
        if (!m || seen.has(key(m))) throw new Error("Could not verify every slide. Nothing was sent.");
        seen.add(key(m)); items.push({ ...m, index: i + 1 });
        if (!await step(root, "next", context.code)) { finished = true; break; }
        position++;
      }
      if (!finished) throw new Error("Carousel exceeds the supported 50 slides.");
      if (items.length === 1) throw new Error("Full post data is unavailable and no carousel controls were found. Use Current image, or open the post and retry.");
      return { items, note: restorationNote };
    } finally {
      // Best effort restoration even when collection failed.
      try {
        if (startedAtFirst) {
          while (position > originalPosition) { if (!await step(root, "previous", context.code)) break; position--; }
          while (position < originalPosition) { if (!await step(root, "next", context.code)) break; position++; }
        } else {
          for (let i = 0; i < originalPosition; i++) if (!await step(root, "next", context.code)) break;
        }
        if (key(current(root)) !== original) restorationNote = "Return to your previous carousel slide manually.";
      } catch { restorationNote = "The original carousel slide could not be restored."; }
      if (restorationNote) toast(restorationNote);
    }
  }
  const controlsFor = record => [record.media,record.all,...record.slideControls.values()];
  function iconControl(kind, record, slideElement = null) {
    const host = document.createElement("div"); host.setAttribute("data-eagle-control", kind);
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      :host{display:inline-flex;position:relative;flex:0 0 36px;align-self:center;width:36px;height:36px;margin:0;padding:0;box-sizing:border-box;visibility:visible}
      :host([hidden]){display:none!important;visibility:hidden!important}
      :host([data-overlay]){position:absolute;top:12px;right:12px;z-index:3}
      button{appearance:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;margin:0;padding:6px;border:0;border-radius:50%;background:#242626;color:white;cursor:pointer;box-sizing:border-box;transition:background .12s,opacity .12s}
      button:hover:enabled{background:#3a3c3c}button:focus-visible{outline:2px solid #fff;outline-offset:3px;box-shadow:0 0 0 5px #222}
      button:disabled{opacity:.55;cursor:progress}svg{display:block;width:23px;height:23px;pointer-events:none}
      :host([data-eagle-control="all"]) button{background:transparent;border-radius:7px;color:var(--eagle-ink,#f5f5f5);padding:3px}
      :host([data-eagle-control="all"]) button:hover:enabled{opacity:.65;background:transparent}
      :host([data-eagle-control="all"]) svg{width:27px;height:27px}
      :host([data-player]) button{background:transparent;filter:drop-shadow(0 1px 3px #0009)}
      :host([data-player]) button:hover:enabled{background:#0004}
      @media(prefers-reduced-motion:reduce){button{transition:none}}
    `;
    const b = document.createElement("button"); b.type = "button";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(k, v);
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", kind === "all" ? batchPath : downloadPath);
    svg.append(path); b.append(svg); shadow.append(style, b);
    b.addEventListener("click", async e => {
      e.preventDefault(); e.stopPropagation();
      if (!e.isTrusted || inlineBusy) return;
      inlineBusy = true;
      for (const item of toolbars.values()) for (const control of controlsFor(item)) control.button.disabled = true;
      let marker;
      try {
        if (slideElement) {
          const model = carouselModel(record.root);
          if (!model.ready || model.activeSlide?.el !== slideElement) throw new Error('This slide is no longer selected. Click the current slide again.');
        }
        const context = remember(record.root); marker = context.marker;
        if (context.code !== record.code) throw new Error("The post changed. Try its download button again.");
        const mode = context.isStory ? (kind === "all" ? "stories" : "story") : kind === "all" && record.isCarousel ? "post" : record.isReel ? "reel" : context.current?.type === "video" ? "video" : "current";
        inlineIntents.set(marker, { context, mode, created: Date.now() });
        const reply = await browser.runtime.sendMessage({ type: "eagle:inline", marker, mode });
        if (!reply?.ok) throw new Error(reply?.error || "Reload the add-on and this Instagram tab, then retry.");
      } catch (err) { toast(err.message, true); }
      finally {
        inlineIntents.delete(marker); inlineBusy = false;
        for (const item of toolbars.values()) for (const control of controlsFor(item)) control.button.disabled = false;
      }
    });
    host.hidden = true; record.root.append(host);
    return { host, button: b, path, patches:[] };
  }
  function addToolbar(root) {
    const record = { root, code: "", isReel: false, isCarousel: false, frame: null, bookmark: null, slideControls:new Map() };
    record.media = iconControl("media", record); record.all = iconControl("all", record);
    record.group = document.createElement('div'); record.group.setAttribute('data-eagle-group','');
    record.group.style.cssText = 'display:inline-flex;align-items:center;gap:8px;flex:0 0 auto;line-height:0';
    record.patches = [];
    toolbars.set(root, record); return record;
  }
  function mediaAnchor(root) {
    const media = currentElement(root);
    if (!media) return null;
    const m = media.getBoundingClientRect(), bounds = root.getBoundingClientRect();
    let anchor = media;
    const existingHost = toolbars.get(root)?.all.host;
    // Find the frame around the media, skipping over the extra-wide slide track.
    // Keep author/caption/actions outside the media frame.
    for (let p = media.parentElement; p && p !== root; p = p.parentElement) {
      const r = p.getBoundingClientRect();
      if (r.height > m.height + 48) break;
      if (r.width <= bounds.width + 8 && r.width >= 140 && r.height >= 140 && (!existingHost || !p.contains(existingHost))) anchor = p;
    }
    return anchor.matches('img,video') ? anchor.parentElement : anchor;
  }
  function bookmarkSlot(control, root) {
    if (!control) return null;
    let branch = control;
    for (let parent=branch.parentElement; parent && parent!==root; branch=parent,parent=parent.parentElement) {
      if (parent.querySelector('img,video')) break;
      const siblings = [...parent.children].filter(el=>el!==branch && !el.hasAttribute('data-eagle-group'));
      if (siblings.some(el=>el.matches('button,[role="button"]') || el.querySelector('button,[role="button"]'))) return {parent,before:branch};
    }
    return null;
  }
  function rowSlot(control, root) {
    if (!control) return null;
    let branch = control;
    for (let parent = branch.parentElement; parent && root.contains(parent); branch = parent, parent = parent.parentElement) {
      const s = getComputedStyle(parent), r = parent.getBoundingClientRect();
      if (largeMedia(parent).length) break;
      const siblings = [...parent.children].filter(el => !el.hasAttribute('data-eagle-group'));
      if (siblings.length >= 2 && ((s.display.includes('flex') && !s.flexDirection.startsWith('column')) || s.display.includes('grid') || (r.height <= 80 && !s.display.includes('flex') && parent.querySelectorAll('button,[role="button"]').length >= 2))) return {parent,before:branch};
    }
    return null;
  }
  function patchStyle(record, el, property, value) {
    if (record.patches.some(p => p.el === el && p.property === property)) return;
    record.patches.push({el,property,value,old:el.style.getPropertyValue(property),priority:el.style.getPropertyPriority(property)});
    el.style.setProperty(property,value);
  }
  function restoreStyles(record) {
    for (const p of record.patches) if (p.el.style.getPropertyValue(p.property) === p.value) {
      if (p.old) p.el.style.setProperty(p.property,p.old,p.priority); else p.el.style.removeProperty(p.property);
    }
    record.patches = [];
  }
  function mountControls(record) {
    const {media,all,group,root} = record;
    const playback = record.playerOverlay ? nativePlayback(root) : [];
    const control = record.playerOverlay ? playback[0] : record.bookmark;
    const slot = record.playerOverlay ? rowSlot(control,root) : bookmarkSlot(control,root);
    const mode = record.playerOverlay ? 'player' : 'bottom';
    const parent = slot?.parent || (record.playerOverlay ? root : record.frame.parentElement);
    if (record.slotParent !== parent || record.slotBefore !== slot?.before || record.slotMode !== mode) {
      restoreStyles(record);
      group.style.marginInlineStart = ''; group.style.position = ''; group.style.top = ''; group.style.right = ''; group.style.zIndex = ''; group.style.display = 'inline-flex'; group.style.justifyContent = '';
      record.slotParent = parent; record.slotBefore = slot?.before; record.slotMode = mode;
      if (slot && !record.playerOverlay) {
        const layout = getComputedStyle(slot.parent);
        const nativeChildren = [...slot.parent.children].filter(el => el !== group);
        // A third child in Instagram's two-column grid otherwise puts the
        // bookmark on the next grid row. Keep the actual action row unwrapped.
        if (!layout.display.includes('flex')) patchStyle(record,slot.parent,'display','flex');
        patchStyle(record,slot.parent,'flex-direction','row');
        patchStyle(record,slot.parent,'flex-wrap','nowrap');
        patchStyle(record,slot.parent,'align-items','center');
        patchStyle(record,slot.before,'flex','0 0 auto');
        if (nativeChildren.length === 2 && nativeChildren[1] === slot.before
            && nativeChildren[0].querySelector('button,[role="button"]')) {
          patchStyle(record,nativeChildren[0],'flex','1 1 0%');
          patchStyle(record,nativeChildren[0],'min-width','0px');
        }
        // Transfer an auto spacer to our adjacent group so the bookmark remains
        // right-aligned without a second viewport-positioned overlay.
        const s = getComputedStyle(slot.before);
        if (s.marginLeft === 'auto' || s.marginInlineStart === 'auto' || slot.parent.lastElementChild === slot.before) {
          group.style.marginInlineStart = 'auto';
          patchStyle(record,slot.before,'margin-left','0px');
          patchStyle(record,slot.before,'margin-inline-start','0px');
        }
      } else if (!slot && record.playerOverlay) {
        if (getComputedStyle(root).position === 'static') patchStyle(record,root,'position','relative');
        group.style.position = 'absolute'; group.style.top = '16px'; group.style.right = '16px'; group.style.zIndex = '3';
      } else if (!slot) {
        group.style.display = 'flex'; group.style.justifyContent = 'flex-end';
      }
    }
    const children = record.playerOverlay ? (record.isStory ? [media.host,all.host] : [media.host]) : [all.host];
    if (children.length !== group.children.length || children.some((el,i)=>group.children[i]!==el)) group.replaceChildren(...children);
    if (slot) {
      if (group.parentElement !== parent || group.nextElementSibling !== slot.before) parent.insertBefore(group,slot.before);
    } else if (record.playerOverlay) { if (group.parentElement !== root) root.append(group); }
    else if (record.frame.nextElementSibling !== group) record.frame.after(group);
    const hasSlideControls = record.isCarousel && record.model.slides.length && record.model.slides.every(slide=>!slide.el.matches('img,video'));
    const slideElements = new Set(hasSlideControls ? record.model.slides.map(slide=>slide.el) : []);
    for (const [el,control] of record.slideControls) if (!slideElements.has(el)) {
      control.host.remove(); restoreStyles(control); record.slideControls.delete(el);
    }
    for (const slide of hasSlideControls ? record.model.slides : []) {
      let control = record.slideControls.get(slide.el);
      if (!control) { control=iconControl('media',record,slide.el); record.slideControls.set(slide.el,control); }
      control.host.setAttribute('data-eagle-post',record.code);
      control.host.setAttribute('data-eagle-slide',String(slide.index || ''));
      control.host.setAttribute('data-overlay','');
      control.host.hidden = !record.model.ready || record.model.activeSlide?.el !== slide.el;
      const label = slide.media.some(el=>el.tagName==='VIDEO') ? 'Save current video to Eagle' : 'Save current image to Eagle';
      control.button.title=label; control.button.setAttribute('aria-label',label);
      if (getComputedStyle(slide.el).position==='static') patchStyle(control,slide.el,'position','relative');
      if (control.host.parentElement!==slide.el) slide.el.append(control.host);
    }
    media.host.hidden = !record.playerOverlay && (!record.isCarousel || hasSlideControls || !record.model.ready);
    all.host.hidden = record.playerOverlay && !record.isStory;
    media.host.toggleAttribute('data-overlay', !record.playerOverlay && record.isCarousel);
    if (hasSlideControls) media.host.remove();
    else if (!record.playerOverlay) {
      if (getComputedStyle(record.frame).position === 'static' && record.isCarousel) patchStyle(record,record.frame,'position','relative');
      if (media.host.parentElement !== record.frame) record.frame.append(media.host);
    } else if (!record.isStory && !all.host.isConnected) root.append(all.host);
  }
  function refreshToolbars() {
    storyOwner = storyRoute() ? findStoryRoot() : null;
    const roots = new Set();
    for (const media of document.querySelectorAll("img,video")) {
      const r = media.getBoundingClientRect();
      if (r.width < 140 || r.height < 140) continue;
      const root = rootFor(media); if (root) roots.add(root);
    }
    // The opened-post layout can place GIF comments and a permalink in a
    // nested sidebar. Those media discover a different root but the SAME
    // native bookmark as the main carousel. One action row has one owner.
    const byBookmark=new Map();
    const ownedArea=root=>Math.max(0,...postMedia(root).map(m=>{
      const r=m.getBoundingClientRect();return r.width*r.height;
    }));
    for(const root of roots){
      const bookmark=bookmarkControl(root);
      if(!bookmark)continue;
      const prior=byBookmark.get(bookmark);
      if(!prior){byBookmark.set(bookmark,root);continue;}
      const keep=ownedArea(root)>ownedArea(prior)?root:prior;
      roots.delete(keep===root?prior:root);byBookmark.set(bookmark,keep);
    }
    // Reconcile owners on each render: connected-but-obsolete inner wrappers
    // used to retain a second toolbar after Instagram changed its DOM.
    for (const [root, record] of toolbars) if (!roots.has(root) || !root.isConnected) {
      for (const control of controlsFor(record)) { control.host.remove(); restoreStyles(control); }
      record.group.remove(); restoreStyles(record); toolbars.delete(root);
    }
    const ownedHosts = new Set([...toolbars.values()].flatMap(t => controlsFor(t).map(c=>c.host)));
    for (const host of document.querySelectorAll("[data-eagle-toolbar],[data-eagle-control]")) if (!ownedHosts.has(host)) host.remove();
    const ownedGroups = new Set([...toolbars.values()].map(t => t.group));
    for (const group of document.querySelectorAll('[data-eagle-group]')) if (!ownedGroups.has(group)) group.remove();
    for (const root of roots) {
      const model = carouselModel(root);
      const anchor = model.track?.parentElement || mediaAnchor(root);
      if (!anchor) continue;
      const record = toolbars.get(root) || addToolbar(root);
      const url = source(root), story = storyRoute();
      const code = story ? story[2] || `story-${story[1]}` : url?.match(postPattern)?.[1], isReel = /\/reels?\//.test(url);
      if (!code) continue;
      record.model = model;
      record.isCarousel = !story && !isReel && model.isCarousel;
      record.code = code; record.isReel = isReel; record.frame = anchor; record.bookmark = bookmarkControl(root);
      record.isStory = !!story;
      record.playerOverlay = record.isStory || isReel && (/^\/reels?(?:\/|$)/.test(location.pathname) || !record.bookmark);
      record.media.host.toggleAttribute('data-player', record.playerOverlay);
      record.all.host.toggleAttribute('data-player', record.isStory);
      for (const control of [record.media, record.all]) control.host.setAttribute("data-eagle-post", code);
      const mediaLabel = record.isStory ? "Save current story to Eagle" : isReel ? "Save Reel to Eagle" : currentElement(root)?.tagName === "VIDEO" ? "Save current video to Eagle" : "Save current image to Eagle";
      record.media.button.title = mediaLabel; record.media.button.setAttribute("aria-label", mediaLabel);
      record.all.button.title = record.isStory ? "Save all available stories from this account to Eagle" : record.isCarousel ? "Save all images and videos from this post to Eagle" : mediaLabel;
      record.all.button.setAttribute("aria-label", record.all.button.title);
      record.all.path.setAttribute("d", record.isCarousel || record.isStory ? batchPath : downloadPath);
      record.all.host.style.setProperty("--eagle-ink", record.isStory ? 'white' : getComputedStyle(root).color);
      mountControls(record);
    }
    retryStoryEntry();
  }
  let storyRetryTimer, storyEntryDeadline = 0;
  function retryStoryEntry() {
    clearTimeout(storyRetryTimer);
    if (!/^\/stories\//.test(location.pathname) || Date.now() >= storyEntryDeadline) return;
    const ready = [...toolbars.values()].some(record => record.isStory && record.root === storyOwner
      && record.group.isConnected && record.media.host.isConnected && record.all.host.isConnected
      && visibleRect(record.group));
    if (!ready) storyRetryTimer = setTimeout(scheduleToolbars, 250);
  }
  function startStoryEntry() {
    clearTimeout(storyRetryTimer);
    storyEntryDeadline = /^\/stories\//.test(location.pathname) ? Date.now() + 15000 : 0;
    scheduleToolbars();
  }
  let refreshTimer;
  function scheduleToolbars() {
    if (refreshTimer) return;
    refreshTimer = setTimeout(() => { refreshTimer = null; refreshToolbars(); }, 200);
  }
  new MutationObserver(records => {
    if (records.some(record => {
      // Ignore our own styles/labels so mounting never creates a refresh loop.
      if (record.target instanceof Element && record.target.closest(UI.ownedSelector)) return false;
      // Style patches are applied only when a mount changes. A follow-up scan
      // settles them; future Instagram visibility changes must remain observable.
      return true;
    })) scheduleToolbars();
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['href','src','srcset','aria-hidden','aria-label','aria-selected','aria-current','aria-posinset','role','hidden','inert','style','class','width','height'] });
  document.addEventListener("scroll", scheduleToolbars, { capture: true, passive: true });
  document.addEventListener("click", scheduleToolbars, true);
  document.addEventListener("transitionend", scheduleToolbars, true);
  document.addEventListener('animationend', scheduleToolbars, true);
  document.addEventListener("load", scheduleToolbars, true);
  for (const event of ['loadedmetadata','loadeddata','canplay']) document.addEventListener(event, scheduleToolbars, true);
  window.addEventListener('pageshow', startStoryEntry);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) startStoryEntry(); });
  window.addEventListener("resize", scheduleToolbars, { passive: true });
  let lastPath = location.pathname;
  setInterval(() => { if (location.pathname !== lastPath) { lastPath = location.pathname; startStoryEntry(); } }, 500);
  startStoryEntry();
  document.addEventListener("pointerover", e => { const root = rootFor(e.target); if (root) hovered = root; }, true);
  document.addEventListener("contextmenu", e => { rightClicked = rootFor(e.target); }, true);
  browser.runtime.onMessage.addListener(message => {
    if (message.type === "eagle:select") {
      try {
        const context = remember(choose(message.contextMenu));
        return Promise.resolve({ ok: true, context });
      } catch (e) { return Promise.resolve({ ok: false, error: e.message }); }
    }
    if (message.type === "eagle:resolve-inline") {
      const intent = inlineIntents.get(message.marker); inlineIntents.delete(message.marker);
      if (!intent || intent.mode !== message.mode || Date.now() - intent.created > 60000) return Promise.resolve({ ok: false, error: "Click the Eagle button on the post again." });
      return Promise.resolve({ ok: true, context: intent.context });
    }
    if (message.type === "eagle:carousel") {
      const selection = selections.get(message.marker);
      if (!selection) return Promise.resolve({ ok: false, error: "Select the post again." });
      return carousel(selection).then(data => ({ ok: true, ...data }), e => ({ ok: false, error: e.message }));
    }
    if (message.type === "eagle:toast") toast(message.text, message.failed);
  });
})();
