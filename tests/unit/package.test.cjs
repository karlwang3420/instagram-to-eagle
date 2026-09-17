const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

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
