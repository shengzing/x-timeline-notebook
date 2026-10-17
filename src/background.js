"use strict";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "X_NOTES_PING") {
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
