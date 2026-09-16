# Instagram to Eagle — Firefox add-on

Save timeline images and videos, complete mixed-media posts, profile-grid posts, Reels, and Stories directly into your running Eagle library.

## Install for personal testing

1. Keep Eagle running with a library open. Use desktop Firefox 140 or newer.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **Load Temporary Add-on…** and select this folder's `manifest.json`, or the provided `instagram-to-eagle-0.9.2-unsigned.xpi`.
4. The setup page opens after installation. If access is missing, click **Allow access** and approve Firefox’s permission prompt for Instagram and Eagle on this computer. Declining keeps imports disabled until the required access is granted.
5. Keep Eagle running and reload existing Instagram tabs. Use the on-page download buttons. The extension popup contains the folder selector and tag switches.

Firefox removes temporary add-ons at restart. For a normal persistent installation, submit the source archive to Mozilla for an **unlisted, signed** add-on, then install the signed XPI. The supplied XPI is unsigned and cannot be installed permanently in standard Firefox.

The XPI contains only runtime files; the source ZIP retains the tests and documentation. Upload the XPI for signing to avoid warnings about the test fixture's inline script.

Mozilla's installation instructions: https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/
Signing and self-distribution: https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/

## Version 0.9.2

- Replaces the extension and popup SVG icon with transparent PNG sizes derived from the supplied Instagram-to-Eagle artwork. Download behavior is unchanged.
- Includes a fresh unsigned XPI for temporary Firefox testing and a source ZIP with the original artwork and icon-generation script.

## Version 0.9.1

- Reorders the menu switches to Default tags, Post hashtags, Creator without changing saved values.
- Fixes individual-video selection in mixed timeline carousels with a virtualized slide window. At click time the exact media element/source is marked; the extractor captures its nearest React player media ID or compound key before awaiting metadata. Returned IDs must resolve to the same video child in the selected post; unknown/conflicting IDs fail closed. This independently uses the player-identity approach observed in Turbo, without copying its implementation.
- Player identity and direct-file/unique-poster matching take precedence over relative DOM positions. Blob videos with no poster can resolve through their media ID. Complete-post and existing ambiguous-video safeguards remain.
- Native Firefox fixture using the reported shortcode `DdWVJNUk2Q1` reproduces the exact position error with v0.9.0, then verifies the correct first/eighth video from an eight-item mixed post with only two mounted slides. Unit tests cover conflicting IDs, changed players and identity capture before asynchronous metadata changes. Instagram/media responses and Eagle imports are mocked; the user's signed-in live post was not inspected.

## Version 0.9.0

- Adds first-install setup with explicit Instagram and local Eagle permission status. One click requests the declared host permissions through Firefox; access is never granted silently by extension code. Missing/revoked grants show an action badge, and the local bridge checks permission before every API request to prevent misleading import errors. Updates open setup only when grants are missing.
- Polished original SVG app icon, clearer stacked-media batch icon, and a compact cream/forest menu designed using the frontend-design skill. On-page control placement and existing download targeting are unchanged.
- Replaces extra tags with three independent switches: caption hashtags, creator (`@username`), and default tags (`Instagram`, plus `Story` or `Reel` where applicable). All default on. Switching all off sends no tags. Preferences apply to future saves only. Legacy extra tags remain in local storage but are no longer added to imports.
- Folder preferences remain intact when Eagle is offline. Tag controls write only the changed field; missing folders still require choosing another destination.
- Unit tests cover all eight tag combinations across post/Reel/Story payloads, permission guards, install/update behavior, and settings-page message isolation. Firefox tests cover actual permission revocation, no POST without a grant, preferences across reopening, and menu layout. Native permission approval/denial is simulated at that boundary because Firefox BiDi cannot click privileged extension pages. **Before public release, manually verify a fresh signed install and the Allow access confirmation in normal Firefox.** Existing download regressions use mocked imports and do not modify the Eagle library.

