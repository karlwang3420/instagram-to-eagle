/* Pure normalization and Eagle payload construction. No network or browser access. */
globalThis.EagleCore = (() => {
  function mediaURL(value) {
    try {
      const u = new URL(value);
      const allowed = ["cdninstagram.com", "fbcdn.net", "instagram.com"];
      if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return null;
      if (!allowed.some(d => u.hostname === d || u.hostname.endsWith("." + d))) return null;
      return u.href;
    } catch { return null; }
  }
  function postURL(value) {
    try {
      const u = new URL(value);
      if (!/^https:$/.test(u.protocol) || !["instagram.com", "www.instagram.com"].includes(u.hostname)) return null;
      const story = u.pathname.match(/^\/stories\/([\w.]+)(?:\/(\d+))?\/?$/);
      if (story && !['highlights','archive'].includes(story[1].toLowerCase())) return `https://www.instagram.com/stories/${story[1]}/${story[2] ? story[2] + '/' : ''}`;
      const m = u.pathname.match(/^\/(?:[\w.]+\/)?(p|reel|reels)\/([\w-]+)\/?$/);
      return m ? `https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}/` : null;
    } catch { return null; }
  }
  function identity(value) {
    try { return new URL(value).pathname; } catch { return value; }
  }
  function best(list) {
    return (Array.isArray(list) ? list : []).filter(x => mediaURL(x.url || x.src))
      .sort((a, b) => ((b.width || b.config_width || 0) * (b.height || b.config_height || 1)) - ((a.width || a.config_width || 0) * (a.height || a.config_height || 1)))[0];
  }
  function normalize(post, dom) {
    const p = post || {};
    const children = p.carousel_media || p.edge_sidecar_to_children?.edges?.map(e => e.node);
    const nodes = children || (post ? [p] : []);
    const media = nodes.map((n, i) => {
      const video = n.media_type === 2 || n.is_video === true || n.__typename === "GraphVideo";
      const img = best(n.image_versions2?.candidates || n.display_resources);
      const vid = best(n.video_versions || n.video_resources);
      return {
        type: video ? "video" : "image", index: i + 1, id: String(n.pk || n.id || ""),
        ids: [n.pk,n.id,n.video_id,n.video_fbid,n.fbid].filter(v=>typeof v==='string'||Number.isSafeInteger(v)).map(v=>String(v).split('_')[0]),
        url: mediaURL(video ? (vid?.url || vid?.src || n.video_url) : (img?.url || img?.src || n.display_url)),
        preview: mediaURL(img?.url || img?.src || n.display_url),
        // Keep the exposed renditions for identity matching. The timeline can
        // render a different size/path than the highest-resolution API image.
        imageSources: [...new Set([
          n.display_url,
          ...(Array.isArray(n.image_versions2?.candidates) ? n.image_versions2.candidates : []).map(x => x.url || x.src),
          ...(Array.isArray(n.display_resources) ? n.display_resources : []).map(x => x.url || x.src)
        ].map(mediaURL).filter(Boolean))],
        width: (video ? vid?.width : img?.width) || n.original_width || n.dimensions?.width || null,
        height: (video ? vid?.height : img?.height) || n.original_height || n.dimensions?.height || null,
        alt: n.accessibility_caption || "", duration: n.video_duration ?? null,
        hasAudio: n.has_audio ?? null
      };
    });
    const username = p.user?.username || p.owner?.username || dom.author || "";
    const caption = p.caption?.text ?? (typeof p.caption === "string" ? p.caption : undefined)
      ?? p.edge_media_to_caption?.edges?.[0]?.node?.text ?? dom.caption ?? "";
    const timestamp = p.taken_at || p.taken_at_timestamp;
    const published = timestamp ? new Date(timestamp * 1000).toISOString() : (dom.published || "");
    const meta = {
      platform: "Instagram", postURL: postURL(dom.url), shortcode: dom.code,
      author: username, authorName: p.user?.full_name || p.owner?.full_name || "",
      authorId: String(p.user?.pk || p.user?.id || p.owner?.id || ""),
      authorVerified: p.user?.is_verified ?? p.owner?.is_verified ?? null,
      authorURL: username ? `https://www.instagram.com/${encodeURIComponent(username)}/` : "",
      caption, published, capturedAt: new Date().toISOString(),
      location: p.location || null,
      likes: p.like_count ?? p.edge_media_preview_like?.count ?? p.edge_liked_by?.count ?? null,
      comments: p.comment_count ?? p.edge_media_to_comment?.count ?? p.edge_media_to_parent_comment?.count ?? null,
      views: p.play_count ?? p.video_view_count ?? p.view_count ?? null,
      taggedUsers: p.usertags?.in || p.edge_media_to_tagged_user?.edges || [],
      collaborators: p.coauthor_producers || [],
      audio: p.clips_metadata?.music_info || p.clips_metadata?.original_sound_info || null,
      productType: p.product_type || null,
      metadataSource: post ? "Instagram post data" : "Visible page (partial metadata)",
      visiblePostText: dom.visibleText || ""
    };
    // Preserve additional exposed post metadata in the annotation, without copying session/React state.
    const extra = {};
    for (const k of ["id", "pk", "code", "shortcode", "media_type", "carousel_media_count", "caption", "accessibility_caption", "clips_metadata", "music_metadata", "is_paid_partnership", "sponsor_tags", "product_tags", "fbid", "video_duration", "has_audio", "original_width", "original_height", "edge_media_to_caption", "edge_media_to_tagged_user"]) {
      if (p[k] !== undefined) extra[k] = p[k];
    }
    meta.additionalMetadata = extra;
    const isCarousel = p.media_type === 8 || p.__typename === "GraphSidecar" || !!children;
    const expected = p.carousel_media_count || children?.length || (post && !isCarousel ? 1 : null);
    const complete = !!post && (children ? children.length === expected : !isCarousel && expected === 1);
    return { meta, media, complete, expected, isReel: /\/reels?\//.test(dom.url) || p.product_type === "clips" };
  }
  function select(result, dom, mode) {
    if (mode === 'post') {
      if (!result.complete || !result.media.length) throw new Error('Could not verify every image and video in this post. Open the post and retry; no partial post was sent.');
      if (result.media.some(m=>!mediaURL(m.url))) throw new Error('An image or video file is missing. Nothing from this post was sent.');
      return result.media;
    }
    if (mode === 'story' || mode === 'stories') {
      if (!result.isStory) throw new Error('Open the Stories viewer first.');
      if (mode === 'stories') {
        if (!result.complete || !result.media.length) throw new Error('Could not verify all stories for this account. Try Current story; no partial batch was sent.');
        if (result.media.some(m => !mediaURL(m.url))) throw new Error('A story has no direct image/video file. No partial batch was sent.');
        return result.media;
      }
      const match = result.media.find(m => m.id === (dom.storyId || result.currentStoryId));
      if (match?.url && (dom.current?.type !== 'video' || match.type === 'video')) return [match];
      if (mediaURL(dom.current?.url)) return [{ ...dom.current, id: dom.storyId, index: 1 }];
      throw new Error(`Could not resolve the selected story's media.${result.note ? ' ' + result.note + '.' : ''} Instagram may not have exposed its file yet. Reload the viewer and retry.`);
    }
    if (mode === 'video' && dom.current?.type === 'video') {
      const ids = result.activeMediaIds || [];
      const videos = result.media.filter(m=>m.type==='video');
      if (ids.length) {
        // Every nearest-player hint must identify the same child of this post.
        // Conflicting IDs and IDs belonging to another post never fall back to
        // a guessed index, even if that index happens to be in range.
        const matches = ids.map(id=>videos.filter(m=>(m.ids || [String(m.id || '').split('_')[0]]).includes(id)));
        if (matches.some(list=>list.length!==1) || new Set(matches.map(list=>list[0])).size!==1) {
          throw new Error('Could not match this video player to one video in the selected post. Nothing was sent.');
        }
        const selected=matches[0][0];
        if(mediaURL(selected.url))return [selected];
        if(mediaURL(dom.current.url))return [{...dom.current,index:selected.index}];
        throw new Error('The selected video has no direct downloadable file. Nothing was sent.');
      }
      const urls = videos.filter(m=>m.url && mediaURL(dom.current.url) && identity(m.url)===identity(dom.current.url));
      const posters = videos.filter(m=>mediaURL(dom.current.preview) && [m.preview,...(m.imageSources||[])].some(u=>u&&identity(u)===identity(dom.current.preview)));
      if(urls.length===1)return [urls[0]];
      if(posters.length===1 && mediaURL(posters[0].url))return [posters[0]];
      if(mediaURL(dom.current.url))return [{...dom.current,index:null}];
      if(result.complete && videos.length===1 && mediaURL(videos[0].url))return [videos[0]];
    }
    // Blob videos sometimes need a compatible index to distinguish duplicate
    // posters. Images have a direct captured source: resolve them below by file,
    // never by the position/count of a virtualized timeline window.
    if (mode === 'video' && dom.slideIndex != null && result.complete) {
      if (!Number.isInteger(dom.slideIndex) || dom.slideIndex < 1 || dom.slideIndex > result.media.length
          || (dom.slideCount != null && dom.slideCount !== result.media.length)) {
        throw new Error('The carousel position no longer matches the post data. Select the slide again.');
      }
      const selected = result.media[dom.slideIndex-1];
      const type = mode === 'video' ? 'video' : 'image';
      if (selected.type !== type || dom.current?.type !== type) throw new Error('The carousel changed between image and video. Select the slide again.');
      if (mediaURL(selected.url)) return [selected];
      if (mediaURL(dom.current.url)) return [{...dom.current,index:dom.slideIndex}];
      throw new Error('The selected carousel slide has no direct downloadable file. Nothing was sent.');
    }
    if (mode === "video") {
      if (dom.current?.type !== "video") throw new Error("Move to a video slide, then try again.");
      const videos = result.media.filter(m => m.type === "video");
      const matches = videos.filter(m => (m.url && identity(m.url) === identity(dom.current.url))
        || (m.preview && dom.current.preview && identity(m.preview) === identity(dom.current.preview)));
      const match = matches.length === 1 ? matches[0] : null;
      const selected = match || (result.complete && videos.length === 1 ? videos[0] : null);
      if (selected?.url) return [selected];
      if (mediaURL(dom.current.url)) return [{ ...dom.current, index: dom.slideIndex || null }];
      if (videos.length > 1 && !selected) throw new Error("Could not identify this video slide. Open the post and retry; no video was sent.");
      throw new Error("Instagram exposed only a streaming/blob video here. Start the video and retry. This build needs a direct MP4; it cannot merge separate audio/video streams.");
    }
    if (mode === "reel") {
      if (!result.isReel) throw new Error("Select a Reel, or use Save video for a timeline video.");
      const video = result.media.find(m => m.type === "video" && m.url);
      if (video) return [video];
      if (dom.current?.type === "video" && mediaURL(dom.current.url)) return [{ ...dom.current, index: 1 }];
      throw new Error("Instagram exposed only a streaming/blob video here. Start the Reel and retry. This build needs a direct MP4; it cannot merge separate audio/video streams.");
    }
    if (mode === "all") {
      if (!result.complete) throw new Error("Could not verify the full carousel. Open this post, then retry All images.");
      const images = result.media.filter(m => m.type === "image");
      if (!images.length) throw new Error("This post contains no images.");
      if (images.some(m => !mediaURL(m.url))) throw new Error("An image URL is missing; nothing was sent. Reload the post and retry.");
      return images;
    }
    if (!dom.current) throw new Error("The active slide could not be identified. Let the post finish loading, then try again.");
    if (dom.current.type !== "image") throw new Error("The current slide is a video. Move to an image slide first.");
    if (!mediaURL(dom.current.url)) throw new Error("The current image is still loading. Try again in a moment.");
    const matches = result.media.filter(m => m.type === "image" &&
      [m.url, m.preview, ...(m.imageSources || [])].some(u => u && identity(u) === identity(dom.current.url)));
    if (matches.length === 1 && mediaURL(matches[0].url)) return [matches[0]];
    // No proven mapping (or the same photo occurs twice): the visible img's
    // highest srcset source is still safe to save. Do not invent a slide index
    // or substitute another file based on how many DOM slides remain mounted.
    return [{ ...dom.current, index: null }];
  }
  function payload(result, selected, settings = {}) {
    if (!postURL(result.meta.postURL)) throw new Error("A valid post URL is required before importing.");
    return {
      items: selected.map(m => {
        const url = mediaURL(m.url);
        if (!url) throw new Error("Unsupported media host or URL.");
        const meta = m.storyMeta || result.meta;
        const website = postURL(meta.postURL);
        if (!website) throw new Error('A valid source URL is required before importing.');
        const hashtags = [...meta.caption.matchAll(/#([\p{L}\p{N}_]+)/gu)].map(m => m[1]);
        const tags = [...new Set([
          ...(settings.tagDefaults !== false ? ['Instagram', ...(result.isStory ? ['Story'] : result.isReel ? ['Reel'] : [])] : []),
          ...(settings.tagCreator !== false && meta.author ? ['@' + meta.author.replace(/^@/, '')] : []),
          ...(settings.tagHashtags !== false ? hashtags : [])
        ])];
        const title = meta.caption.split("\n")[0].slice(0, 90).trim();
        const name = [meta.author ? `@${meta.author}` : "Instagram", title || (result.isStory ? `Story ${meta.shortcode}` : meta.shortcode),
          m.index ? String(m.index).padStart(2, "0") : "current"].join(" · ").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
        return {
          url, name, website, tags,
          annotation: "",
          headers: { Referer: "https://www.instagram.com/" }
        };
      }),
      ...(settings.folderId ? { folderId: settings.folderId } : {})
    };
  }
  function normalizeStories(data, dom) {
    const currentStoryId = dom.storyId || data.currentStoryId || '';
    if (currentStoryId && !/^\d+$/.test(currentStoryId)) throw new Error('Invalid active story ID. Nothing was sent.');
    const source = currentStoryId ? {...dom,code:currentStoryId,url:`https://www.instagram.com/stories/${dom.author}/${currentStoryId}/`} : {...dom,code:'current'};
    const result = normalize(null, source);
    result.currentStoryId = currentStoryId;
    result.note = data.note || '';
    result.isStory = true; result.isReel = false;
    result.media = (data.items || []).map((item, index) => {
      const id = String(item.pk || item.id || '').split('_')[0];
      if (!/^\d+$/.test(id)) throw new Error('Invalid story ID. Nothing was sent.');
      const storyDom = { ...dom, code: id, url: `https://www.instagram.com/stories/${dom.author}/${id}/` };
      const normalized = normalize({ ...item, user: data.user }, storyDom);
      return { ...normalized.media[0], id, index: index + 1, storyMeta: normalized.meta };
    });
    result.complete = data.complete && new Set(result.media.map(m => m.id)).size === result.media.length;
    result.expected = result.media.length;
    return result;
  }
  return { mediaURL, postURL, identity, normalize, normalizeStories, select, payload };
})();
