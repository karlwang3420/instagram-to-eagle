# Publication checks — 1.0.5 (Firefox)

Version-only Firefox rebuild of 1.0.4.

## Submission status (October 4, 2026)

Both browsers have been submitted for public release. Neither is approved yet.

| Store | Version | Status |
| --- | --- | --- |
| Firefox (AMO) | 1.0.5 | Submitted to the existing entry (**On this site**, ID `instagram-to-eagle@local.karl`); awaiting review |
| Chrome Web Store | 1.0.4 | Submitted as a new public item `kcbhpiojkhdfflhoepkonoobinkdkhpo`; pending review, set to publish automatically once approved |

Chrome stays on 1.0.4; its runtime is identical to 1.0.5 apart from the version number. Do not upload the 1.0.5 Chrome ZIP unless a new Chrome version is needed.

- Firefox: `dist/instagram-to-eagle-1.0.5-unsigned.xpi`. Upload to the existing AMO entry with **On this site** selected, keeping ID `instagram-to-eagle@local.karl`. Reviewer source: `dist/instagram-to-eagle-1.0.5-amo-source.zip`.
- All 21 runtime members except `manifest.json` are byte-identical to the 1.0.4 XPI, and in the manifest only `version` changed (1.0.4 → 1.0.5).
- `node tests/run.cjs` on Firefox 157.0: all 65 unit tests and all seven Firefox browser suites passed with the 1.0.5 manifest.
- Mozilla Add-ons Linter 10.8.0 on the 1.0.5 runtime files: zero errors, zero notices, and the same four warnings documented for 1.0.3 (the inherited Android minimum version, plus three for Chrome's `offscreen` API in shared background code, which Firefox never reaches).
- Local fixtures and mocked imports only; no live Instagram or Eagle testing, signing, or AMO approval is claimed.

## Publication checks — 1.0.4

Prepared for public Firefox and first-time Chrome Web Store submission. **Not submitted, signed, or store-approved** by this release preparation.

## Changes from 1.0.3

- Removed the unused `activeTab` permission from both manifests. Host permissions already cover every tab the extension operates on, and no code path relied on `activeTab`.
- Setup/permission text says "your browser" instead of "Firefox", so the Chrome build no longer shows Firefox-specific wording.
- Added Chrome Web Store materials: [CHROME-WEB-STORE.md](CHROME-WEB-STORE.md) and [store-assets/chrome/](store-assets/chrome/). The privacy policy now covers Chrome and version 1.0.4+.

## Release artifacts

- Chrome: `dist/instagram-to-eagle-1.0.4-chrome.zip`. Upload as a **new** Chrome Web Store item. Permissions: `scripting`, `storage`, `offscreen`. Hosts: Instagram and `127.0.0.1`.
- Firefox: `dist/instagram-to-eagle-1.0.4-unsigned.xpi`. Upload to the existing AMO entry with **On this site** selected, keeping ID `instagram-to-eagle@local.karl`.
- Source: `dist/instagram-to-eagle-1.0.4-source.zip`. Run `python tools/prepare_amo.py` for the AMO reviewer source and bundle.

## Validation evidence

- `node tests/run.cjs` on Firefox 157.0: all 65 unit tests and all seven Firefox browser suites passed with the 1.0.4 manifest.
- Chrome for Testing 153.0.8010.12 smoke test of the generated 1.0.4 Chrome build: the service worker initialized with an empty access badge, so host access was granted without `activeTab`. Setup showed granted access and mocked Eagle status. A trusted click on a content control sent the selected carousel image through the worker to a mocked Eagle import, and the success chime created its offscreen document. Audible output was not verified.
- The store screenshots were captured from the same unpacked 1.0.4 build, with real injected controls on mock Instagram pages. They also exercise a whole-carousel import, the profile-grid hover control, Reel rail placement, Story controls, and the popup's nested-folder list, all against mocked Eagle data.

These checks use local fixtures and mocked imports, not a live Instagram account or real Eagle downloads. No store validation, signing, approval, or live cross-browser testing is claimed.

## Historical publication checks — 1.0.3

Prepared for public Firefox and Chrome submission; **not submitted, signed, or store-approved** by this release preparation.

## Release artifacts

- Firefox: `dist/instagram-to-eagle-1.0.3-unsigned.xpi` — upload to the existing AMO entry with **On this site** selected. Desktop Firefox only; keep the existing ID `instagram-to-eagle@local.karl`.
- Chrome: `dist/instagram-to-eagle-1.0.3-chrome.zip` — upload to the existing Chrome Web Store entry. Declares `minimum_chrome_version: "148"` for the native `browser` namespace and Promise-returning message listeners. Uses a generated MV3 service worker and the `offscreen` permission for the chime.
- Source: `dist/instagram-to-eagle-1.0.3-source.zip`.
- AMO reviewer source: `dist/instagram-to-eagle-1.0.3-amo-source.zip` — includes per-file hashes and reproduction instructions.
- AMO materials bundle: `dist/instagram-to-eagle-1.0.3-amo-submission.zip` — convenience bundle, not an extension upload.

## Validation evidence

- `node tests/run.cjs`: all 64 original unit tests and all seven Firefox browser suites passed on Firefox 157.0 for version 1.0.3. After adding the Chrome minimum-version declaration, all 65 unit tests passed, including the new generated-manifest regression; Firefox runtime code is unchanged.
- Packaged Firefox runtime: Reel and notification suites passed using an XPI; the final XPI has identical runtime member bytes to that tested archive.
- Reel measurements: zero idle control DOM writes per second, nine refreshes during one second of animation, and zero refreshes in a background tab.
- Chrome for Testing 153.0.8010.12: the generated package loaded as an unpacked extension; the service worker initialized, setup showed granted access and mocked Eagle status, and a trusted content-control click sent the selected carousel image through the worker to a mocked Eagle import. The success chime created its offscreen audio document; audible output was not verified.
- Mozilla Add-ons Linter 10.13.0: zero errors, zero notices, four warnings. One is the inherited Android minimum-version/data-consent warning. Three flag Chrome's `offscreen` APIs in shared background code; Firefox's DOM `Audio` path returns before those calls. The Firefox notification suite verifies that sound path.
- Packaging verifies archive integrity, runtime/source member contents, browser manifest differences, and reviewer-source reconstruction before pushing.

These checks use local fixtures and mocked imports, not a live Instagram account or real Eagle downloads. The Chrome smoke check is not equivalent to the full Firefox suite and does not establish compatibility with older Chrome releases. No store validation, signing, approval, live/manual cross-browser testing, or determination of Mozilla's local-export data exception is claimed. Review listing content/screenshots, privacy disclosures, and account requirements before submission.

## Historical publication checks — 0.9.4

## Public-channel package

- File: `dist/instagram-to-eagle-0.9.4-unsigned.xpi`
- Size: 84,833 bytes
- SHA-256: `d9410bdddf8d6d050512192a177df631644895cad1b38e36334c56442d96d4c2`
- Compared both archives: all 17 non-manifest members are byte-identical to 0.9.3; the manifest differs only in `version` (0.9.3 → 0.9.4).
- Mozilla Add-ons Linter 10.8.0: zero errors, zero notices, the same one Android warning documented below.
- The publisher reported 0.9.3 working after testing. The screenshot shows 0.9.3 approved, but does not establish public availability.
- Unit/browser suites were not repeated for this version-only increment; their preceding results follow below. No claim of manual testing of 0.9.4 is made.
- Upload 0.9.4 through the existing entry with **On this site** selected. Do not create a new add-on or reuse the already submitted 0.9.3 version number.

## Previous implementation checks — 0.9.3

Checked September 16, 2026. This records preparation and test evidence, not Mozilla approval.

## Reviewed artifact

- File: `dist/instagram-to-eagle-0.9.3-unsigned.xpi`
- Size: 84,833 bytes
- Extension ID: `instagram-to-eagle@local.karl`
- Version: `0.9.3`
- SHA-256: `e6b4cde8de7cf149406e621e3387b9272a31667cc9bb0d0d55cc313615408e9b`

This new package simplifies the popup/setup copy and layout, increments the version, and includes the MIT license. Media extraction and import logic are unchanged. The original 0.9.2 XPI has not been replaced.

## Evidence

| Check | Result |
| --- | --- |
| Publisher's manual testing | Fresh install/testing reported for 0.9.2; subsequently reported 0.9.3 working; exact media cases were not enumerated |
| Unit tests | 59 passed after the 0.9.3 popup changes |
| Firefox setup/settings suite | Passed in Firefox 156.0 outside the Windows execution sandbox |
| Permission coverage | Real revocation blocks imports; native approval/denial is simulated in the automated suite |
| Test imports | Mocked; the automated run did not add test items to the real Eagle library |
| Mozilla Add-ons Linter | 10.8.0: zero errors, zero notices, one warning |
| Screenshots | Actual 0.9.3 DOM/CSS rendered by the test fixture; example folder/connection data |
| Reviewer source reconstruction | All 18 runtime members reproduced byte-for-byte; the submission bundle contains the same validated 0.9.3 XPI |

The linter warning is `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`: the inherited Android minimum of 140 predates data-consent support in Android 142. This extension requires desktop Eagle and is not intended for Android. Do not select Android for this submission. The warning is recorded; the desktop-only release retains the previous minimum-version declaration. If Mozilla requires a manifest adjustment, make it in a new version and test that artifact.

The earlier `DiscardedBrowsingContextError` did not recur outside the execution sandbox. The passing run does not establish live compatibility with every Instagram layout or with untested operating systems.

## Remaining submission matters

- Upload the version-only 0.9.4 package to the existing add-on entry under **On this site**.
- Set English (US) as the listing's default locale and save the prepared content.
- Select MIT in AMO and link or paste the privacy policy.
- Verify the existing entry's distribution channel and public-listing status.
- Supply a test account privately if needed for review; no credentials are included in these files.
- Disclose the current `none` data declaration and local Eagle export as described in the reviewer notes. The linter does not decide whether Mozilla's local-backup exception applies.

## Reproducing the checks

Unit and browser commands are documented in [DEVELOPMENT.md](DEVELOPMENT.md). The runtime XPI was passed directly to Mozilla's `addons-linter` with JSON output. Use a current Mozilla linter when preparing a later release; AMO may use a different validator version.

Run `python tools/prepare_amo.py` to create the submission bundle and matching reviewer source archive without replacing the tested XPI. The source archive includes its original runtime file hashes and instructions to rebuild those members for review.