## Version 0.8.8

- Current-image downloads no longer treat the timeline's mounted slides or pagination dots as a verified full-post position. A shortened timeline window cannot reject the selected image or substitute the image at that relative index.
- Match the clicked image against all exposed image renditions, then use the matched full-resolution file. If the mapping is unavailable or ambiguous, save the visible image's highest exposed srcset URL without inventing a slide number. Video ambiguity checks, whole-post completeness checks and button placement are unchanged.
- Added unit and native Firefox regressions for windowed dots, virtualized timeline slides, rendition matching and unmatched visible files. The old version reproduces the reported error in the Firefox fixture; the new version saves the correct eighth image while only two slides are mounted. Eagle imports are mocked; the supplied signed-in live timeline was not inspected.
- Run `node tests/firefox.integration.cjs --carousel-only` for these cases. Retained the extended-link and duplicate-control fixes from previous versions.

## Version 0.8.7

- Fixes extended Instagram post links: strip their 28-character suffix only for media-ID conversion, REST/Relay lookup and response matching. Keep the original link in Eagle and leave button placement unchanged.
- The reported 39-character code resolves to canonical shortcode `Cml1XsiSDMV` and media ID `3001039451545154325`. Version 0.8.6 decoded the suffix as part of the ID and sent it in the full-post query, so valid returned posts did not match.
- Native Firefox regression reproduces the old wrong-ID request using the supplied URL, then verifies the corrected REST and Relay paths, mixed-media import, unchanged source link and no duplicate controls. Test responses and Eagle imports are mocked; no signed-in live download is claimed.

## Version 0.8.6

- Profile/post imports now request Instagram's native full-post Relay query if the initial metadata response has missing image/video files. The selected shortcode is fixed at click time; results must match its identity and retain the known carousel size. This independently implements the fallback approach observed in the installed Turbo extension, without copying its implementation or adding tracking.
- Complete first responses need no second query. Preview remains read-only with no requests. HTTP 401/403/429 stop rather than trying another endpoint. Missing/partial media still fails closed.
- One native bookmark row now has one download-control owner. Large comment GIFs in a nested sidebar no longer create a second bottom download button. Carousel current-media and all-media controls remain.
- Added a Firefox regression that reproduces two bottom buttons in 0.8.5 and verifies one after the patch, plus a lone-icon grid regression that imports full image/video files through the fallback. These use controlled Instagram responses and mocked Eagle imports; the user's signed-in live profile was not verified.
- Run `node tests/firefox.integration.cjs --post-regressions` for these focused cases.

## Version 0.8.5

- Removed profile-wide Download All and its background feed/pagination worker.
- Removed the Firefox right-click menu and menus permission.
- Downloads are on-page only. The popup now contains Eagle connection, destination folder and tag settings; it no longer requires hovering or selecting a post.
- Kept profile tile, carousel all-media, single-post, Reel and Story controls. This update does not claim to fix unresolved media on specific profile tiles.
- Older release notes below describe historical behavior, not features available in this version.

## Use

