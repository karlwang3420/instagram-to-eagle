const $ = id => document.getElementById(id);
const tagKeys = ['tagDefaults', 'tagHashtags', 'tagCreator'];
const setupPage = location.search === '?setup=1';
let folderReady = false;
let saveQueue = Promise.resolve();
let refreshRevision = 0;
if (setupPage) document.body.classList.add('setup-page');
$('version').textContent = 'v' + browser.runtime.getManifest().version;
async function request(message) {
  const response = await browser.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || 'The extension did not respond. Reload it and try again.');
  return response.data;
}
function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function paintAccess(access) {
  $('accessPanel').hidden = access.ready && !setupPage;
  for (const [id, granted] of [['instagramAccess', access.instagram], ['eagleAccess', access.eagle]]) {
    $(id).textContent = granted ? 'Allowed' : 'Needed'; $(id).classList.toggle('allowed', granted);
  }
  $('grantAccess').hidden = access.ready;
  $('accessHeading').textContent = access.ready ? 'Access ready' : 'Access needed';
  $('accessDescription').textContent = access.ready ? 'Instagram and Eagle access are enabled.' : 'Allow access to save Instagram media to Eagle.';
  $('accessStatus').textContent = access.ready ? 'Keep Eagle open and reload Instagram.' : 'Firefox will ask you to confirm.';
  $('accessStatus').classList.remove('error');
}
async function checkEagle() {
  try { await request({type:'status'}); $('connection').textContent = 'Eagle connected'; $('light').className = 'online'; return true; }
  catch (e) { $('connection').textContent = 'Eagle is unavailable'; $('light').className = 'offline'; status(e.message, true); return false; }
}
async function folders() {
  $('folder').disabled = true; folderReady = false;
  try {
    const saved = await browser.storage.local.get({folderId:''});
    const list = await request({type:'folders'});
    $('folder').replaceChildren(new Option('Unfiled', ''), ...list.map(f => new Option(f.name, f.id)));
    if (saved.folderId && !list.some(f => f.id === saved.folderId)) {
      $('folder').add(new Option('Saved folder unavailable — choose another', saved.folderId));
      status('Your saved folder is not in this Eagle library. Choose a destination before saving.', true);
    }
    $('folder').value = saved.folderId;
    folderReady = true; $('folder').disabled = false;
  } catch (e) { status(e.message, true); }
}
async function refresh() {
  const revision = ++refreshRevision;
  $('reconnect').disabled = true;
  try {
    const access = await EagleAccess.state();
    if (revision !== refreshRevision) return;
    paintAccess(access);
    $('refreshFolders').disabled = !access.eagle;
    if (!access.eagle) {
      folderReady = false; $('folder').disabled = true;
      $('connection').textContent = 'Permission needed to connect Eagle'; $('light').className = 'offline';
      status('Choose Allow access above to finish setup.'); return;
    }
    status(access.instagram ? '' : 'Allow Instagram access above, then reload Instagram.');
    if (await checkEagle()) await folders();
    else {folderReady=false;$('folder').disabled=true;}
  } catch (e) { status(e.message, true); }
  finally { if (revision === refreshRevision) $('reconnect').disabled = false; }
}
function saveSettings(event) {
  const key = event.target.id;
  if (key === 'folder' && !folderReady) return;
  // Only save the changed field: an offline library must not erase a folder.
  // Serialize rapid toggles so the last choice wins.
  const change = key === 'folder' ? {folderId:$('folder').value} : {[key]:$(key).checked};
  $('settingsStatus').textContent = 'Saving…';
  saveQueue = saveQueue.then(() => browser.storage.local.set(change)).then(() => {
    $('settingsStatus').textContent = 'Saved';
  }).catch(e => {$('settingsStatus').textContent = 'Could not save';status(e.message,true);});
}
$('grantAccess').addEventListener('click', async () => {
  // Stay inside this user gesture: no await before the permissions request.
  try {
    const pending = browser.permissions.request({origins:EagleAccess.origins});
    $('grantAccess').disabled = true;
    const granted = await pending;
    await refresh();
    if (!granted) { $('accessStatus').textContent = 'Access was not granted. Nothing was changed; choose Allow access when you’re ready.'; $('accessStatus').classList.add('error'); }
  } catch (e) { $('accessStatus').textContent = 'Could not request access. ' + e.message; $('accessStatus').classList.add('error'); }
  finally { $('grantAccess').disabled = false; }
});
$('reconnect').addEventListener('click', refresh);
$('refreshFolders').addEventListener('click', folders);
$('folder').addEventListener('change', saveSettings);
tagKeys.forEach(key => $(key).addEventListener('change', saveSettings));
browser.permissions.onAdded.addListener(refresh);
browser.permissions.onRemoved.addListener(refresh);
(async () => {
  try {
    const settings = await browser.storage.local.get(Object.fromEntries(tagKeys.map(key => [key,true])));
    tagKeys.forEach(key => {$(key).checked=settings[key] !== false;$(key).disabled=false;});
    $('settingsStatus').textContent = '';
  } catch (e) { $('settingsStatus').textContent = 'Could not load preferences';status(e.message,true); }
  await refresh();
})();
