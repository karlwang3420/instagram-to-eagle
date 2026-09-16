# Development

[Back to README](../README.md)

## Local setup

The extension uses plain JavaScript, HTML, and CSS with no runtime dependencies or build step. Load the repository's `manifest.json` at `about:debugging#/runtime/this-firefox` in desktop Firefox 140 or newer.

After editing, click **Reload** beside the add-on and reload your Instagram tabs. Keep Eagle running with a library open when testing imports.

## Tests

Run the unit tests with Node.js:

```sh
node --test tests/core.test.cjs tests/stories.test.cjs tests/profile.test.cjs tests/extractor.test.cjs tests/access.test.cjs
```

The Firefox integration runner requires Node 22+, desktop Firefox 153+, and Eagle running:

```sh
node tests/firefox.integration.cjs --inline --binding
```

Focused suites use the same runner:

| Flag | Coverage |
| --- | --- |
| `--public-only` | Setup, permission handling, tag settings, and popup layout |
| `--carousel-only` | Current-item selection in partially mounted carousels |
| `--post-regressions` | Post links, complete-post lookup, and duplicate controls |
| `--profile-only` | Profile controls, settings, and mixed-media imports |
| `--toast-only` | Notifications, dismissal, keyboard access, and narrow layouts |

The runner creates an isolated headless Firefox profile under `work/` and saves screenshots there. It mocks Instagram responses and Eagle import requests, and only reads the running Eagle app's version. Set `FIREFOX_BIN` if Firefox is installed outside the default location.

Passing fixtures do not establish compatibility with every live Instagram layout. For 0.9.2, all 59 unit tests passed. The owner confirmed a fresh Firefox installation and manual testing on September 16, 2026. The Firefox 156 setup/settings suite also passed when run outside the Windows execution sandbox; the earlier `DiscardedBrowsingContextError` did not recur. That suite verifies real permission revocation, but simulates the native approval/denial boundary and mocks Eagle imports. The owner's report is not an agent-observed test of every supported media type or operating system.

## Packaging

After setting a new version in `manifest.json`, run:

```sh
python tools/package_extension.py
```

This creates a runtime-only unsigned XPI and a source ZIP under `dist/`. Existing archives are never overwritten. The tracked 0.9.2 XPI is available for testing; other local archives are ignored by Git.

Use the XPI for Mozilla signing, since it excludes development files and test fixtures. See Mozilla's [signing and distribution guide](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).

## Icons

The original artwork is in `artwork/instagram_to_eagle_icon-source.png`. To regenerate the transparent PNG sizes, install Pillow, NumPy, and SciPy, then run:

```sh
python tools/build_icons.py artwork/instagram_to_eagle_icon-source.png
```

The manifest and popup reference the generated files in `icons/`.

## Source map

| File | Responsibility |
| --- | --- |
| `content.js` | On-page controls, media targeting, and carousel collection |
| `carousel-dom.js` | Carousel structure and slide selection |
| `profile-controls.js` | Profile-grid download controls |
| `extractor.js` | Post metadata and media lookup |
| `stories.js` | Active-account Story lookup and selection |
| `core.js` | Normalized media, metadata, and Eagle payloads |
| `background.js`, `access.js` | Local Eagle bridge and permission checks |
| `popup.*` | Setup, connection status, folders, and tag settings |

Media lookup uses Instagram's page data and on-demand same-origin requests. Story lookup can use the page-side `PolarisInstapi.apiGet` client, with fallback endpoints when unavailable. These undocumented interfaces can change.

The full-post and player-identity approaches were implemented independently after inspecting Turbo Downloader behavior; no Turbo code or assets are bundled. Legacy Story fallbacks reference the [Instagrapi implementation](https://github.com/subzeroid/instagrapi/blob/master/instagrapi/mixins/story.py).

API references: [Eagle imports](https://api.eagle.cool/item/add-from-urls) · [Firefox script injection](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/executeScript).