- Single-image and single-video timeline posts have one plain download icon beside the bookmark in the bottom action row. Carousels have a circle at the media's top-right for the current image/video and an all-media icon beside the bookmark. The batch action includes both images and videos, in carousel order. Hover or focus an icon for its label.
- On profile grids (Posts, Reels, and Tagged), hover a thumbnail to reveal its download icon below the native hover stats. It saves that entire post, including every carousel image/video, without opening it. Keyboard focus reveals the button too; touch layouts keep it visible.
- Reels in the player have a white download icon near the top-right playback controls. Reels shown as single-video feed posts with a bookmark use the bottom button.
- Stories have two white icons near the top-right playback controls: **Current story** and **All available stories from this account**. Both image and video stories are supported. Batch import requires a verified complete list for the selected account; it refuses incomplete lists or stories without direct media files. Both `/stories/username/` first-entry URLs and `/stories/username/story-id/` viewers are supported; Highlights and archives are not.
- Version 0.6 inserts the buttons into Instagram's existing bookmark/playback rows as actual DOM children. They move and resize with those rows, without fixed viewport coordinates. The carousel's current-item circle is anchored inside its media frame. If a native row cannot be identified, the fallback stays inside the selected player/post rather than floating over the browser viewport.
- If the native bookmark control cannot be identified, the all-media icon appears right-aligned directly beneath the media. No green button bars are inserted. The icon colors follow the post's text color, and controls track the media/action row while scrolling.
- Version 0.3 also fixes off-screen images being mislabeled as videos, consolidates nested wrappers into one post owner, and removes orphan/duplicate controls after layout updates. The current carousel slide stays identifiable even after scrolling it outside the browser viewport.
- Updating: reload the add-on in `about:debugging`, then reload Instagram. If you loaded an XPI, load the new 0.9.2 XPI; reloading the old package does not update it. For an already signed installation, submit the new version under the same Mozilla add-on entry and install its signed XPI.
- **Current image** sends the image on the visible carousel slide.
- **All post media** sends every image and video in carousel order. Missing media causes that post to fail rather than silently skipping files.
- **Save video** sends the current timeline video. It resolves a direct file from the selected post data, including behind a blob player; ambiguous video slides are rejected rather than importing the wrong one.
- On a Reel, choose **Save Reel**. This resolves a direct video file when Instagram exposes one, including its embedded audio.
- **Save to / Automatic tags** selects an existing Eagle folder and whether to include hashtags, the creator’s @username, and default Instagram/Story/Reel tags. These settings apply to every import action, including profile hover. The default destination is Unfiled.

Imports go through Eagle's local API at `http://127.0.0.1:41595`. No download-folder step and no additional Eagle plugin are required. The Eagle skill's optional MCP plugin is used only during development; the add-on uses Eagle's built-in HTTP API.

“Sent to Eagle” means Eagle accepted the import request. Check Eagle for completion or a download failure; its batch API does not return per-file completion status. If a request times out, check Eagle before retrying because the request may already have been accepted.

## Metadata retained

| Eagle field | Captured information |
|---|---|
| Name | Author, first caption line, carousel index when known |
| Website | Canonical post, Reel or individual Story URL, without tracking parameters |
| Tags | Optional default Instagram/Story/Reel tags, creator @username, and caption hashtags; all three groups default on |
| Annotation | Left blank |

Version 0.4 keeps new imports concise: a short title, source URL and automatic tags, without a detailed description or JSON dump. The title uses up to 90 characters of the first caption line, or the post shortcode when a caption is unavailable. Eagle handles file information such as dimensions, size and format. Previously imported items are unchanged.

Titles and hashtags depend on what Instagram makes available to your session. Signed CDN media URLs may expire, while the source post URL remains usable.

## How extraction works

The content script identifies the selected post and clips media visibility against carousel containers. A short, on-demand MAIN-world script reads the matching post's embedded/React data. On import it also attempts one read-only, same-origin Instagram media-info request with your existing browser session to obtain complete caption and media data. The extension never copies login cookies into Eagle or its settings.

For a carousel whose complete post data is unavailable, it walks the selected post's previous/next controls, collects visible slides, and attempts to return to the original slide. Leave that post in view during collection. If the carousel cannot be verified, the add-on reports an error instead of silently sending a partial batch. It recognizes English and several common localized carousel button labels; layouts with different labels may require opening the post directly.

Videos that expose only segmented DASH/HLS or blob video without a direct MP4 are unsupported in this version. The add-on reports that limitation rather than saving a thumbnail or a known video fragment. Instagram changes its internal endpoint and layout, so a live post can require extractor updates even when local tests pass.

