# Chrome Web Store listing — Instagram to Eagle 1.0.4

Copy the text below into a **new item** in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). This is the first Chrome submission. Firefox keeps its separate AMO entry ([AMO-SUBMISSION.md](AMO-SUBMISSION.md)).

**Status:** submitted for public review on October 4, 2026, as item `kcbhpiojkhdfflhoepkonoobinkdkhpo` (version 1.0.4), set to publish automatically once approved. Not yet approved. Once live, the listing will be at `https://chromewebstore.google.com/detail/kcbhpiojkhdfflhoepkonoobinkdkhpo`.

## Before you start

- **Developer account:** registering requires a one-time US$5 fee, 2-Step Verification on the Google account, and a verified contact email (**Account** tab).
- **Trader status:** under the EU Digital Services Act, declare whether you publish as a trader. A free, non-commercial hobby project is normally a non-trader. Make this decision yourself; it is not a technical setting.
- **Privacy policy URL:** [PRIVACY.md](../PRIVACY.md) was updated for Chrome in 1.0.4. Push it to `main` before you submit, because the listing links to the GitHub copy.

## Package

Upload `dist/instagram-to-eagle-1.0.4-chrome.zip` (**Package → Upload new package**). Do not upload the Firefox XPI or the source ZIP.

The generated manifest declares `minimum_chrome_version: "148"`, runs the background scripts in an MV3 service worker, and requests `scripting`, `storage`, and `offscreen` permissions. It requests host access only to Instagram and `127.0.0.1`. Version 1.0.4 removes the unused `activeTab` permission so reviewers do not flag an unnecessary permission.

## Store listing tab

### Name and summary

Both come from the manifest and cannot be edited in the dashboard:

- **Name:** Instagram to Eagle
- **Summary** (104 of 132 characters): Save Instagram posts, profile grids, Reels and Stories to Eagle with a short title, source link and tags.

### Description

```text
Save the Instagram media you choose directly to your Eagle library, without a separate download-folder step.

Instagram to Eagle adds download buttons to Instagram posts, profile thumbnails, Reels and Stories. Choose one item, or save every image and video in a carousel in order.

FEATURES
• Save single photos and videos, the current carousel item, or a complete carousel.
• Save a whole post straight from a profile, Explore, search or Saved grid by hovering a thumbnail.
• Save Reels from the player's action rail.
• Save the current Story, or every Story still available from that account.
• Choose an Eagle folder, including nested folders, from the extension popup.
• Every item keeps a short title and its original Instagram source link.
• Turn default tags, caption hashtags and creator @username tags on or off independently.
• A short chime confirms that Eagle accepted the save.

GETTING STARTED
1. Install Eagle (eagle.cool) and open a library.
2. Sign in to Instagram in Chrome.
3. Install this extension and reload any open Instagram tabs.
4. Use the download buttons on Instagram. Open the extension popup to choose a folder and tags.

REQUIREMENTS
Desktop Chrome 148 or newer, with Eagle running on the same computer. This extension is free; Eagle is separate paid software with a free trial. Tested on Windows. The interface is in English.

PRIVACY
No analytics, no ads, and no developer server. When you click a download button, the extension reads the selected Instagram post and sends its media URLs, a short title, the source link and your chosen tags to Eagle's local API on your computer (127.0.0.1). Eagle then downloads the files from Instagram's media servers. Your Instagram login cookies are never copied to Eagle. Folder and tag preferences are stored only in Chrome's local extension storage.

LIMITATIONS
Instagram layout changes can affect detection. Videos need a direct media file; segmented streams are not supported. Highlights, archived or expired Stories, and whole-profile downloads are not supported. If the extension cannot verify every item in a carousel, it reports an error instead of saving an incomplete batch.

This is an independent, open-source project (MIT). It is not affiliated with or endorsed by Instagram, Meta or Eagle. Save only content you have permission to use.

Source and support: https://github.com/karlwang3420/instagram-to-eagle
```

### Category and language

| Field | Value |
| --- | --- |
| Category | **Productivity → Tools**. *Lifestyle → Art & Design* is a reasonable alternative, because Eagle users are mostly designers collecting references. |
| Language | English (United States) |

### Graphic assets

All images are in [`store-assets/chrome/`](store-assets/chrome/). Screenshots and promo tiles are 24-bit PNGs without alpha, at the exact required sizes.

