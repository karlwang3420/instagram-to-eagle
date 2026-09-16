# AMO listing — Instagram to Eagle 0.9.4

Copy the text below into the existing AMO entry. The tested extension ID remains `instagram-to-eagle@local.karl`; creating a second add-on is unnecessary.

## Language and listing status

Your current entry has Traditional Chinese as its default locale. Use the localization control to add/select **English (US)**, save the English name, summary, and description, then change **Additional Details → Default Locale** to **English (US)**. If English is not offered there yet, save the English localization first. No Chinese translation is supplied.

Use **Manage Status & Versions** to confirm that the extension is set up for public distribution on AMO. An editable product page does not by itself confirm that it is publicly listed; self-distributed versions can also have a developer entry. Keep the existing add-on identity when configuring public distribution.

## Describe Add-on

### Name

Instagram to Eagle

### Add-on URL

Suggested slug: `instagram-to-eagle`, if available. The slug is a public-page address, separate from the extension's technical ID. Keep the existing generated slug if the suggested one is unavailable.

### Summary

Save Instagram photos, videos, carousels, Reels, and Stories directly to your Eagle library with source links and optional tags.

### Description

Save the Instagram media you choose directly to your Eagle library, without a separate download-folder step.

Instagram to Eagle adds download controls to Instagram posts, profile thumbnails, Reels, and Stories. Choose one item or save every image and video in a carousel, in order.

Features:
- Save individual photos and videos, complete carousels, and posts from profile thumbnails.
- Save Reels, the current Story, or all available Stories from the current account.
- Choose an existing Eagle folder from the extension popup.
- Keep a short title and the original Instagram source link.
- Enable or disable default tags, caption hashtags, and creator tags independently.

Getting started:
1. Install and open Eagle with a library loaded.
2. Sign in to Instagram in Firefox.
3. Allow the extension access to Instagram and Eagle on your computer when prompted.
4. Reload Instagram and use the download buttons. Open the extension popup to choose a folder and tags.

Requirements:
Desktop Firefox 140 or newer and Eagle running on the same computer. This extension is free; Eagle is separate paid software with a trial available at https://eagle.cool/. Tested on Windows. Android is not supported. The extension interface is in English.

Privacy:
The extension has no analytics, advertising, or developer-operated backend. When you choose to save, it reads the selected Instagram content and sends media URLs, titles, source links, and selected tags to Eagle's local API. Eagle then downloads the files from Instagram/Meta media servers. Instagram login cookies are not copied to Eagle. Folder and tag preferences stay in Firefox's local extension storage.

Limitations:
Instagram changes may affect media detection. Videos need a direct downloadable media file; segmented streams are unsupported. Highlights, archived or expired Stories, and whole-profile downloads are not supported. If a complete carousel cannot be verified, the extension reports an error instead of silently saving an incomplete batch.

This is an independent project, not affiliated with or endorsed by Instagram, Meta, or Eagle. Save only content you have permission to use.

Support and source: https://github.com/karlwang3420/instagram-to-eagle
Privacy policy: https://github.com/karlwang3420/instagram-to-eagle/blob/main/PRIVACY.md

## Additional Details and support

| Field | Value |
| --- | --- |
| Default Locale | English (US) / `en-US` |
| Homepage | `https://github.com/karlwang3420/instagram-to-eagle` |
| Support website | `https://github.com/karlwang3420/instagram-to-eagle/issues` |
| Tags | `instagram`, `eagle`, `download`, `images`, `video` |
| Category | Choose the available category that best matches media downloads |
| Contributions URL | Leave empty |
| Requires payment / non-free software | Yes: Eagle is required and is separately licensed; the extension itself is free |
| Compatible platform | Windows for the initial verified release; do not select Android |
| Support email | Use an address you want public, if AMO requires one; none has been inferred from local Git settings |

## Authors, license, and privacy

Under **Manage Authors & License**, select **MIT License**. The full text is in [LICENSE](../LICENSE).

For the privacy field, use the complete text from [PRIVACY.md](../PRIVACY.md). If the form accepts a URL, use:

`https://github.com/karlwang3420/instagram-to-eagle/blob/main/PRIVACY.md`

The manifest currently declares `data_collection_permissions.required: ["none"]`. See the explicit data-flow and local-export discussion in [reviewer notes](AMO-REVIEWER-NOTES.md). A passing linter does not resolve Mozilla's interpretation of that declaration.

## Icon and screenshots

- Icon: [128 px PNG](../icons/icon-128.png).
- Screenshot 1: [Folder and tag settings](store-assets/settings.png).
- Screenshot 2: [Connection setup](store-assets/setup.png).
- Captions and capture details: [store assets](store-assets/README.md).

These screenshots show the actual 0.9.3 interface rendered by the Firefox test fixture, with example local-library data. They do not show private Instagram content or claim a live import.

## Version and reviewer notes

Use [AMO-REVIEWER-NOTES.md](AMO-REVIEWER-NOTES.md) for the technical review field. Add any required test-account credentials only in AMO's private reviewer notes, never to this repository.

Suggested 0.9.4 release note:

Prepared for public AMO distribution. Functionality is unchanged from 0.9.3, including the simplified popup and setup interface.

Version 0.9.3 was already uploaded and the publisher reported it working. Version 0.9.4 changes only the manifest version within the runtime package. On the existing entry, choose **Upload a New Version → Where to Host Version → On this site**, then upload the 0.9.4 XPI. Do not create a new add-on or change the ID. Original packages are retained. Artifact validation is recorded in [RELEASE-CHECKS.md](RELEASE-CHECKS.md). The supplied screenshots remain the 0.9.3 captures; the interface is unchanged apart from its displayed version.

## Final account-only steps

1. Save the listing fields, MIT license, privacy policy, icon, and screenshots in AMO.
2. Check the distribution channel and public-listing status of the existing entry.
3. Supply authorized test-account access privately when required for review.
4. Complete Mozilla's submission and developer-agreement steps in your account.
5. Once the public page is available, replace the README's temporary-test download with the verified AMO listing link.

References: [Mozilla submission guide](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/), [signing and distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/), [data disclosure guidance](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/), [Eagle requirements and licensing](https://eagle.cool/).
