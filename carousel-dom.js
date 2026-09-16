/* Structural Instagram carousel adapter. No network, React access, or retained
   post state. Results are rebuilt from the current post's slide list and dots. */
globalThis.EagleCarouselDOM = (() => {
  const dotSelector = '._acnb,.JSZAJ,.ijCUd';
  const activeDotSelector = '._acnf,.XCodT,[aria-selected="true"],[aria-current="true"]';
  const owned = el => el.closest('[data-eagle-control],[data-eagle-group]');
  function pagination(root) {
    const groups = new Map();
    for (const dot of root.querySelectorAll(dotSelector + ',[role="tablist"] [role="tab"]')) {
      if (owned(dot)) continue;
      const parent = dot.parentElement;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(dot);
    }
    const valid = [...groups.values()].filter(dots => dots.length > 1 && dots.length <= 50);
    // Multiple independent dot strips in a post are ambiguous, not permission
    // to choose whichever happens to come first.
    if (valid.length !== 1) return {count:null,index:null};
    const dots = valid[0], selected = dots.filter(dot => dot.matches(activeDotSelector));
    return {count:dots.length,index:selected.length === 1 ? dots.indexOf(selected[0]) + 1 : null};
  }
  function describe(root, elements, area) {
    const dots = pagination(root);
    const groups = new Map();
    const mediaIn = el => elements.filter(m => el === m || el.contains(m));
    for (const media of elements) {
      for (let node = media.parentElement, depth = 0; node && node !== root && depth < 14; node = node.parentElement, depth++) {
        if (owned(node)) continue;
        const children = [...node.children].filter(el => !owned(el) && mediaIn(el).length);
        if (!children.length) continue;
        const list = children.every(el => el.matches('li,[role="listitem"],[aria-roledescription="slide"]'));
        const rects = children.map(el => el.getBoundingClientRect());
        const horizontal = rects.length > 1 && rects.every((r,i) => !i ||
          Math.abs(r.top-rects[0].top) < 12 && r.left >= rects[i-1].right - 4);
        const clipped = (() => {
          for (let p=node; p && root.contains(p); p=p.parentElement) {
            if (/(hidden|clip|scroll|auto)/.test(getComputedStyle(p).overflowX)) return true;
            if (p === root) break;
          }
          return false;
        })();
        if ((list && (children.length > 1 || dots.count > 1)) || (horizontal && clipped)) groups.set(node, children);
      }
    }
    // Prefer the innermost slide track; outer post wrappers can contain the
    // same list plus controls, but are not themselves a second carousel.
    const tracks = [...groups.keys()].filter(track => ![...groups.keys()].some(other => other !== track && track.contains(other)));
    if (tracks.length !== 1) return {isCarousel:dots.count > 1,slides:[],activeSlide:null,index:tracks.length===0?dots.index:null,count:dots.count,
      ready:tracks.length === 0 && (!dots.count || !!dots.index)};
    const track = tracks[0], children = groups.get(track);
    const slides = children.map((el,i) => ({el, media:mediaIn(el), index:null, order:i}));
    const count = dots.count || slides.length;
    const explicit = slides.map(slide => Number(slide.el.getAttribute('aria-posinset')));
    const positioned = explicit.every(index => Number.isInteger(index) && index > 0 && index <= count)
      && new Set(explicit).size === explicit.length;
    if (positioned) slides.forEach((slide,i) => {slide.index=explicit[i];});
    else if (slides.length === count) slides.forEach((slide,i) => {slide.index=i+1;});
    const visible = slides.map(slide => ({slide,area:Math.max(0,...slide.media.map(area))})).sort((a,b)=>b.area-a.area);
    const activeSlide = visible[0]?.area > 0 ? visible[0].slide : null;
    let ready = !!activeSlide && !(visible[1]?.area > visible[0].area * .9);
    if (dots.index && activeSlide?.index && dots.index !== activeSlide.index) ready = false;
    const index = ready ? dots.index || activeSlide.index : null;
    // Virtualized lists may have only the current and neighboring slides. Use
    // the full pagination index, not the item's position in that shortened DOM.
    if (ready && activeSlide && !activeSlide.index && dots.index) activeSlide.index = dots.index;
    return {isCarousel:true,track,slides,activeSlide,index,count,ready};
  }
  return {describe};
})();
