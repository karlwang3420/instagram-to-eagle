/* Chrome's service worker has no DOM audio; an offscreen page plays and closes itself when idle. */
async function chime() {
  if (await browser.offscreen.hasDocument()) await browser.offscreen.closeDocument();
  await browser.offscreen.createDocument({ url: "sounds/chime.html", reasons: ["AUDIO_PLAYBACK"], justification: "Play a chime when a save is sent to Eagle." });
}
