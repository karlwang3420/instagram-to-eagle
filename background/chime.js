/* Firefox's background page can play audio directly. */
async function chime() {
  return new Audio(browser.runtime.getURL("sounds/success.ogg")).play();
}
