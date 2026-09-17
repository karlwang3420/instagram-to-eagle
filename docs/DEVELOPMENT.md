# Development

[Back to README](../README.md)

## Local setup

The extension uses plain JavaScript, HTML, and CSS with no runtime dependencies or build step. Load the repository's `manifest.json` at `about:debugging#/runtime/this-firefox` in desktop Firefox 140 or newer.

After editing, click **Reload** beside the add-on and reload your Instagram tabs. Keep Eagle running with a library open when testing imports.

## Tests

Run every unit and browser suite with Node.js 22+, Python 3.10+, and desktop Firefox 153+:

```sh
node tests/run.cjs
```

Each browser suite starts with an isolated Firefox profile. Instagram and Eagle requests are mocked before the extension is installed; Eagle does not need to be running. The suite never imports into your library. Set `FIREFOX_BIN` for a nonstandard Firefox installation.

For a fast unit-only check:

```sh
node --test tests/unit/*.test.cjs
```

Focused browser suites use `node tests/firefox.integration.cjs` with one of these flags:

| Flag | Coverage |
| --- | --- |
| `--public-only` | Setup, permission handling, tag settings, and popup layout |
| `--carousel-only` | Current-item selection in partially mounted carousels |
| `--post-regressions` | Post links, complete-post lookup, and duplicate controls |
| `--profile-only` | Profile controls, settings, and mixed-media imports |
| `--toast-only` | Notifications, dismissal, keyboard access, and narrow layouts |
| `--detection-only` | Post boundaries, hidden native controls, ownership changes, and cleanup |

The base flow uses `--inline --binding` and also exercises the structural carousel suite. The all-suite command runs that flow plus every focused suite. Screenshots are saved under `work/`; temporary browser profiles are removed after Firefox exits. Import assertions wait for results with bounded timeouts instead of assuming a fixed response time.

Passing fixtures do not establish compatibility with every live Instagram layout. For 0.9.3, all 59 unit tests passed. The owner confirmed a fresh Firefox installation and manual testing of the preceding 0.9.2 on September 16, 2026; live manual testing of 0.9.3 is still needed. The Firefox 156 setup/settings suite also passed when run outside the Windows execution sandbox; the earlier `DiscardedBrowsingContextError` did not recur. That suite verifies real permission revocation, but simulates the native approval/denial boundary and mocks Eagle imports. The owner's report is not an agent-observed test of every supported media type or operating system.

## Packaging

After setting a new version in `manifest.json`, run:

```sh
python tools/package_extension.py
```

This creates a runtime-only unsigned XPI and a source ZIP under `dist/`. Existing archives are never overwritten. The tracked 0.9.4 XPI is a version-only increment of 0.9.3 for public-channel submission; other local archives are ignored by Git. The publisher subsequently reported 0.9.3 working. See [release checks](RELEASE-CHECKS.md) for the archive comparison and linter results.

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
| `content/detection.js` | Shared post ownership, surface classification, and native-control recognition |
| `content/controls.js`, `content/grid-controls.js` | Timeline/player and linked-tile controls |
| `content/ui.js` | Shared notification UI and icon definitions |
| `content/carousel-dom.js` | Carousel structure and slide selection |
| `page/posts.js`, `page/stories.js` | On-demand extraction in Instagram's page context |
| `shared/core.js` | Pure media normalization, metadata, and Eagle payloads |
| `background/index.js`, `background/access.js` | Privileged messaging, import orchestration, Eagle transport, permissions |
| `popup/` | Setup, connection status, folders, and tag settings |
| `tests/unit/`, `tests/browser/` | Pure logic checks and Firefox behavior suites |
| `tests/fixtures/`, `tests/helpers/` | Local page fixtures and browser test infrastructure |

The manifest defines script dependency order. Recovery injection reads that same list, so it cannot silently omit a new content module. `page/posts.js` and `page/stories.js` are serialized into the page with `scripting.executeScript`; keep them self-contained rather than referencing extension globals. Packaging includes nested runtime and test files, with a unit check for missing resources.

Control detection owns the distinction between linked tiles and posts with native action rows. Renderers consume that decision; they do not call each other to determine ownership. Native labels and icon shapes are evidence only within the same post boundary. Hidden controls are rejected, while controls below the viewport remain valid owners.

Media lookup uses Instagram's page data and on-demand same-origin requests. Story lookup can use the page-side `PolarisInstapi.apiGet` client, with fallback endpoints when unavailable. These undocumented interfaces can change.

The full-post and player-identity approaches were implemented independently after inspecting Turbo Downloader behavior; no Turbo code or assets are bundled. Legacy Story fallbacks reference the [Instagrapi implementation](https://github.com/subzeroid/instagrapi/blob/master/instagrapi/mixins/story.py).

API references: [Eagle imports](https://api.eagle.cool/item/add-from-urls) · [Firefox script injection](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/executeScript).
