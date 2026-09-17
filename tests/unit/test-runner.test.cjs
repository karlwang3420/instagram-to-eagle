const {test} = require('node:test');
const assert = require('node:assert/strict');
const {parseIntegrationArgs} = require('../helpers/integration-args.cjs');

test('browser runner rejects combinations that would silently skip a requested suite', () => {
  for (const flags of [
    ['--profile-only', '--public-only'],
    ['--detection-only', '--binding'],
    ['--profile-only', '--profile-only'],
    ['--profil-only'],
  ]) assert.throws(() => parseIntegrationArgs(flags, '.'), /option|suite|combined/);
});

test('browser runner accepts the base flow and an explicit artifact with a focused suite', () => {
  assert.deepEqual(parseIntegrationArgs(['--inline', '--binding'], '.'), {
    addon: '.', suite: 'base', inline: true, binding: true,
  });
  assert.deepEqual(parseIntegrationArgs(['test.xpi', '--detection-only'], '.'), {
    addon: 'test.xpi', suite: '--detection-only', inline: false, binding: false,
  });
});