Stories are selected using the active account's header and playback controls, not the largest image on the page. This keeps letterboxed videos separate from larger neighboring-account previews. Story extraction checks React props and state, including GraphQL video resources and media IDs on the selected player's nearest React fibers. On save, when local data is insufficient, it tries Instagram's page-side `PolarisInstapi.apiGet` client with fixed read-only `reels_tray` and `reels_media` endpoints. This lets Instagram manage its own session headers and can resolve a direct video URL behind a blob player. Only the selected account's media is accepted. Requests time out, with same-origin profile/reels-media/account-story/GraphQL fallbacks if the page client is unavailable. It does not navigate through stories, mark stories seen via an API, or access expired/unavailable stories. These are undocumented Instagram interfaces and can change. The page-client approach was independently implemented after inspecting the user's installed Turbo Downloader 4.12.16; legacy fallbacks reference the [Instagrapi implementation](https://github.com/subzeroid/instagrapi/blob/master/instagrapi/mixins/story.py). A source Story link can stop working after the story expires. An unresolved file reports lookup failures rather than asserting that the story is streaming-only.

## Permissions and privacy

- **Instagram access:** identify posts and media on Instagram tabs. Requests are made on save; no background feed scraping.
- **127.0.0.1 access:** communicate with Eagle. Firefox match patterns cannot restrict ports; the code hardcodes port 41595 and the extension CSP limits connections to that port.
- **Scripting / activeTab:** post extraction. There is no menus permission or right-click menu.
- **Storage:** selected Eagle folder ID and three tag preferences. Legacy extra-tag settings may remain locally but are unused.

Firefox users remain in control of grants. The [Mozilla host-permission guidance](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/host_permissions) recommends checking access after installation and offering an explanation before requesting missing permissions. The request is made directly in the Allow access click handler.

No analytics, external backend, remote scripts, or third-party downloader service. Only extension UI actions can trigger the local Eagle import bridge. In-post controls live in a closed shadow root, require trusted user clicks, and send one-use selection markers; the webpage cannot submit arbitrary download URLs. Media URLs must be HTTPS URLs on Instagram/Meta media domains. Webpage scripts are treated as untrusted data.

## Development and validation

No build step or runtime dependencies. Edit the JavaScript/CSS files, then click Reload beside the add-on in `about:debugging`.

The extension and popup icons use transparent PNGs in `icons/`, derived from `artwork/instagram_to_eagle_icon-source.png`. To regenerate the 16, 32, 48, 96, and 128 px files after changing the artwork, run `python tools/build_icons.py artwork/instagram_to_eagle_icon-source.png` with Pillow, NumPy, and SciPy installed. Existing archives in `dist/` are historical packages and do not include later icon edits.

Run the included normalization tests with Node.js:

```sh
node --test tests/core.test.cjs tests/stories.test.cjs tests/profile.test.cjs tests/extractor.test.cjs tests/access.test.cjs
```

Run native Firefox integration checks (Node 22+, desktop Firefox 153+, and Eagle running):

```sh
node tests/firefox.integration.cjs --inline --binding
```

Run `node tests/firefox.integration.cjs --public-only` for first-run setup, revoked access, simulated approval/denial, tag persistence and layout screenshots. A native Firefox confirmation still needs manual verification before public distribution.

Run the focused notification checks with `node tests/firefox.integration.cjs --toast-only`. They cover layout, dismissal timing, replacement, hover/focus pause, keyboard/mouse dismissal, narrow screens and plain-text safety, and save notification screenshots under `work/`.

Run `node tests/firefox.integration.cjs --profile-only` for trusted hover interactions, absence of bulk controls, settings-only popup, mixed media, concise metadata, lazy tile insertion, cloned controls, and route cleanup. These use controlled fixtures and mock all Eagle imports.

The integration runner opens an isolated headless Firefox profile under `work/`, mocks the Instagram feed and all Eagle import requests, and exercises real trusted mouse clicks. It only reads the running Eagle app's version. Set `FIREFOX_BIN` if Firefox is installed outside its default location. Test profiles and a screenshot remain under `work/` for inspection; the runner does not touch your normal Firefox profile.

