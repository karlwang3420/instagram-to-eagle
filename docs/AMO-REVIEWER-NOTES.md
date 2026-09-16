# Reviewer notes — Instagram to Eagle 0.9.3

Publisher: `karlwang3420`

Extension ID: `instagram-to-eagle@local.karl`

Source: https://github.com/karlwang3420/instagram-to-eagle

License: MIT

## Purpose and prerequisites

This extension saves user-selected Instagram media to an existing local Eagle library. Review requires desktop Firefox 140+ on Windows, Eagle installed and running with a library open, and an Instagram account that can view the test media. Eagle is separate paid desktop software with a trial at https://eagle.cool/; it is not bundled or installed by the extension. Android is not supported.

Instagram credentials are not included in the public repository or submission bundle. The publisher must supply authorized test-account access through AMO's private reviewer channel when required. Do not use the publisher's personal account credentials.

## Functional test procedure

1. Open Eagle with a test library. Keep it running; its local API listens on `http://127.0.0.1:41595`.
2. Install the submitted XPI, open the setup page, and approve the requested Instagram and localhost access. Open the extension popup; it should report Eagle connected and show its folder list.
3. Sign in to Instagram with the designated test account and reload any already-open Instagram tab.
4. Open an accessible single-photo post and click the download button beside the bookmark. In Eagle, verify the image, title, source link, tags, and blank annotation.
5. Open a mixed image/video carousel. Use the top-right control for the current item, then the bookmark-adjacent control for the complete post. Verify current-item identity and whole-post order in Eagle.
6. Hover or focus a profile-grid thumbnail and click its download control. It should save that post, including its carousel items when present.
7. Open an accessible Reel and save it using its playback-area download control.
8. Open an account with currently available Stories. Try the current-Story action, then the account-Story action. These tests require unexpired media available to the test account.
9. Select a different Eagle folder in the popup and switch tag categories off. Save another item and verify the destination and tags. Turning off the Creator username tag does not remove the creator's username from the title.
10. Close Eagle and try again. The extension should show a connection error. Reopen Eagle and use Retry Eagle connection. Revoke localhost permission in Firefox and confirm imports are blocked until access is restored.

"Sent to Eagle" confirms acceptance of the request by Eagle; the completed download must be checked in Eagle. Instagram layouts and direct media availability can change. Unsupported segmented streams and incomplete batches fail with an error.

## Permissions and data flow

- Instagram host permissions allow controls and on-demand media lookup on Instagram pages.
- `scripting` allows bundled extraction functions to run against the selected tab, including its MAIN world. `activeTab` supports interaction with the active page.
- `storage` holds the selected Eagle folder ID and tag switches. The extension does not use sync storage.
- `http://127.0.0.1/*` permits the local Eagle connection. Firefox host match patterns cannot specify a port; code fixes the destination to port 41595 and the extension CSP limits connections accordingly. Local HTTP is loopback traffic, not a remote HTTP service.
- Opening setup/settings can read Eagle application information and folders. Imports are initiated by extension controls and send selected media URLs, short titles, source links, tags, a blank annotation, and an optional folder ID to Eagle. Eagle retrieves media from Instagram/Meta servers.
- Additional Instagram lookups use the existing browser session. Login cookies and session headers are not forwarded to Eagle or saved in extension settings. Media URLs can contain temporary access parameters.
- There is no developer-operated server, telemetry, advertising, remote executable code, or third-party downloader service. Extractors and UI code are bundled. Instagram JSON and page objects are treated as data.

See the full [privacy policy](../PRIVACY.md).

## Data declaration for review

The tested package declares `data_collection_permissions.required: ["none"]`. Its intended interpretation is a user-initiated export into a local library, with no developer data collection. This is not a claim that the extension makes no network requests or that no information passes to the local Eagle application.

Mozilla's [policy FAQ](https://extensionworkshop.com/documentation/publish/add-on-policies-faq/) permits user-initiated local backups without explicit consent. However, the [data disclosure guidance](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/) defines transmission broadly as handling outside the add-on or browser. The export here uses a local application rather than a browser-written file. This distinction is disclosed for review; the publisher has not received a Mozilla determination that the local-backup exception covers this implementation. If explicit data categories or additional consent are required, the manifest and consent flow must be revised in a new tested version.

## Source and build

The runtime consists of readable JavaScript, HTML, CSS, and PNG assets. There is no transpilation, bundling, minification step, or runtime package dependency. No third-party JavaScript library is bundled.

The matching source archive contains the runtime files plus current documentation, license, tests, and build helpers. Its `BUILD-REVIEW.md` describes how to reproduce the reviewed runtime archive. PNGs are checked in and need not be regenerated to build the extension. Optional icon regeneration uses Pillow, NumPy, and SciPy; these are development tools and are not installed by the add-on.

## Validation

The publisher confirmed a fresh installation and manual testing of 0.9.2. The subsequent 0.9.3 popup cleanup has automated verification including 59 passing unit tests and a passing Firefox 156 setup/settings suite. That suite verifies real permission revocation, simulates the native approval/denial boundary, and mocks Eagle imports. Its screenshots use example local-library data. See [RELEASE-CHECKS.md](RELEASE-CHECKS.md) for the exact artifact hash and linter result.
