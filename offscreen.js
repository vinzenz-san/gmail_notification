// Läuft nur unter Chrome im Offscreen-Dokument (siehe background.js: ensureOffscreenDocument).
// Übernimmt zwei Jobs, für die der MV3-Service-Worker kein DOM hat: Sound abspielen und
// Gmail-Feed-XML per DOMParser parsen (parseAtomXml kommt aus gmailFeed.js).

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "play-sound") {
    new Audio(chrome.runtime.getURL("sound/notify.wav")).play().catch(() => {});
    return false;
  }
  if (message?.type === "parse-atom") {
    sendResponse(parseAtomXml(message.xml));
    return false;
  }
  return false;
});
