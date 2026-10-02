// A classic script: Chrome fails on any import or export here.
// So no top-level import, not even `import type`. See the spec, "The content script rule".
const pageSeen: import("./lib/messages.js").Message = { type: "page-seen" };

try {
  chrome.runtime.sendMessage(pageSeen).catch(() => {
    // "Extension context invalidated": the extension was reloaded. Nothing to do.
  });
} catch {
  // The same error, thrown before the call returns a promise.
}
