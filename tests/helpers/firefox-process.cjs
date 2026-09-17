const fs = require('node:fs');
const path = require('node:path');

function createFirefoxProfile(workDirectory, preferencesFile, preferences = {}) {
  fs.mkdirSync(workDirectory, { recursive: true });
  const profile = fs.mkdtempSync(path.join(workDirectory, 'firefox-run-'));
  const userPreferences = path.join(profile, 'user.js');
  fs.copyFileSync(preferencesFile, userPreferences);
  const extra = Object.entries(preferences)
    .map(([name, value]) => `user_pref(${JSON.stringify(name)}, ${JSON.stringify(value)});`)
    .join('\n');
  if (extra) fs.appendFileSync(userPreferences, `\n${extra}\n`);
  return profile;
}

function waitForExit(child, timeout) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      child.off('exit', onExit);
      resolve(false);
    }, timeout);
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    child.once('exit', onExit);
  });
}

async function stopFirefox(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  if (!await waitForExit(child, 5000)) {
    throw new Error(`Firefox did not exit after termination (pid ${child.pid}).`);
  }
}

async function removeFirefoxProfile(profile, workDirectory) {
  const resolvedProfile = path.resolve(profile);
  const resolvedWork = path.resolve(workDirectory);
  const expectedPrefix = resolvedWork.endsWith(path.sep) ? resolvedWork : resolvedWork + path.sep;
  if (!resolvedProfile.startsWith(expectedPrefix) || !path.basename(resolvedProfile).startsWith('firefox-run-')) {
    throw new Error(`Refusing to remove unexpected Firefox profile path: ${resolvedProfile}`);
  }
  for (let attempt = 0; ; attempt++) {
    try {
      fs.rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
      return;
    } catch (error) {
      if (attempt === 10 || !['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(error.code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
}

module.exports = { createFirefoxProfile, removeFirefoxProfile, stopFirefox };
