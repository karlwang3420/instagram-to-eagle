/* Privileged bridge: extension UI and trusted in-post clicks can import. */
const EAGLE_ENDPOINT = "http://127.0.0.1:41595";
const jobs = new Set();
const previews = new Map();
const igPage = url => { try { const u = new URL(url); return u.protocol === "https:" && ["instagram.com", "www.instagram.com"].includes(u.hostname); } catch { return false; } };

async function eagle(path, body) {
  // A CORS-readable GET does not prove that the JSON POST has host access.
  await EagleAccess.requireLocal();
  let response;
  try {
    response = await fetch(EAGLE_ENDPOINT + path, {
      method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(body ? 60000 : 4000), redirect: "error", credentials: "omit"
    });
  } catch (e) {
    if (body) throw new Error("Eagle did not confirm the import. Check Eagle before retrying to avoid duplicates.");
    throw new Error("Open Eagle and its library, then retry. The local API on port 41595 is not responding.");
  }
  if (!response.ok) throw new Error(`Eagle returned HTTP ${response.status}. Check that Eagle is up to date and its API is enabled.`);
  const data = await response.json();
  if (data.status !== "success") throw new Error(data.message || data.error || "Eagle rejected the request.");
  return data.data;
}
async function selection(tabId, contextMenu = false) {
  const tab = await browser.tabs.get(tabId);
  if (!igPage(tab.url)) throw new Error("Open an Instagram timeline post or Reel first.");
  let reply;
  try { reply = await browser.tabs.sendMessage(tabId, { type: "eagle:select", contextMenu }); }
  catch {
    await browser.scripting.executeScript({ target: { tabId }, files: browser.runtime.getManifest().content_scripts[0].js });
    reply = await browser.tabs.sendMessage(tabId, { type: "eagle:select", contextMenu });
  }
  if (!reply?.ok) throw new Error(reply?.error || "Could not identify the post.");
  return reply.context;
}
async function extract(tabId, context, network, mode) {
  if (context.isStory) {
    const results = await browser.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: extractInstagramStories, args: [context, network, mode === 'stories'] });
    return EagleCore.normalizeStories(results[0]?.result || {items:[],complete:false}, context);
  }
  const results = await browser.scripting.executeScript({ target: { tabId }, world: "MAIN", func: extractInstagramPost, args: [context, network, mode] });
  const { post, note, activeMediaIds } = results[0]?.result || {};
  return { ...EagleCore.normalize(post, context), note, activeMediaIds };
}
async function notify(tabId, text, failed = false) {
  try { await browser.tabs.sendMessage(tabId, { type: "eagle:toast", text, failed }); } catch { /* User closed tab. */ }
}
async function preview(tabId) {
  const context = await selection(tabId);
  const result = await extract(tabId, context, false);
  if (context.isStory && result.currentStoryId) {
    context.storyId = result.currentStoryId;
    context.url = result.meta.postURL;
  }
  const token = crypto.randomUUID();
  // Cache only the selection, not media URLs or metadata across browser sessions.
  previews.set(token, { tabId, context, created: Date.now() });
  for (const [k, v] of previews) if (Date.now() - v.created > 600000) previews.delete(k);
  return {
    token, author: result.meta.author, caption: result.meta.caption,
    url: context.url, image: EagleCore.mediaURL(context.current?.preview || context.current?.url),
    currentType: context.current?.type, isReel: result.isReel, isStory: result.isStory,
    images: result.complete ? result.media.filter(m => m.type === "image").length : null,
    metadataSource: result.meta.metadataSource
  };
}
async function save(tabId, context, mode) {
  if (!["current", "all", "post", "video", "reel", "story", "stories"].includes(mode)) throw new Error("Unknown import action.");
  if (context.isStory && !['story','stories'].includes(mode)) throw new Error('Use Current story or All stories in the Stories viewer.');
  if (jobs.has(tabId)) throw new Error("An import is already running for this tab.");
  jobs.add(tabId);
  try {
    await eagle("/api/application/info");
    await notify(tabId, "Reading post metadata…");
    const result = await extract(tabId, context, true, mode);
    if (["all","post"].includes(mode) && !result.complete && !context.isGrid) {
      await notify(tabId, "Collecting carousel media… Please leave this post in view.");
      const walked = await browser.tabs.sendMessage(tabId, { type: "eagle:carousel", marker: context.marker });
      if (!walked?.ok) throw new Error(walked?.error || "Could not collect the carousel.");
      result.media = walked.items; result.expected = walked.items.length; result.complete = true;
    }
    const selected = EagleCore.select(result, context, mode);
    const settings = await importSettings();
    const payload = EagleCore.payload(result, selected, settings);
    if (JSON.stringify(payload).length > 2000000) throw new Error("Post metadata is too large to import safely in this version.");
    await eagle("/api/item/addFromURLs", payload);
    const partial = result.meta.metadataSource.includes("partial");
    const text = `Sent ${selected.length} ${mode==='post' ? selected.length===1?'file':'files' : context.isStory ? selected.length === 1 ? 'story' : 'stories' : mode === "reel" ? "Reel" : mode === "video" ? "video" : selected.length === 1 ? "image" : "images"} to Eagle. Check Eagle for download completion.`;
    await notify(tabId, text);
    return { text, partial };
  } finally { jobs.delete(tabId); }
}
async function route(message) {
  if (message.type === "preview") return preview(message.tabId);
  if (message.type === "status") {
    const app = await eagle("/api/application/info");
    return { version: app.version };
  }
  if (message.type === "folders") {
    const data = await eagle("/api/folder/list");
    const folders = [];
    const visit = (list, prefix = "") => {
      for (const f of list || []) {
        folders.push({ id: f.id, name: prefix + f.name }); visit(f.children, prefix + f.name + " / ");
      }
    };
    visit(data); return folders;
  }
  if (message.type === "save") {
    const p = previews.get(message.token);
    if (!p || Date.now() - p.created > 600000) throw new Error("Reopen the popup to select the post again.");
    const value = await save(p.tabId, p.context, message.mode);
    return value;
  }
  throw new Error("Unknown request.");
}
async function importSettings() {
  const settings=await browser.storage.local.get({folderId:'',tagHashtags:true,tagCreator:true,tagDefaults:true});
  if (settings.folderId) {
    const folders=await eagle('/api/folder/list');
    const contains=list=>(list||[]).some(f=>f.id===settings.folderId||contains(f.children));
    if (!contains(folders)) throw new Error('Your saved Eagle folder is missing from this library. Choose a destination in the popup and retry.');
  }
  return settings;
}
browser.runtime.onMessage.addListener((message, sender) => {
  if (sender.id===browser.runtime.id && sender.tab && sender.frameId===0 && igPage(sender.url)) {
    if (message.type==='eagle:profile-action' && /^[a-f0-9-]{36}$/.test(message.marker) && message.mode==='grid') {
      return (async()=>{
        const reply=await browser.tabs.sendMessage(sender.tab.id,{type:'eagle:resolve-profile',marker:message.marker,mode:message.mode},{frameId:0});
        if(!reply?.ok) throw new Error(reply?.error||'Select the profile control again.');
        return save(sender.tab.id,reply.context,'post');
      })().then(data=>({ok:true,data}),e=>({ok:false,error:e.message}));
    }
  }
  // An inline request contains a one-use click marker, never arbitrary URLs.
  if (message.type === "eagle:inline" && sender.id === browser.runtime.id && sender.tab && sender.frameId === 0 && igPage(sender.url) && /^[a-f0-9-]{36}$/.test(message.marker) && ["current", "all", "post", "video", "reel", "story", "stories"].includes(message.mode)) {
    return (async () => {
      const tab = await browser.tabs.get(sender.tab.id);
      if (!igPage(tab.url)) throw new Error("The Instagram tab changed. Try again.");
      const reply = await browser.tabs.sendMessage(tab.id, { type: "eagle:resolve-inline", marker: message.marker, mode: message.mode }, { frameId: 0 });
      if (!reply?.ok) throw new Error(reply?.error || "Click the Eagle button on the post again.");
      return save(tab.id, reply.context, message.mode);
    })().then(data => ({ ok: true, data }), e => ({ ok: false, error: e.message }));
  }
  const popup = sender.url === browser.runtime.getURL('popup/popup.html') && !sender.tab;
  const setup = sender.url === browser.runtime.getURL('popup/popup.html?setup=1') && sender.frameId === 0;
  if (sender.id !== browser.runtime.id || (!popup && !setup)) return undefined;
  if (!['status','folders'].includes(message.type)) return Promise.resolve({ok:false,error:'Use the download buttons on Instagram.'});
  return route(message).then(data => ({ ok: true, data }), e => ({ ok: false, error: e.message }));
});
browser.tabs.onRemoved.addListener(id => {
  for (const [token, p] of previews) if (p.tabId === id) previews.delete(token);
});

async function updateAccessBadge() {
  const access = await EagleAccess.state();
  await browser.action.setBadgeText({text: access.ready ? '' : '!'});
  await browser.action.setBadgeBackgroundColor({color: '#9b4d32'});
  await browser.action.setTitle({title: access.ready ? 'Instagram to Eagle' : 'Instagram to Eagle — allow access to finish setup'});
  return access;
}
async function installed(details) {
  const access = await updateAccessBadge();
  // First-run guidance, or an update needing grants. Normal updates stay quiet.
  if (details.reason === 'install' || (details.reason === 'update' && !access.ready)) {
    await browser.tabs.create({url: browser.runtime.getURL('popup/popup.html?setup=1')});
  }
}
browser.runtime.onInstalled.addListener(details => { installed(details).catch(console.error); });
browser.permissions.onAdded.addListener(() => { updateAccessBadge().catch(console.error); });
browser.permissions.onRemoved.addListener(() => { updateAccessBadge().catch(console.error); });
updateAccessBadge().catch(console.error);
