import type { Message, Reply } from "../lib/messages.js";
import { DEFAULT_SETTINGS, loadSettings } from "../lib/settings.js";

const greeting = document.querySelector<HTMLHeadingElement>("#greeting")!;
const count = document.querySelector<HTMLParagraphElement>("#count")!;
const reset = document.querySelector<HTMLButtonElement>("#reset")!;

async function send(message: Message): Promise<void> {
  let reply: Reply;
  try {
    reply = await chrome.runtime.sendMessage<Message, Reply>(message);
  } catch {
    count.textContent = "Background not reachable";
    return;
  }
  count.textContent = reply.ok ? `Pages seen this session: ${reply.count}` : `Error: ${reply.error}`;
}

reset.addEventListener("click", () => {
  void send({ type: "reset-stats" });
});

loadSettings(chrome.storage.sync)
  .catch(() => DEFAULT_SETTINGS)
  .then((settings) => {
    greeting.textContent = settings.greeting;
  });

void send({ type: "get-stats" });
