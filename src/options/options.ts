import { loadSettings, saveSettings, validateGreeting } from "../lib/settings.js";

const form = document.querySelector<HTMLFormElement>("#form")!;
const input = document.querySelector<HTMLInputElement>("#greeting")!;
const statusLine = document.querySelector<HTMLParagraphElement>("#status")!;

// On a failed load the field stays empty, so a Save cannot write the default over the real greeting.
loadSettings(chrome.storage.sync).then(
  (settings) => {
    input.value = settings.greeting;
  },
  (err: unknown) => {
    statusLine.textContent = `Could not load: ${err instanceof Error ? err.message : String(err)}`;
  },
);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const error = validateGreeting(input.value);
  if (error !== null) {
    statusLine.textContent = error;
    return;
  }
  saveSettings(chrome.storage.sync, { greeting: input.value })
    .then(() => {
      statusLine.textContent = "Saved";
    })
    .catch((err: unknown) => {
      statusLine.textContent = `Could not save: ${err instanceof Error ? err.message : String(err)}`;
    });
});
