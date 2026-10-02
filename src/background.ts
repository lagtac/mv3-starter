import { handleMessage } from "./lib/handler.js";

// Wiring only: all counter logic is in lib/handler.ts.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg, chrome.storage.session).then(sendResponse);
  return true; // sendResponse is called later, after the storage call.
});
