# Changelog

Release notes are listed newest first. Older entries describe behavior at that version; some features were later removed.

## 0.9.2

- Replaced the extension and popup icon with transparent PNGs at 16, 32, 48, 96, and 128 px.
- Added icon-generation and packaging scripts, plus an unsigned XPI for testing.

## 0.9.1

- Fixed individual-video selection in mixed carousels when Instagram mounts only part of the slide list.
- Prioritized player media IDs and direct-file or unique-poster matches over relative slide positions; conflicting identities are rejected.
- Reordered tag switches to Default tags, Post hashtags, and Creator.

## 0.9.0

- Added first-install setup and permission checks for Instagram and local Eagle access.
- Redesigned the popup and added independent default-tag, hashtag, and creator switches.
- Preserved folder preferences while Eagle is offline.

## 0.8.8

- Fixed current-image selection when Instagram renders only part of a carousel.
- Matched the clicked image against its available renditions without guessing its slide number.

## 0.8.7

- Fixed media lookup for extended Instagram post links while preserving the original source link in Eagle.

## 0.8.6

- Added a full-post Relay lookup when initial metadata is incomplete, with post-identity and completeness checks.
- Fixed duplicate download buttons caused by nested media in a post's sidebar.

## 0.8.5

- Removed profile-wide downloads and the Firefox right-click menu.
- Simplified the popup to Eagle connection, destination folder, and tag settings.
- Retained on-page controls for individual posts, carousels, profile tiles, Reels, and Stories.

## 0.8.4

- Added profile diagnostics to the popup without requiring a prior hover.
- Fixed serialization of shared media references while continuing to remove actual cycles.
- Live profile transport and hover issues remained unresolved in this release.

## 0.8.3

- Removed a redundant account lookup from bulk imports and added rate-limit cooldowns and spacing between feed requests.
- Adjusted profile-hover button positioning and focus handling.

## 0.8.2

- Moved bulk feed requests into Firefox's isolated extension context and improved transport errors.
- Updated profile buttons to follow Instagram's native hover overlay when available.

## 0.8.1

- Corrected profile feed requests and surfaced authentication, rate-limit, and malformed-response errors.
- Anchored profile download controls inside each thumbnail without changing Instagram's link styling.

## 0.8.0

- Added profile-hover and whole-profile downloads, including mixed image/video posts.
- Whole-profile downloads were later removed in 0.8.5.

## 0.7.1

- Replaced large status messages with compact notifications, accessible dismissal, and reduced-motion support.

## 0.7.0

- Introduced a carousel adapter with per-slide controls and a shared whole-post button.
- Added checks for virtualized slides, shared video posters, transitions, and replaced posts.

## 0.6.5

- Kept carousel controls visible on the last slide and prevented duplicate controls on nested video posts.

## 0.6.4

- Added Instagram's page-side Story lookup and media-ID recognition for blob players.
- Preserved the selected Story if playback advanced during lookup, and rejected conflicting identities.

## 0.6.3

- Added support for Story viewers opened at `/stories/username/` without a Story ID in the URL.
- Matched the active Story without defaulting to the account's first item.

## 0.6.2

- Added retries for delayed Story rendering and controls that become visible after entry.

## 0.6.1

- Fixed download controls pushing the bookmark onto a second row in narrow layouts.

## 0.6

- Integrated download buttons into Instagram's native action and playback rows.
- Improved Story selection and video lookup through page data.

## 0.5

- Added Reel and Story controls, including current-Story and account-Story imports.

## 0.4

- Simplified imported metadata to a short title, source URL, and automatic tags; left annotations empty.

## 0.3

- Fixed off-screen images being classified as videos and removed duplicate or orphaned controls.

## 0.2

- Improved timeline support for dynamically inserted and replaced posts.
- Expanded browser regression coverage for download controls and carousel selection.
