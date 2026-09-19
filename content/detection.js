/* Instagram surface and native-control detection shared by all renderers. */
(() => {
  if (globalThis.EagleDetection) return;

  const postPattern = /\/(?:p|reels?)\/(?!audio(?:\/|[?#]|$))([\w-]+)\/?(?:[?#]|$)/;
  const playbackLabel = /^(play|pause|mute|unmute|turn (?:on|off) sound|sound (?:on|off)|播放|暫停|暂停|靜音|静音|取消靜音|取消静音|開啟音效|關閉音效|开启声音|关闭声音|音效|音量)$/i;
  const bookmarkLabel = /^(save|saved|unsave|remove from saved|儲存|已儲存|取消儲存|保存|已保存|收藏|已收藏|取消收藏|저장|저장됨|保存済み|enregistrer|enregistré|guardar|guardado|speichern|gespeichert)$/i;
  const bookmarkShape = 'svg polygon[points="20 21 12 13.44 4 21 4 3 20 3 20 21"],svg path[d="M20 22a.999.999 0 0 1-.687-.273L12 14.815l-7.313 6.912A1 1 0 0 1 3 21V3a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1Z"]';

  function storyRoute() {
    const route = location.pathname.match(/^\/stories\/([\w.]+)(?:\/(\d+))?\/?$/);
    return route && !['highlights', 'archive'].includes(route[1].toLowerCase()) ? route : null;
  }

  function linkInfo(anchor) {
    try {
      const url = new URL(anchor.href);
      const match = url.pathname.match(/^\/(?:[\w.]+\/)?(p|reel|reels)\/([\w-]+)\/?$/);
      return url.origin === location.origin && match
        ? { code: match[2], url: `https://www.instagram.com/${match[1] === 'p' ? 'p' : 'reel'}/${match[2]}/` }
        : null;
    } catch {
      return null;
    }
  }

  function postLinks(root) {
    return [...root.querySelectorAll('a[href]')].filter(anchor => postPattern.test(anchor.href));
  }

  function postCodes(root) {
    return new Set(postLinks(root).map(anchor => anchor.href.match(postPattern)?.[1]).filter(Boolean));
  }

  function routePostIdentity() {
    const match = location.pathname.match(/^\/(p|reel|reels)\/([\w-]+)\/?$/);
    return match ? {
      code: match[2],
      url: `https://www.instagram.com/${match[1] === 'p' ? 'p' : 'reel'}/${match[2]}/`,
      isReel: match[1] !== 'p'
    } : null;
  }

  function isRendered(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'
          || style.contentVisibility === 'hidden' || style.opacity === '0' || node.hidden || node.inert || node.hasAttribute('inert')
          || node.getAttribute('aria-hidden') === 'true') return false;
    }
    return true;
  }

  function visibleRect(element, boundary = null) {
    const rect = element.getBoundingClientRect();
    const bounds = boundary
      ? boundary.getBoundingClientRect()
      : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const box = {
      left: Math.max(bounds.left, rect.left),
      top: Math.max(bounds.top, rect.top),
      right: Math.min(bounds.right, rect.right),
      bottom: Math.min(bounds.bottom, rect.bottom)
    };
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'
          || style.contentVisibility === 'hidden' || style.opacity === '0' || node.hidden || node.inert || node.hasAttribute('inert')
          || node.getAttribute('aria-hidden') === 'true') return 0;
      if (node !== element && /(hidden|clip|scroll|auto)/.test(style.overflow + style.overflowX + style.overflowY)) {
        const parentRect = node.getBoundingClientRect();
        if (/(hidden|clip|scroll|auto)/.test(style.overflowX)) {
          box.left = Math.max(box.left, parentRect.left);
          box.right = Math.min(box.right, parentRect.right);
        }
        if (/(hidden|clip|scroll|auto)/.test(style.overflowY)) {
          box.top = Math.max(box.top, parentRect.top);
          box.bottom = Math.min(box.bottom, parentRect.bottom);
        }
      }
      if (node === boundary) break;
    }
    return Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top);
  }

  function nativePlayback(root) {
    return [...root.querySelectorAll('button,[role="button"],svg[aria-label]')]
      .filter(element => !element.closest('[data-eagle-group],[data-eagle-control]'))
      .map(element => ({
        element: element.closest('button,[role="button"]') || element,
        label: element.getAttribute('aria-label') || element.querySelector('[aria-label]')?.getAttribute('aria-label') || ''
      }))
      .filter(({ element, label }) => playbackLabel.test(label.trim()) && visibleRect(element))
      .map(({ element }) => element)
      .filter((element, index, list) => list.indexOf(element) === index);
  }

  function largeMedia(root, minimum = 140, requireVisible = true) {
    return [...root.querySelectorAll('img,video')].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width >= minimum && rect.height >= minimum && (!requireVisible || visibleRect(element));
    });
  }

  function findStoryRoot() {
    const route = storyRoute();
    if (!route) return null;
    const playback = nativePlayback(document);
    const authorLinks = [...document.querySelectorAll('a[href]')].filter(anchor => {
      const path = new URL(anchor.href).pathname;
      return visibleRect(anchor) && (path.toLowerCase() === `/${route[1].toLowerCase()}/`
        || path === `/stories/${route[1]}/${route[2] ? route[2] + '/' : ''}`);
    });
    for (const seed of [...authorLinks, ...playback]) {
      for (let node = seed.parentElement; node && !node.matches('body,html'); node = node.parentElement) {
        if (!largeMedia(node).length) continue;
        if (!authorLinks.some(anchor => node.contains(anchor)) && authorLinks.length) break;
        if (playback.some(control => node.contains(control))) return node;
      }
    }
    return null;
  }

  function dominantVisibleMedia() {
    return [...document.querySelectorAll('img,video')]
      .map(element => ({element, area:visibleRect(element)}))
      .filter(({element,area}) => {
        const rect = element.getBoundingClientRect();
        return area > 0 && rect.width >= 140 && rect.height >= 140;
      })
      .sort((a,b) => b.area-a.area)[0]?.element || null;
  }

  function activeReelPost(seed) {
    const identity = routePostIdentity();
    if (!identity?.isReel) return null;
    const media = dominantVisibleMedia();
    if (!media || (seed !== media && !seed.contains(media))) return null;
    // A Reel can expose only its audio link. Bind the route to the visible
    // player's own Save action, never to a neighboring mounted card.
    for (let node=media.parentElement; node && !node.matches('body,html'); node=node.parentElement) {
      const codes = postCodes(node);
      if (codes.size > 1 || (codes.size === 1 && !codes.has(identity.code))) break;
      const nativeAnchor = bookmarkControl(node,media,identity.code);
      if (nativeAnchor) return {owner:node,identity,nativeAnchor};
    }
    return null;
  }

  function source(root, storyOwner = null) {
    if (storyRoute() && root === storyOwner) return location.href;
    const links = postLinks(root);
    return links.find(anchor => anchor.querySelector('time'))?.href
      || links[0]?.href
      || (postPattern.test(location.href) && (!routePostIdentity()?.isReel || root.contains(dominantVisibleMedia())) ? location.href : null);
  }

  function isRelatedControl(control, seed, code) {
    if (!seed) return true;
    const controlArticle = control.closest('article');
    const seedArticle = seed.closest('article');
    if (controlArticle) {
      const codes = postCodes(controlArticle);
      if (codes.size && (!codes.has(code) || codes.size > 1)) return false;
      if (!controlArticle.contains(seed)) return false;
    } else if (seedArticle && !seedArticle.contains(control)) {
      return false;
    }
    return true;
  }

  function bookmarkControl(root, seed = null, code = null) {
    for (const element of root.querySelectorAll('svg[aria-label],button[aria-label],[role="button"][aria-label],' + bookmarkShape)) {
      if (element.closest('[data-eagle-control],[data-eagle-group]')) continue;
      if (!bookmarkLabel.test((element.getAttribute('aria-label') || '').trim()) && !element.matches(bookmarkShape)) continue;
      const control = element.closest('button,[role="button"]') || element;
      if (!isRendered(element) || !isRendered(control) || !isRelatedControl(control, seed, code)) continue;
      return control;
    }
    return null;
  }

  function postOwner(seed, expectedCode = null) {
    let owner = null;
    let identity = expectedCode;
    for (let node = seed, depth = 0; node && depth < 30; node = node.parentElement, depth++) {
      if (node.matches('body,main')) break;
      const codes = postCodes(node);
      if (codes.size > 1 || (identity && codes.size === 1 && !codes.has(identity))) break;
      if (!identity && codes.size === 1) identity = [...codes][0];
      if (codes.size === 1 && largeMedia(node, 140, false).length) {
        owner = node;
        const nativeAnchor = bookmarkControl(node, seed, identity);
        if (nativeAnchor) return { owner: node, code: identity, nativeAnchor };
      }
    }
    return owner ? { owner, code: identity, nativeAnchor: null } : null;
  }

  function classify(element, { storyOwner = null } = {}) {
    if (!(element instanceof Element)) {
      return { surface: 'unknown', owner: null, identity: null, nativeAnchor: null, reason: 'not-an-element' };
    }
    const story = storyRoute();
    if (story) {
      if (storyOwner?.contains(element)) {
        return {
          surface: 'story', owner: storyOwner,
          identity: { code: story[2] || `story-${story[1]}`, url: location.href },
          nativeAnchor: nativePlayback(storyOwner)[0] || null, reason: null
        };
      }
      return { surface: 'unknown', owner: null, identity: null, nativeAnchor: null, reason: 'outside-active-story' };
    }

    const activeReel = activeReelPost(element);
    if (activeReel) {
      return {
        surface: 'post', owner:activeReel.owner, identity:activeReel.identity,
        nativeAnchor:activeReel.nativeAnchor, reason:null
      };
    }

    const anchor = element.closest('a[href]');
    const identity = anchor ? linkInfo(anchor) : null;
    const post = postOwner(element, identity?.code || null);
    if (post?.nativeAnchor) {
      return {
        surface: 'post', owner: post.owner,
        identity: { code: post.code, url: source(post.owner) },
        nativeAnchor: post.nativeAnchor, reason: null
      };
    }

    if (anchor && identity && !anchor.closest('header') && largeMedia(anchor, 100, false).length) {
      return { surface: 'grid', owner: anchor, identity, nativeAnchor: null, reason: null };
    }

    if (post) {
      return {
        surface: 'post', owner: post.owner,
        identity: post.code ? { code: post.code, url: source(post.owner) } : null,
        nativeAnchor: null, reason: post.code ? null : 'post-owner-without-identity'
      };
    }

    if (postPattern.test(location.href)) {
      const owner = element.closest('[role="dialog"]') || document.querySelector('main');
      const codes = owner ? postCodes(owner) : new Set();
      if (owner && codes.size <= 1) {
        const code = location.href.match(postPattern)?.[1] || [...codes][0] || null;
        return {
          surface: 'post', owner, identity: code ? { code, url: source(owner) } : null,
          nativeAnchor: bookmarkControl(owner, element, code), reason: code ? null : 'opened-post-without-identity'
        };
      }
      return { surface: 'unknown', owner: null, identity: null, nativeAnchor: null, reason: 'ambiguous-opened-post' };
    }

    return {
      surface: 'unknown', owner: null, identity: identity || null, nativeAnchor: null,
      reason: identity ? 'linked-post-without-media' : 'no-post-identity'
    };
  }

  function rootFor(element, options) {
    const result = classify(element, options);
    return result.surface === 'post' || result.surface === 'story' ? result.owner : null;
  }

  function isGridMedia(element) {
    return classify(element).surface === 'grid';
  }

  globalThis.EagleDetection = {
    postPattern, storyRoute, linkInfo, postLinks, source, isRendered, visibleRect,
    nativePlayback, largeMedia, findStoryRoot, bookmarkControl, classify, rootFor, isGridMedia
  };
})();
