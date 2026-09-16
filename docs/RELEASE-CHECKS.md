# Publication checks — 0.9.2

Checked September 16, 2026. This records preparation and test evidence, not Mozilla approval.

## Reviewed artifact

- File: `dist/instagram-to-eagle-0.9.2-unsigned.xpi`
- Size: 84,606 bytes
- Extension ID: `instagram-to-eagle@local.karl`
- Version: `0.9.2`
- SHA-256: `76d2ec0c9ab2126c9d5d1b9fa0478f05d827da03834a109454dcccd39d0bcc91`

The existing XPI, manifest, and application code were not changed during publication preparation. The MIT license, privacy policy, store copy, and screenshots were added separately. Future packages built with `tools/package_extension.py` include the license.

## Evidence

| Check | Result |
| --- | --- |
| Publisher's fresh install and manual testing | Confirmed by the publisher for 0.9.2; exact media cases were not enumerated |
| Unit tests | 59 passed in the preceding 0.9.2 build validation |
| Firefox setup/settings suite | Passed in Firefox 156.0 outside the Windows execution sandbox |
| Permission coverage | Real revocation blocks imports; native approval/denial is simulated in the automated suite |
| Test imports | Mocked; the automated run did not add test items to the real Eagle library |
| Mozilla Add-ons Linter | 10.8.0: zero errors, zero notices, one warning |
| Screenshots | Actual 0.9.2 DOM/CSS rendered by the test fixture; example folder/connection data |
| Reviewer source reconstruction | All 17 original runtime members reproduced byte-for-byte; the submission bundle contains the original unchanged XPI |

The linter warning is `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`: the inherited Android minimum of 140 predates data-consent support in Android 142. This extension requires desktop Eagle and is not intended for Android. Do not select Android for this submission. The warning is recorded rather than changing the already tested manifest. If Mozilla requires a manifest adjustment, make it in a new version and test that artifact.

The earlier `DiscardedBrowsingContextError` did not recur outside the execution sandbox. The passing run does not establish live compatibility with every Instagram layout or with untested operating systems.

## Remaining submission matters

- Set English (US) as the listing's default locale and save the prepared content.
- Select MIT in AMO and link or paste the privacy policy.
- Verify the existing entry's distribution channel and public-listing status.
- Supply a test account privately if needed for review; no credentials are included in these files.
- Disclose the current `none` data declaration and local Eagle export as described in the reviewer notes. The linter does not decide whether Mozilla's local-backup exception applies.

## Reproducing the checks

Unit and browser commands are documented in [DEVELOPMENT.md](DEVELOPMENT.md). The runtime XPI was passed directly to Mozilla's `addons-linter` with JSON output. Use a current Mozilla linter when preparing a later release; AMO may use a different validator version.

Run `python tools/prepare_amo.py` to create the submission bundle and matching reviewer source archive without replacing the tested XPI. The source archive includes its original runtime file hashes and instructions to rebuild those members for review.
