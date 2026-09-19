const SUITE_FLAGS = new Set([
  '--public-only',
  '--profile-only',
  '--toast-only',
  '--post-regressions',
  '--carousel-only',
  '--reels-only',
  '--detection-only'
]);
const BASE_FLAGS = new Set(['--inline', '--binding']);

function parseIntegrationArgs(argv, defaultAddon) {
  const seen = new Set();
  const positional = [];
  for (const argument of argv) {
    if (!argument.startsWith('--')) {
      positional.push(argument);
      continue;
    }
    if (!SUITE_FLAGS.has(argument) && !BASE_FLAGS.has(argument)) {
      throw new Error(`Unknown integration test option: ${argument}`);
    }
    if (seen.has(argument)) throw new Error(`Duplicate integration test option: ${argument}`);
    seen.add(argument);
  }

  if (positional.length > 1) throw new Error('Expected at most one extension path.');
  const suites = [...seen].filter(flag => SUITE_FLAGS.has(flag));
  if (suites.length > 1) throw new Error(`Choose exactly one focused browser suite: ${suites.join(', ')}`);
  if (suites.length && [...seen].some(flag => BASE_FLAGS.has(flag))) {
    throw new Error('Focused browser suites cannot be combined with --inline or --binding.');
  }

  return {
    addon: positional[0] || defaultAddon,
    suite: suites[0] || 'base',
    inline: seen.has('--inline'),
    binding: seen.has('--binding')
  };
}

module.exports = { parseIntegrationArgs };
