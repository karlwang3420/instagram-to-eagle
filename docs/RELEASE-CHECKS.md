# Publication checks — 0.9.3

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
| Publisher's fresh install and manual testing | Confirmed by the publisher for 0.9.2 only; live manual retesting of 0.9.3 remains |
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

- Manually retest 0.9.3 on live Instagram, then upload it to the existing add-on entry.
- Set English (US) as the listing's default locale and save the prepared content.
- Select MIT in AMO and link or paste the privacy policy.
- Verify the existing entry's distribution channel and public-listing status.
- Supply a test account privately if needed for review; no credentials are included in these files.
- Disclose the current `none` data declaration and local Eagle export as described in the reviewer notes. The linter does not decide whether Mozilla's local-backup exception applies.

## Reproducing the checks

Unit and browser commands are documented in [DEVELOPMENT.md](DEVELOPMENT.md). The runtime XPI was passed directly to Mozilla's `addons-linter` with JSON output. Use a current Mozilla linter when preparing a later release; AMO may use a different validator version.

Run `python tools/prepare_amo.py` to create the submission bundle and matching reviewer source archive without replacing the tested XPI. The source archive includes its original runtime file hashes and instructions to rebuild those members for review.
