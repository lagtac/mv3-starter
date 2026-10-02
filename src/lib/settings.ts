import type { Store } from "./messages.js";

export interface Settings {
  greeting: string;
}

export const DEFAULT_SETTINGS: Settings = { greeting: "Hello" };
export const MAX_GREETING_LENGTH = 100;

const SETTINGS_KEY = "settings";

export function validateGreeting(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "") return "Greeting cannot be empty";
  if (trimmed.length > MAX_GREETING_LENGTH) {
    return `Greeting must be at most ${MAX_GREETING_LENGTH} characters`;
  }
  return null;
}

export async function loadSettings(area: Store): Promise<Settings> {
  const items = await area.get(SETTINGS_KEY);
  const saved = items[SETTINGS_KEY];
  if (typeof saved !== "object" || saved === null) return DEFAULT_SETTINGS;
  const greeting = (saved as { greeting?: unknown }).greeting;
  if (typeof greeting !== "string" || validateGreeting(greeting) !== null) return DEFAULT_SETTINGS;
  return { greeting: greeting.trim() };
}

export async function saveSettings(area: Store, settings: Settings): Promise<void> {
  const error = validateGreeting(settings.greeting);
  if (error !== null) throw new Error(error);
  await area.set({ [SETTINGS_KEY]: { greeting: settings.greeting.trim() } });
}