Validation performed: native Firefox temporary installation; the extension's read-only connection to the running Eagle API; current-image selection; mixed image/video carousel import; neighboring-post isolation; carousel restoration; direct-video Reel extraction; metadata/URL validation. Instagram feed and media responses were controlled test fixtures, and Eagle import requests were mocked so test assets were not added to the library. A logged-in live Instagram post has not yet been validated.

Version 0.2 regression checks additionally cover div-based image posts without article elements, exactly one inline toolbar per post, new posts appearing during scrolling, removal/re-rendering, and trusted clicks on Current image, All images, and Save Reel. All import requests in these tests are mocked.

Version 0.3 adds regressions for a photo entirely outside the viewport, hidden/preloaded video layers, real video slides, nested duplicate permalinks, stale controls, and post wrapper changes. The checks assert one media control per post, the circle's exact top-right position, the all-images icon's alignment beside the bookmark, scrolling alignment, and successful trusted clicks on both controls.

Version 0.5 checks cover bottom-only single-image/video controls, trusted timeline video clicks, top-right Reel and Stories controls, image/video Story batches with per-item source URLs, account isolation, refusal of incomplete batches, same-origin Stories fallback, and Story navigation. Imports remain mocked; these are controlled Firefox fixtures, not validation against a logged-in live Instagram session.

Version 0.6 checks add DOM row membership, absence of fixed-position download controls, native row replacement, resize handling, a letterboxed active Story beside a larger neighboring preview, React-state video resources, and account-story fallback when legacy GraphQL is unavailable. Live Instagram still needs verification after reloading the update.

Version 0.6.1 prevents the bookmark from being pushed onto another line in two-column action grids. The action row stays unwrapped, its left action group can shrink, and the original bookmark element and handlers remain intact. Regression checks cover 460px, 340px, and 280px action-row widths, including baseline alignment, row height, and non-overlapping controls.

Version 0.6.2 handles delayed first-entry Story rendering: playback labels, roles, visibility, image variants, video readiness, and animation completion trigger a rescan. A bounded 15-second entry retry covers CSS-only reveals and stops once controls are mounted. Returning to the viewer/tab re-arms readiness checks. Own control mutations are ignored to prevent refresh loops. Firefox regressions verify initial delayed labels/visibility and CSS-only re-entry without forward/back clicks or a Story URL change.

Version 0.6.3 fixes the username-only route that was previously excluded before any loading retry could help. Controls mount without a numeric Story ID. The selected Story is matched by its visible media URL/poster or the captured media element's unambiguous React data; a verified single-item account is also unambiguous. It never assumes that the account list's first item is visible. All-stories import uses the verified account list and gives each file its own Story URL. If an exact ID cannot be resolved but the captured media already has a direct URL, the current-item fallback preserves the username-only viewer URL; ambiguous blob players fail safely. Tests use `/stories/hori_hayung/` unchanged while saving the visible second image, a selected video, and the account batch.

Version 0.6.4 adds the page-side Story API lookup and ID-only player recognition. Current-story imports never default to the first API item. Conflicting identities are rejected; the captured identity is retained if autoplay advances during a request. Tests cover module failure, request timeout, wrong accounts, incomplete batches, previews without network calls, and ambiguous players. Native Firefox tests exercise trusted current/batch button clicks through a mocked page client, including the third item on a username-only URL and autoplay during lookup. These are regression fixtures, not proof that every live Instagram layout works.

Version 0.6.5 preserves carousel controls on the last slide, even when Next disappears and Back becomes unlabeled. A bounded in-tab cache remembers carousel status by post shortcode, surviving wrapper replacements without misclassifying a different post that reuses the same DOM node. Hidden/disabled arrows and additional previous/next labels are recognized. Nested video articles sharing the post permalink resolve to the shared post owner, avoiding duplicate control pairs on mixed image/video carousels. The top icon still saves the current image/video; the bottom batch action still saves all images (not videos). Tests cover actual current/batch clicks at the last slide, wrapper replacement, mixed-media nesting, localized back controls, and reused wrappers changing to single-image/video posts.

