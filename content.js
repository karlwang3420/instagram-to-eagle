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
  const storyRoute = () => {
    const route = location.pathname.match(/^\/stories\/([\w.]+)(?:\/(\d+))?\/?$/);
    return route && !['highlights','archive'].includes(route[1].toLowerCase()) ? route : null;
  };
  const playbackLabel = /^(play|pause|mute|unmute|turn (?:on|off) sound|sound (?:on|off)|播放|暫停|暂停|靜音|静音|取消靜音|取消静音|開啟音效|關閉音效|开启声音|关闭声音|音效|音量)$/i;
  function nativePlayback(root) {
    return [...root.querySelectorAll('button,[role="button"],svg[aria-label]')].filter(el => !el.closest('[data-eagle-group],[data-eagle-control]'))
      .map(el => ({ el: el.closest('button,[role="button"]') || el, label: el.getAttribute('aria-label') || el.querySelector('[aria-label]')?.getAttribute('aria-label') || '' }))
      .filter(({el,label}) => playbackLabel.test(label.trim()) && visibleRect(el))
      .map(({el}) => el).filter((el,i,list) => list.indexOf(el) === i);
  }
  function largeMedia(root) {
    return [...root.querySelectorAll('img,video')].filter(el => {
      const r = el.getBoundingClientRect(); return r.width >= 140 && r.height >= 140 && visibleRect(el);
    });
  }
  function findStoryRoot() {
    const route = storyRoute();
    if (!route) return null;
    const playback = nativePlayback(document);
    const authorLinks = [...document.querySelectorAll('a[href]')].filter(a => {
      const path = new URL(a.href).pathname;
      return visibleRect(a) && (path.toLowerCase() === `/${route[1].toLowerCase()}/` || path === `/stories/${route[1]}/${route[2] ? route[2] + '/' : ''}`);
    });
    // The active card is identified by its account/header, not by the largest
    // image on the page. Its video can be much shorter than the full story card.
    for (const seed of [...authorLinks, ...playback]) {
      for (let p = seed.parentElement; p && !p.matches('body,html'); p = p.parentElement) {
        if (!largeMedia(p).length) continue;
        if (!authorLinks.some(a => p.contains(a)) && authorLinks.length) break;
        if (playback.some(b => p.contains(b))) return p;
      }
    }
    // Do not guess a neighboring account when the active card is not identifiable.
    return null;
  }
  const postPattern = /\/(?:p|reels?)\/([\w-]+)\/?(?:[?#]|$)/;
  function postLinks(root) {
    return [...root.querySelectorAll('a[href]')].filter(a => postPattern.test(a.href));
  }
  function source(root) {
    if (storyRoute() && root === storyOwner) return location.href;
    const links = postLinks(root);
    return links.find(a => a.querySelector("time"))?.href || links[0]?.href || (postPattern.test(location.href) ? location.href : null);
  }
  function rootFor(el) {
    if (!(el instanceof Element)) return null;
    if (globalThis.EagleProfileControls?.isGridMedia(el)) return null;
    if (storyRoute()) return storyOwner?.contains(el) ? storyOwner : null;
    // Use one owner for the whole post, not a different inner wrapper per slide.
    // An ancestor containing another post's permalink is a hard boundary.
    let owner = null;
    for (let node = el, i = 0; node && i < 30; i++, node = node.parentElement) {
      if (node.matches("body,main")) break;
      const codes = new Set(postLinks(node).map(a => a.href.match(postPattern)[1]));
      if (codes.size > 1) break;
      if (codes.size === 1 && [...node.querySelectorAll("img,video")].some(m => {
        const r = m.getBoundingClientRect(); return r.width >= 140 && r.height >= 140;
      })) {
        owner = node;
        // The media and native bookmark action must belong to the same post.
        // This is the stable owner for both image and nested video slides.
        if (bookmarkControl(node)) return node;
        // Video slides can be wrapped in a nested article with the same
        // permalink. Continue to the shared post owner, otherwise photo and
        // video slides create independent toolbars for one mixed carousel.
      }
    }
    if (owner) return owner;
    if (postPattern.test(location.href)) {
      const root = el.closest('[role="dialog"]') || document.querySelector("main");
      if (root && new Set(postLinks(root).map(a => a.href.match(postPattern)[1])).size <= 1) return root;
    }
    return null;
  }
  function visibleRect(el, boundary = null) {
    let r = el.getBoundingClientRect();
    // A current slide belongs to its carousel even when scrolled off-screen.
    const bounds = boundary ? boundary.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    let box = { left: Math.max(bounds.left, r.left), top: Math.max(bounds.top, r.top), right: Math.min(bounds.right, r.right), bottom: Math.min(bounds.bottom, r.bottom) };
    for (let p = el; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === "none" || s.visibility === "hidden" || s.contentVisibility === "hidden" || s.opacity === "0" || p.hidden || p.inert || p.getAttribute("aria-hidden") === "true") return 0;
      if (p !== el && /(hidden|clip|scroll|auto)/.test(s.overflow + s.overflowX + s.overflowY)) {
        const b = p.getBoundingClientRect();
        if (/(hidden|clip|scroll|auto)/.test(s.overflowX)) { box.left = Math.max(box.left, b.left); box.right = Math.min(box.right, b.right); }
        if (/(hidden|clip|scroll|auto)/.test(s.overflowY)) { box.top = Math.max(box.top, b.top); box.bottom = Math.min(box.bottom, b.bottom); }
      }
      if (p === boundary) break;
    }
    return Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top);
  }
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
  let dismissToast = null;
  function toast(text, failed = false) {
    dismissToast?.();
    document.getElementById("instagram-eagle-status")?.remove();
    const box = document.createElement("div"); box.id = "instagram-eagle-status";
    box.style.cssText = 'all:initial;position:fixed;inset:auto 16px 16px auto;z-index:2147483647;display:block;width:max-content;max-width:min(320px,calc(100vw - 32px));box-sizing:border-box;color-scheme:dark';
    const shadow = box.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      .notice{display:flex;align-items:flex-start;gap:9px;padding:11px 10px 11px 12px;border:1px solid #ffffff24;border-radius:10px;background:#232627;color:#f0f1f1;box-shadow:0 4px 18px #0003;font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;animation:eagle-notice-in 140ms ease-out}
      .status{width:17px;height:17px;flex:none;margin-top:1px;color:${failed ? '#f0ac9c' : '#a5d5b7'}}
      .message{min-width:0;flex:1;overflow-wrap:anywhere;max-height:min(240px,50vh);overflow:auto}
      button{all:unset;display:grid;place-items:center;box-sizing:border-box;flex:none;width:24px;height:24px;margin:-3px -3px -3px 1px;border-radius:5px;color:#a5abad;cursor:pointer}
      button:hover{color:#fff;background:#ffffff12}button:focus-visible{outline:2px solid #a5d5b7;outline-offset:1px}
      button svg{width:14px;height:14px}svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      @keyframes eagle-notice-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      @media(prefers-reduced-motion:reduce){.notice{animation:none}}
    `;
    const notice = document.createElement('div'); notice.className = 'notice';
    const icon = (path, className) => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
      if (className) svg.setAttribute('class', className);
      const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path'); shape.setAttribute('d', path); svg.append(shape);
      return svg;
    };
    const message = document.createElement('div'); message.className = 'message';
    message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite'); message.setAttribute('aria-atomic', 'true');
    message.append(document.createElement('slot'));
    const close = document.createElement('button'); close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss Eagle notification');
    close.append(icon('M6 6l12 12M18 6 6 18'));
    notice.append(icon(failed ? 'M12 8v5m0 3h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18' : 'M5 12l4 4L19 6', 'status'), message, close);
    shadow.append(style, notice);
    let timer, hovering = false, focused = false;
    const dismiss = () => { clearTimeout(timer); box.remove(); if (dismissToast === dismiss) dismissToast = null; };
    const arm = () => { clearTimeout(timer); if (!hovering && !focused) timer = setTimeout(dismiss, failed ? 8000 : 3000); };
    close.addEventListener('click', e => { e.stopPropagation(); dismiss(); });
    box.addEventListener('pointerenter', () => { hovering = true; clearTimeout(timer); });
    box.addEventListener('pointerleave', () => { hovering = false; arm(); });
    box.addEventListener('focusin', () => { focused = true; clearTimeout(timer); });
    box.addEventListener('focusout', () => { focused = false; arm(); });
    dismissToast = dismiss;
    document.documentElement.append(box);
    // Populate the live region after mounting; remote text is never treated as HTML.
    box.textContent = String(text);
    arm();
  }
  const downloadPath = "M12 3v12m-5-5 5 5 5-5M3 15v5a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-5";
  const batchPath = "M7 3h12a2 2 0 0 1 2 2v12M5 7h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm5 3v8m-3-3 3 3 3-3";
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
  function bookmarkControl(root) {
    const labels = /^(save|saved|unsave|remove from saved|儲存|已儲存|取消儲存|保存|已保存|收藏|已收藏|取消收藏|저장|저장됨|保存済み|enregistrer|enregistré|guardar|guardado|speichern|gespeichert)$/i;
    const bookmarkShape = 'svg polygon[points="20 21 12 13.44 4 21 4 3 20 3 20 21"],svg path[d="M20 22a.999.999 0 0 1-.687-.273L12 14.815l-7.313 6.912A1 1 0 0 1 3 21V3a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1Z"]';
    for (const el of root.querySelectorAll('svg[aria-label],button[aria-label],[role="button"][aria-label],'+bookmarkShape)) {
      if (el.closest('[data-eagle-control],[data-eagle-group]')) continue;
      if (!labels.test((el.getAttribute("aria-label") || '').trim()) && !el.matches(bookmarkShape)) continue;
      const control = el.closest('button,[role="button"]') || el;
      if (control.getBoundingClientRect().width) return control;
    }
    return null;
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
      if (record.target instanceof Element && record.target.closest('[data-eagle-control],[data-eagle-group]')) return false;
      if (record.type === 'attributes' && ['style','class','width','height'].includes(record.attributeName)) {
        // Pagination class changes and slide-track transforms affect selection.
        // Skip only styles patched by us to avoid a self-triggering loop.
        if (record.attributeName === 'style' && [...toolbars.values()].some(t=>[t,...controlsFor(t)].some(c=>c.patches?.some(p=>p.el===record.target)))) return false;
        return true;
      }
      return true;
    })) scheduleToolbars();
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['href','src','srcset','aria-hidden','aria-label','aria-selected','aria-current','aria-posinset','role','hidden','style','class','width','height'] });
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
  globalThis.EagleUI = {toast};
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
