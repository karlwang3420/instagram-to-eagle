const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

test('Chrome packaging declares its API minimum without changing the Firefox manifest', () => {
  const chrome = JSON.parse(execFileSync('python', ['-c',
    'import runpy; p=runpy.run_path("tools/package_extension.py"); print(p["chrome_files"]()["manifest.json"].decode())'],
  {cwd: root, encoding: 'utf8'}));
  assert.equal(chrome.minimum_chrome_version, '148');
  assert.equal(chrome.version, manifest.version);
  assert.deepEqual(chrome.background, {service_worker: 'service-worker.js'});
  assert.ok(chrome.permissions.includes('offscreen'));
  assert.equal(Object.hasOwn(chrome, 'browser_specific_settings'), false);
  assert.equal(Object.hasOwn(manifest, 'minimum_chrome_version'), false);
});

test('browser packages include only their own chime implementation', () => {
  const packaging = JSON.parse(execFileSync('python', ['-c',
    'import json,runpy; p=runpy.run_path("tools/package_extension.py"); print(json.dumps({"runtime":p["RUNTIME"],"chrome":p["CHROME"],"source":p["SOURCE"],"worker":p["chrome_files"]()["service-worker.js"].decode()}))'],
  {cwd: root, encoding: 'utf8'}));
  assert.ok(manifest.background.scripts.includes('background/chime.js'));
  assert.ok(packaging.runtime.includes('background/chime.js'));
  assert.ok(!packaging.runtime.includes('background/chime-chrome.js'));
  assert.ok(!packaging.runtime.includes('sounds/chime.html'));
  for (const file of packaging.runtime.filter(file => file.endsWith('.js'))) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /\boffscreen\b/, file);
  }
  assert.ok(packaging.chrome.includes('background/chime-chrome.js'));
  assert.ok(packaging.chrome.includes('sounds/chime.html'));
  assert.ok(!packaging.chrome.includes('background/chime.js'));
  const imports = [];
  require('node:vm').runInNewContext(packaging.worker, {importScripts: (...files) => imports.push(...files)});
  assert.deepEqual(imports, manifest.background.scripts.map(file => '/' + (
    file === 'background/chime.js' ? 'background/chime-chrome.js' : file
  )));
  for (const file of imports) assert.ok(packaging.chrome.includes(file.slice(1)), `Missing worker script: ${file}`);
  assert.ok(packaging.source.includes('background/chime.js'));
  assert.ok(packaging.source.includes('background/chime-chrome.js'));
  assert.equal(new Set(packaging.source).size, packaging.source.length);
});

test('runtime package includes every manifest and popup resource after file moves', () => {
  const packaging = JSON.parse(execFileSync('python', ['-c',
    'import json,runpy; p=runpy.run_path("tools/package_extension.py"); print(json.dumps({"runtime":p["RUNTIME"],"source":p["SOURCE"]}))'],
  {cwd: root, encoding: 'utf8'}));
  const runtime = new Set(packaging.runtime);
  const referenced = [
    ...manifest.background.scripts,
    ...manifest.content_scripts.flatMap(script => script.js),
    manifest.action.default_popup,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
  ];
  const popup = manifest.action.default_popup;
  for (const [, relative] of fs.readFileSync(path.join(root, popup), 'utf8').matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (!relative.startsWith('https:')) referenced.push(path.posix.normalize(path.posix.join(path.posix.dirname(popup), relative)));
  }
  for (const file of referenced) assert.ok(runtime.has(file), `Missing packaged resource: ${file}`);
  for (const file of runtime) assert.ok(fs.statSync(path.join(root, file)).isFile(), `Missing runtime file: ${file}`);
  assert.equal(runtime.size, packaging.runtime.length, 'No duplicate runtime members');
  for (const directory of ['tests/unit', 'tests/browser', 'tests/fixtures', 'tests/helpers']) {
    for (const name of fs.readdirSync(path.join(root, directory))) {
      assert.ok(packaging.source.includes(`${directory}/${name}`), `Missing source member: ${directory}/${name}`);
    }
  }
});
