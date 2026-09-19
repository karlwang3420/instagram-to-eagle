const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const integration = path.join(__dirname, 'firefox.integration.cjs');
const unitDirectory = path.join(__dirname, 'unit');

function run(label, args) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const unitFiles = fs.readdirSync(unitDirectory)
  .filter(file => file.endsWith('.test.cjs'))
  .sort()
  .map(file => path.join(unitDirectory, file));
if (!unitFiles.length) throw new Error('No unit tests found.');

run('unit tests', ['--test', ...unitFiles]);
for (const [label, flags] of [
  ['Firefox base integration', ['--inline', '--binding']],
  ['Firefox public/settings integration', ['--public-only']],
  ['Firefox profile integration', ['--profile-only']],
  ['Firefox notification integration', ['--toast-only']],
  ['Firefox post regressions', ['--post-regressions']],
  ['Firefox Reel regressions', ['--reels-only']],
  ['Firefox detection regressions', ['--detection-only']]
]) run(label, [integration, ...flags]);

console.log('\nALL TEST SUITES PASSED.');