Version 0.7.0 replaces the arrow/status-cache approach with a structural carousel adapter, independently implemented after inspecting Turbo Downloader's slide-container, pagination-dot, and bookmark binding approach. `carousel-dom.js` identifies a slide track and its pagination inside the selected post. Each mounted slide container owns its own overlay; the selected slide's overlay is shown while off-slide controls remain hidden. One batch control belongs to the native bookmark action row, identified by the bookmark control rather than row dimensions. Unwrapped legacy tracks use a single frame overlay as a compatibility fallback.

The click snapshot supplies the full one-based slide index and count to the media selector. This resolves multiple blob videos even with identical posters, and selects the original image variant. A virtualized DOM containing only one or two slides uses the full pagination index, not the shortened DOM position. Mismatched pagination/track state, incompatible metadata counts, and ambiguous shared posters are rejected instead of selecting the first matching video. This removes the previous remembered-carousel cache entirely. Stories/Reels and the all-images (images only) action retain their existing behavior.

Native Firefox regressions cover first entry directly on the last slide with no arrows, per-slide DOM anchors, image/video changes, two videos sharing a poster, virtualized one/two-slide lists, a mid-transition mismatch, a label-free bookmark icon, and a full post replacement. Tests use controlled Instagram layouts and mocked Eagle imports; live Instagram variations still require user verification.

Key files: `carousel-dom.js` (structural carousel model), `content.js` (targeting, inline controls, and carousel walk), `extractor.js` (Instagram post data), `stories.js` (selected-account Stories data), `core.js` (metadata and Eagle payload), `background.js` (local API bridge), and `popup.*` (toolbar UI).

Version 0.7.1 replaces large colored bottom-left messages with compact, dark bottom-right notifications. Success/error icons use subtle green/coral accents; messages dismiss after 3/8 seconds, pause on hover or keyboard focus, and have an accessible close button. Only one notification is displayed at a time. Text wraps on narrow screens and is announced politely without stealing focus. Reduced-motion preferences are respected. No download or metadata behavior changed.

Version 0.8.0 independently implements profile-hover and whole-profile controls after inspecting the installed Turbo Downloader 4.12.16 behavior. No Turbo source, stylesheets, icons or telemetry are bundled. `profile-controls.js` owns trusted one-use actions and profile UI; `profile-data.js` performs on-demand page-side read-only pagination using Instagram's own client (or same-origin fetch when unavailable); `profile-jobs.js` sends validated posts to Eagle sequentially with progress/cancellation. Session data never crosses to Eagle. Profile requests use undocumented Instagram APIs, so live account/layout variations still need verification. Existing carousel batch controls, popup and context menu now include videos as well as images. Historical version notes above describe previous behavior.

Version 0.8.1 corrects the profile reader to use a same-origin GET to the username feed endpoint, using the page's current app ID and WWW claim when available. Those headers remain in the page and are never returned to the extension or Eagle. Failures return a plain error envelope, and the background also handles Firefox's `InjectionResult.error`, so authentication, rate-limit, malformed-response and network errors no longer disappear behind a generic verification message. No-import failures clearly say that nothing was sent; uncertainty warnings remain for attempted Eagle writes. Unknown pagination still fails closed.

The profile icon is now a custom element anchored to the actual thumbnail's existing containing block, rather than changing the post link's positioning. Instagram's stats overlay and link styles are not patched. Geometry follows thumbnail resizing and scaled ancestors. New Firefox regressions cover wide static links, unchanged native stats, exact icon centering, resize/transforms, and a real MAIN-world API error reaching the toast. These remain controlled tests, not proof of compatibility with every live Instagram profile.

