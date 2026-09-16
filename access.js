/* Shared permission checks. Never grant access implicitly or cache a grant. */
globalThis.EagleAccess = (() => {
  const instagram = ['https://www.instagram.com/*', 'https://instagram.com/*'];
  const local = 'http://127.0.0.1/*';
  const origins = [...instagram, local];
  async function state() {
    const [site, eagle] = await Promise.all([
      browser.permissions.contains({origins: instagram}),
      browser.permissions.contains({origins: [local]})
    ]);
    return {instagram: site, eagle, ready: site && eagle};
  }
  async function requireLocal() {
    if (!await browser.permissions.contains({origins: [local]})) {
      throw new Error('Eagle access is not allowed yet. Open Instagram to Eagle from Firefox’s extensions menu and choose Allow access. Nothing was sent.');
    }
  }
  return {origins, state, requireLocal};
})();
