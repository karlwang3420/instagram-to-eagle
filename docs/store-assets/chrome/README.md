# Chrome Web Store assets — 1.0.4

| File | Size | Suggested caption |
| --- | --- | --- |
| `store-icon-128.png` | 128×128 | — |
| `screenshot-1-post.png` | 1280×800 | Save the current carousel item or the whole post in one click. |
| `screenshot-2-profile-grid.png` | 1280×800 | Hover a profile, Explore, search or Saved thumbnail to save the whole post. |
| `screenshot-3-reels.png` | 1280×800 | Save Reels from the player's action rail. |
| `screenshot-4-stories.png` | 1280×800 | Save the current Story or every available Story from the account. |
| `screenshot-5-settings.png` | 1280×800 | Choose an Eagle folder and automatic tags. |
| `promo-small-440x280.png` | 440×280 | Required small promo tile. |
| `promo-marquee-1400x560.png` | 1400×560 | Optional marquee tile. |

## How they were made

Captured on October 4, 2026 with Playwright Chromium (Chrome for Testing). The unpacked 1.0.4 Chrome build was loaded into the browser. The download buttons, toast, and popup are the extension's real UI, injected by its own content scripts and rendered from its own popup page. Nothing was drawn in afterwards.

- **Instagram pages are mock-ups**, served locally on `instagram.com` routes. The account (`lumen.studio`), comments, and artwork are fictional, and the artwork is original SVG made for these images. No real Instagram users or third-party content appear.
- **Eagle was mocked** inside the service worker. The folders shown are example data, not a real library. The "Sent 3 files to Eagle" toast comes from a real click handled by the extension against the mocked API.
- The settings shot uses the setup page with the popup's ready state restored, because the background rejects messages from a popup opened in a tab. This reproduces the toolbar popup's own logic: it hides the access panel once access is granted and uses the same 380 px layout.
- Each image was rendered at 2× and downscaled with Lanczos to the exact store size. Images are saved as 24-bit RGB PNGs.
- `store-icon-128.png` is `icons/icon-128.png` with the artwork scaled to 96 px inside 16 px of transparent padding, as Google's icon guidance recommends. The manifest icons are unchanged.

The capture scripts are kept locally in `work/cws/` (`capture.cjs`, `promo.cjs`), which Git ignores. To refresh the images for a later version, rebuild `work/cws/unpacked` from `tools/package_extension.py` and rerun the scripts.
