# Reviewer notes — Instagram to Eagle 0.9.4

Requires desktop Firefox 140+, Eagle running with a library open, and an Instagram login. Tested on Windows; Android is unsupported. Eagle is paid software with a trial: https://eagle.cool/.

## Testing

1. Install, allow Instagram/local Eagle access, and reload Instagram.
2. Use download buttons on posts, carousels, profile thumbnails, Reels, or Stories. Verify the imported media and source links in Eagle.
3. Change the destination folder and tag switches in the popup; verify another save uses those settings.

Instagram test credentials are not included; any required credentials must be supplied privately through AMO.

## Data and source

Selected media URLs and metadata go to Eagle at `http://127.0.0.1:41595`; Eagle downloads the files from Instagram/Meta. Instagram lookups use the browser session, but login cookies are not forwarded to Eagle. Preferences stay in local extension storage. No developer backend, analytics, or remote executable code.

The manifest declares `none` based on user-initiated local export. Please confirm whether export to a local application qualifies for the local-backup exception; no Mozilla determination has been obtained.

Readable source is bundled without compilation or minification. Version 0.9.4 only increments the version from 0.9.3.

Source (MIT): https://github.com/karlwang3420/instagram-to-eagle
