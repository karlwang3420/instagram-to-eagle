const assert = require('node:assert/strict');

module.exports = async ({evaluate, send, ig, waitFor, delay}) => {
  await send('browsingContext.activate', {context: ig});
  await send('browsingContext.setViewport', {context: ig, viewport: {width: 1100, height: 900}});

  const image = '<img width="200" height="200" src="https://s.cdninstagram.com/detection.jpg">';
  const tile = '<a id="tile" href="/p/TILE/" style="display:block;position:relative;width:200px;height:200px">' + image + '</a>';
  const actions = (id, attributes = '') => `<section id="${id}" ${attributes}><button aria-label="Like">Like</button><button aria-label="Save">Save</button></section>`;
  const replace = html => evaluate(ig, `history.pushState({},'', '/');document.querySelector('main').innerHTML=${JSON.stringify(html)};window.scrollTo(0,0);true`);
  const count = selector => evaluate(ig, `document.querySelectorAll(${JSON.stringify(selector)}).length`);
  const waitCount = (selector, expected) => waitFor(ig, `document.querySelectorAll(${JSON.stringify(selector)}).length===${expected}`);

  await replace(`<div id="shared">${tile}<article><a href="/p/OTHER/">Other post</a>${image}${actions('neighbor-actions')}</article></div>`);
  await waitCount('#neighbor-actions [data-eagle-group]', 1);
  await waitCount('#tile [data-eagle-profile-tile]', 1);
  assert.equal(await count('#tile [data-eagle-group]'), 0);
  assert.equal(await count('[data-eagle-group]'), 1);
  console.log('PASS a neighboring post cannot suppress a grid tile under a shared wrapper');

  // A quiet observation window detects the two renderers repeatedly scheduling
  // each other through their own style mutations, even when the UI looks right.
  await delay(500);
  await evaluate(ig, `window.ownedMutations=0;window.ownedObserver=new MutationObserver(records=>{ownedMutations+=records.length;});for(const host of document.querySelectorAll('[data-eagle-group],[data-eagle-profile-tile]'))ownedObserver.observe(host,{attributes:true,subtree:true});true`);
  await delay(800);
  assert.equal(await evaluate(ig, 'ownedMutations'), 0, 'Renderers must settle without a mutation feedback loop');
  await evaluate(ig, 'ownedObserver.disconnect();true');

  // A saved-state SVG is also a native bookmark signal, even without a label.
  const shape = '<button><svg width="24" height="24"><polygon points="20 21 12 13.44 4 21 4 3 20 3 20 21"></polygon></svg></button>';
  for (const [name, attributes] of [
    ['hidden visibility', 'style="visibility:hidden"'],
    ['transparent ancestor', 'style="opacity:0"'],
    ['aria-hidden ancestor', 'aria-hidden="true"'],
    ['inert ancestor', 'inert'],
  ]) {
    await replace(`<article><a href="/p/POST/">Post</a>${image}<section id="stale" ${attributes}><button aria-label="Like">Like</button>${shape}</section>${actions('live')}</article>`);
    await waitCount('#live [data-eagle-group]', 1);
    assert.equal(await count('#stale [data-eagle-group]'), 0, name);
    assert.equal(await count('[data-eagle-group]'), 1, name);
  }
  console.log('PASS hidden, transparent, aria-hidden and inert bookmark rows cannot own controls');

  await replace(`<article><a href="/p/POST/">Post</a>${image}<section id="stale"><button aria-label="Like">Like</button><button><svg aria-label="Save" width="24" height="24" style="visibility:hidden"></svg></button></section>${actions('live')}</article>`);
  await waitCount('#live [data-eagle-group]', 1);
  assert.equal(await count('#stale [data-eagle-group]'), 0);

  await replace(`<article><a href="/p/POST/">Post</a>${image}${actions('first')}${actions('second')}</article>`);
  await waitCount('#first [data-eagle-group]', 1);
  await evaluate(ig, `document.getElementById('first').style.visibility='hidden';true`);
  await waitCount('#second [data-eagle-group]', 1);
  await evaluate(ig, `document.getElementById('first').style.visibility='visible';document.getElementById('second').style.visibility='hidden';true`);
  await waitCount('#first [data-eagle-group]', 1);
  assert.equal(await count('#second [data-eagle-group]'), 0);
  assert.equal(await count('[data-eagle-group]'), 1);
  console.log('PASS native row visibility changes move the existing control without duplicates');

  await replace(`<article id="outer"><a href="/p/POST/">Post</a><article><a href="/p/POST/">Same post</a>${image}</article>${actions('outer-actions')}</article>`);
  await waitCount('#outer-actions [data-eagle-group]', 1);
  assert.equal(await count('[data-eagle-group]'), 1);
  assert.equal(await count('[data-eagle-profile-tile]'), 0);
  console.log('PASS nested wrappers for the same post retain one native action owner');

  await replace(`<article><a href="/p/POST/">Post</a>${image}${actions('offscreen-actions', 'style="margin-top:1400px"')}</article>`);
  await waitCount('#offscreen-actions [data-eagle-group]', 1);
  assert.equal(await evaluate(ig, `document.getElementById('offscreen-actions').getBoundingClientRect().top>innerHeight`), true);
  console.log('PASS offscreen native actions still identify their post');

  await replace('<div id="empty"></div>');
  await waitCount('[data-eagle-group],[data-eagle-profile-tile]', 0);
  console.log('PASS removing all media removes all owned controls');
};
