import type { CharacterId, EyeStyle, RenderStyle } from "./pineappleAvatar";

export interface AvatarSettings {
  eyeThickness: number;
  eyeHeight: number;
  mouthThickness: number;
  wobble: number;
  style: RenderStyle;
  eyeStyle: EyeStyle;
  blinkFrequency: number;
  character: CharacterId;
}

export const DEFAULT_SETTINGS: AvatarSettings = {
  eyeThickness: 0.85,
  eyeHeight: 1,
  mouthThickness: 0.9,
  wobble: 0.7,
  style: "solid",
  eyeStyle: "emotive",
  blinkFrequency: 1,
  character: "hoodie",
};

const STORAGE_KEY = "pineapple-avatar-settings";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function num(value: string | null | undefined, fallback: number): number {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function styleOf(value: string | null | undefined, fallback: RenderStyle): RenderStyle {
  return value === "flat" || value === "solid" ? value : fallback;
}

function eyeStyleOf(value: string | null | undefined, fallback: EyeStyle): EyeStyle {
  return value === "simple" || value === "emotive" ? value : fallback;
}

function characterOf(
  value: string | null | undefined,
  fallback: CharacterId,
): CharacterId {
  return value === "pineapple" || value === "hoodie" ? value : fallback;
}

export function normalizeSettings(
  partial: Partial<AvatarSettings> = {},
): AvatarSettings {
  return {
    eyeThickness: clamp(partial.eyeThickness ?? DEFAULT_SETTINGS.eyeThickness, 0.25, 2.5),
    eyeHeight: clamp(partial.eyeHeight ?? DEFAULT_SETTINGS.eyeHeight, 0.25, 2.5),
    mouthThickness: clamp(
      partial.mouthThickness ?? DEFAULT_SETTINGS.mouthThickness,
      0.25,
      2.5,
    ),
    wobble: clamp(partial.wobble ?? DEFAULT_SETTINGS.wobble, 0, 2),
    style: styleOf(partial.style, DEFAULT_SETTINGS.style),
    eyeStyle: eyeStyleOf(partial.eyeStyle, DEFAULT_SETTINGS.eyeStyle),
    blinkFrequency: clamp(
      partial.blinkFrequency ?? DEFAULT_SETTINGS.blinkFrequency,
      0,
      3,
    ),
    character: characterOf(partial.character, DEFAULT_SETTINGS.character),
  };
}

export function settingsToQuery(settings: AvatarSettings): string {
  const q = new URLSearchParams({
    eye: settings.eyeThickness.toFixed(2),
    eyeH: settings.eyeHeight.toFixed(2),
    mouth: settings.mouthThickness.toFixed(2),
    wobble: settings.wobble.toFixed(2),
    style: settings.style,
    eyes: settings.eyeStyle,
    blink: settings.blinkFrequency.toFixed(2),
    character: settings.character,
  });
  return q.toString();
}

export function previewHref(settings: AvatarSettings): string {
  return `/preview.html?${settingsToQuery(settings)}`;
}

export function saveSettings(settings: AvatarSettings): void {
  const next = normalizeSettings(settings);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

function fromSearch(search: string): Partial<AvatarSettings> {
  const q = new URLSearchParams(search);
  return {
    eyeThickness: num(q.get("eye"), DEFAULT_SETTINGS.eyeThickness),
    eyeHeight: num(q.get("eyeH"), DEFAULT_SETTINGS.eyeHeight),
    mouthThickness: num(q.get("mouth"), DEFAULT_SETTINGS.mouthThickness),
    wobble: num(q.get("wobble"), DEFAULT_SETTINGS.wobble),
    style: styleOf(q.get("style"), DEFAULT_SETTINGS.style),
    eyeStyle: eyeStyleOf(q.get("eyes"), DEFAULT_SETTINGS.eyeStyle),
    blinkFrequency: num(q.get("blink"), DEFAULT_SETTINGS.blinkFrequency),
    character: characterOf(q.get("character"), DEFAULT_SETTINGS.character),
  };
}

function fromStorage(): Partial<AvatarSettings> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<AvatarSettings>;
  } catch {
    return {};
  }
}

/** Query params win, then sessionStorage, then defaults. */
export function loadSettings(search = window.location.search): AvatarSettings {
  const stored = fromStorage();
  const queried = search.includes("=") ? fromSearch(search) : {};
  const q = new URLSearchParams(search);
  const hasQuery =
    q.has("eye") ||
    q.has("eyeH") ||
    q.has("mouth") ||
    q.has("wobble") ||
    q.has("style") ||
    q.has("eyes") ||
    q.has("blink") ||
    q.has("character");
  return normalizeSettings(hasQuery ? { ...stored, ...queried } : stored);
}
