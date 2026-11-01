const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(file, globals) {
  const context = vm.createContext(globals);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../..', file), 'utf8'), context);
  return context;
}

test('Firefox chime plays packaged audio without offscreen APIs', async () => {
  const calls = [];
  const context = load('background/chime.js', {
    browser: {runtime: {getURL: file => `moz-extension://test/${file}`}},
    Audio: class {
      constructor(url) { calls.push(url); }
      async play() { calls.push('play'); }
    },
  });
  await context.chime();
  assert.deepEqual(calls, ['moz-extension://test/sounds/success.ogg', 'play']);
});

for (const existing of [false, true]) {
  test(`Chrome chime creates offscreen audio with existing document=${existing}`, async () => {
    const calls = [];
    const context = load('background/chime-chrome.js', {
      browser: {offscreen: {
        hasDocument: async () => { calls.push('has'); return existing; },
        closeDocument: async () => { calls.push('close'); },
        createDocument: async options => { calls.push(JSON.parse(JSON.stringify(options))); },
      }},
    });
    await context.chime();
    assert.deepEqual(calls, [
      'has', ...(existing ? ['close'] : []),
      {url: 'sounds/chime.html', reasons: ['AUDIO_PLAYBACK'], justification: 'Play a chime when a save is sent to Eagle.'},
    ]);
  });
}