Version 0.8.2 moves whole-profile requests into Firefox's isolated content-script world, using native fetch rather than the site's potentially wrapped fetch. It obtains Instagram's app ID/current WWW claim on demand in MAIN, with the site's own `www-claim-v2` storage key as a fallback. No claim is fabricated. These headers pass transiently through extension memory but are never logged, persisted or included in Eagle payloads. The first page verifies the account before fetching its feed; pagination uses the same isolated transport. The connection policy explicitly allows the two supported Instagram origins. Requests are fixed same-origin GETs and refuse redirects; no arbitrary URL proxy or additional permission was added. Timeouts, HTTP errors and pre-response transport failures identify whether account lookup or the feed failed.

Profile icons now mount inside Instagram's native `._aajz` hover overlay when available, using its percentage-based layout instead of thumbnail coordinates. This follows the full tile across letterboxing and layout changes. A thumbnail-bound compatibility fallback remains when that native surface is absent; Instagram's link and stats styles are untouched. Native Firefox tests exercise actual fetch/network interception (not a mocked page fetch), including a deliberately broken page fetch, account lookup, request headers, pagination, 429 errors, cancellation, and overlay creation/replacement/removal. Eagle imports are mocked. The reported live @pyoapple transport failure has not been reproduced in a signed-in session, so this release still needs a live retry; passing fixtures are not proof of that account's compatibility.

Version 0.8.3 removes the redundant account-lookup preflight; the existing per-page feed owner verification remains mandatory, including for empty feeds. This reduces requests; it does not bypass or promise to clear Instagram rate limits. A 429 stops immediately and persists a bulk-request cooldown across add-on restarts and profiles. The cooldown honors `Retry-After` (seconds or HTTP date), or uses a conservative 15-minute local pause when absent; expiration is not a guarantee that the server will accept a retry. No automatic retries or alternate-endpoint retries are made. Subsequent feed pages are spaced by at least three seconds plus processing time.

Profile hover controls now use one stable tile anchor at horizontal center/70% height, independent of full-tile, partial or absent native hover overlays. Native link/stats styles remain untouched. Pointer hit-testing refreshes visibility on scrolling and layout changes; mouse focus does not leave an icon behind, while keyboard focus still reveals it. The user's @mikoqqii lone-icon report happens before any click, so retained focus is NOT established as its cause. That profile-specific native-overlay discrepancy remains unverified until a real layout report is available.

Version 0.8.4 fixes the diagnostic access dead end: profile pages get a compact profile popup instead of the timeline's misleading “Hover a post” error and disabled actions. Diagnostics are open and populated automatically, above the other settings. With no hover remembered, the report captures up to four currently visible grid tiles; with a remembered hover on the same route, it preserves that snapshot too. No hovering is required. Open the affected profile with posts visible, open the add-on popup, click **Select diagnostic report (Ctrl+C)**, then copy and paste into the support conversation. A native Firefox regression opens the popup before any hover and verifies a ready visible-grid report, no timeline error, and controls within the first 400 pixels.

Reports contain tags, class names, computed layout styles, bounding boxes, hover flags, pseudo-element presence and viewport size. They omit DOM text, IDs, URL attributes, media sources, cookies and session data. Snapshots remain in memory, never uploaded automatically or saved in extension storage. Fixture tests cover the report's privacy boundary, but cannot certify the live @mikoqqii layout or clear an active Instagram limit.

This version also fixes a separately reproduced extractor serialization bug: shared media objects were treated as circular references and discarded from later carousel entries. Serialization now removes true ancestor cycles only and retains shared sibling media objects. Two regressions verify complete whole-post imports and actual cyclic references. This is not yet established as the cause of the user's live @mikoqqii failure. The reported bulk feed transport failure and native hover-overlay discrepancy remain unresolved; this release does not change request redirects or claim to fix them.

API references: https://api.eagle.cool/item/add-from-urls and https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/executeScript
