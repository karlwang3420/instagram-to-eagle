# Privacy policy — Instagram to Eagle

Last updated: September 16, 2026. Applies to version 0.9.2.

Instagram to Eagle is maintained by [karlwang3420](https://github.com/karlwang3420). It saves media you choose on Instagram to the Eagle application on your computer. The extension has no developer-operated server, analytics, advertising, or automatic error reporting. The developer does not receive your saved media, Instagram credentials, or browsing history through the extension.

## Information used

While you browse Instagram, the extension inspects page elements to place download controls. When you save, it reads the selected post or Story and relevant page data to identify its media, creator, caption, source URL, and carousel or Story position. It may request additional metadata from Instagram using your existing signed-in session.

The extension does not ask for your Instagram password. It does not copy login cookies or session headers into Eagle or extension storage. Instagram requests still use the browser's normal authentication where needed.

## Connections and recipients

- **Instagram / Meta:** the extension makes requests to Instagram to resolve the media you selected. Instagram receives normal network-request information, such as your IP address and the authentication used by your session. The extension does not send your Eagle library or folder list to Instagram.
- **Eagle on your computer:** the extension reads Eagle's application information and folder list from `http://127.0.0.1:41595`. When you click a download control, it sends media download URLs, a short title, the Instagram source link, chosen tags, and an optional destination folder ID to that local API. Titles can include the creator's username and the first line of the caption. Media URLs may contain temporary access parameters supplied by Instagram.
- **Media download:** Eagle then retrieves the selected files from Instagram/Meta media servers. This involves internet access by Eagle; saving to a local library does not mean that no network requests occur. Instagram and Eagle have their own privacy practices outside this extension's control.

No media or metadata is sent to a developer-operated service. The extension does not sell data or use it for profiling or advertising.

## Local storage and retention

Firefox extension storage keeps your selected Eagle folder ID and three tag preferences. Older installations may retain unused preferences from earlier versions. Temporary selections and metadata can remain in extension memory during use; the extension does not persist a media archive or browsing log in its settings, and it does not use browser sync storage.

Saved media and metadata remain in your Eagle library under your control. Uninstalling this extension does not delete Eagle items. You can remove the extension's stored settings by removing the extension, and delete imported items in Eagle.

## Your choices

Imports are initiated through the extension's download controls. You can choose a folder, disable any or all automatic tag categories, revoke site permissions in Firefox, or remove the extension. Disabling the Creator tag does not remove the creator's username from the item title.

## Support and changes

For questions, use [GitHub Issues](https://github.com/karlwang3420/instagram-to-eagle/issues). Issues are public: do not post passwords, login cookies, private media, or signed media download URLs. Information you voluntarily post there is handled by GitHub and is not automatic extension telemetry.

Changes to this policy will be published in this repository. Material changes to data handling will be disclosed with the relevant extension update and consent requested where required.