| Slot | File | Required |
| --- | --- | --- |
| Store icon, 128×128 | `store-icon-128.png` (96 px artwork, 16 px transparent padding, per Google's icon guidance) | Yes |
| Screenshot 1 | `screenshot-1-post.png`: post and carousel buttons, with the "Sent to Eagle" toast | At least one |
| Screenshot 2 | `screenshot-2-profile-grid.png`: hover button on a profile grid | |
| Screenshot 3 | `screenshot-3-reels.png`: button in the Reel action rail | |
| Screenshot 4 | `screenshot-4-stories.png`: current Story and all Stories buttons | |
| Screenshot 5 | `screenshot-5-settings.png`: popup with folder and tag settings | |
| Small promo tile, 440×280 | `promo-small-440x280.png` | Yes |
| Marquee promo tile, 1400×560 | `promo-marquee-1400x560.png` | Optional; required for marquee featuring |
| YouTube video | None | Optional |

How the images were made: [store-assets/chrome/README.md](store-assets/chrome/README.md).

### Additional fields

| Field | Value |
| --- | --- |
| Official URL | None (needs a Search Console–verified site; skip) |
| Homepage URL | `https://github.com/karlwang3420/instagram-to-eagle` |
| Support URL | `https://github.com/karlwang3420/instagram-to-eagle/issues` |
| Mature content | No |

## Privacy practices tab

### Single purpose

```text
Save Instagram photos, videos, Reels and Stories that the user selects into the user's own Eagle library, a desktop app running on the same computer.
```

### Permission justifications

The dashboard has one *Host permission justification* box; the submitted text combines the two host entries below.

**scripting**

```text
When the user clicks one of the extension's download buttons on Instagram, the background service worker uses scripting.executeScript to run packaged extraction functions in that Instagram tab. These functions read the selected post's or Story's media URLs, creator and caption from Instagram's page data. It also re-injects the packaged content scripts into an Instagram tab that was open before the extension was installed or updated. No remote code is executed.
```

**storage**

```text
Stores the user's chosen Eagle destination folder ID and three on/off tag preferences in chrome.storage.local. Nothing else is stored, and sync storage is not used.
```

**offscreen**

```text
MV3 service workers cannot play audio. When Eagle accepts a save, the extension briefly creates an offscreen document (reason AUDIO_PLAYBACK) that plays a packaged short chime. The offscreen page contains only an <audio> element, and it is replaced on the next save or closed by Chrome when idle.
```

**Host permission: https://www.instagram.com/*, https://instagram.com/***

```text
Required for the extension's single purpose. Content scripts place download buttons on Instagram posts, profile grids, Reels and Stories. When the user clicks a button, the extension reads that post's media and, if needed, makes same-origin Instagram requests with the existing signed-in session to resolve every item in a carousel or Story. The extension runs on no other websites.
```

**Host permission: http://127.0.0.1/***

```text
Eagle is a desktop application that exposes a local API at http://127.0.0.1:41595. The extension uses it to check that Eagle is running, list the user's folders, and send the selected media URLs, title, source link and tags to import. Chrome match patterns cannot be restricted to a port; the extension connects only to port 41595, which is also enforced by its content security policy. No data is sent to any remote server.
```

### Remote code

Select **No, I am not using remote code.** All JavaScript is in the package. The page-context extraction code is passed to `scripting.executeScript` as packaged functions, not as fetched strings. The extension page CSP is `script-src 'self'`.

### Data usage

The User Data FAQ requires disclosure even when data is processed only on the device. The extension handles the following:

| Category | Check? | Reason |
| --- | --- | --- |
| Personally identifiable information | No* | The extension does not read the user's own name, email, or account details. *It does handle the **post creator's** public `@username` for titles and tags. Check this box too if you prefer the most conservative disclosure. |
| Health information | No | |
| Financial and payment information | No | |
| Authentication information | No | It does not read passwords, cookies, or tokens. Instagram requests use the browser's normal session, and cookies are never copied to Eagle or stored. |
| Personal communications | No | |
| Location | No | |
| Web history | **Yes** | The Instagram URL of each post the user saves is sent to Eagle as the item's source link. |
| User activity | No | No click, keystroke, or mouse tracking. It only responds to clicks on its own buttons. |
| Website content | **Yes** | Media URLs, the caption's first line and hashtags, and the creator username of the post the user selects. |

Check all three certifications. All of them are true for this extension.

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** `https://github.com/karlwang3420/instagram-to-eagle/blob/main/PRIVACY.md`

## Distribution tab

| Field | Value |
| --- | --- |
| Payments | Free of charge |
| Visibility | Public. Choose Unlisted if you want to test the live install link first. |
| Regions | All regions |

## Test instructions tab

The dashboard's *Additional instructions* field is limited to 500 characters. Leave the username and password empty. This condensed version was submitted:

```text
Needs desktop Chrome 148+, the Eagle desktop app (free trial: eagle.cool) open with a library, and any signed-in Instagram account. Open an Instagram post: a download button appears beside the bookmark (whole post) and top-right on carousels (current item). Click it; a toast reports it was sent to Eagle and the item appears in Eagle with its source link. Also try the profile-grid hover button, the Reel rail button and the Story buttons. The popup sets folder and tags.
```

Fuller notes, for a support reply if a reviewer asks:

```text
Requirements: desktop Chrome 148+, the Eagle desktop app (https://eagle.cool/, free trial) running with any library open, and any signed-in Instagram account. No test credentials are included; the extension works with any account.

1. Start Eagle and open a library. Install the extension; host access is granted at install.
2. Open https://www.instagram.com/ and open any post. A download button appears beside the bookmark (whole post) and, on carousels, at the top-right of the media (current item).
3. Click a button. A toast reports "Sent … to Eagle" with a short chime; the item appears in Eagle with its Instagram source link.
4. On a profile grid, hover a thumbnail and click its download button. On a Reel, use the button between Share and Save. In a Story, use "Current story" or "All available stories".
5. Open the toolbar popup to change the destination folder and tag switches; the next save uses them.

Network: the extension only contacts instagram.com (same-origin lookups) and Eagle's local API at http://127.0.0.1:41595. No developer server, analytics or remote code.
Source (MIT, unminified): https://github.com/karlwang3420/instagram-to-eagle
```

## Review risks

- **Trademark in the name.** The name starts with "Instagram". Chrome's impersonation and trademark policy allows third-party names used descriptively, and AMO accepted this name, but Chrome reviewers can still flag it. If that happens, rename to something like *Save to Eagle for Instagram* in a new version, and keep the "not affiliated" sentence in the description.
- **Unverifiable without Eagle.** A reviewer without Eagle sees only "Eagle is unavailable" in the popup. The test instructions explain that the free trial is required.
- **Instagram's terms.** Download tools for Instagram are common in the store. Because saves only happen when the user clicks, and the description asks users to save only content they may use, this is lower risk than bulk scrapers.

## After approval

1. Replace the README's Chrome "Load unpacked" steps with the Chrome Web Store link.
2. For later versions, upload a new `-chrome.zip` to this same item. The version in `manifest.json` must increase every time.
