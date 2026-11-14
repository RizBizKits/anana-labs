import type { RenderStyle } from "./pineappleAvatar";

export interface AvatarSettings {
  eyeThickness: number;
  eyeHeight: number;
  mouthThickness: number;
  wobble: number;
  style: RenderStyle;
}

export const DEFAULT_SETTINGS: AvatarSettings = {
  eyeThickness: 0.85,
  eyeHeight: 1,
  mouthThickness: 0.9,
  wobble: 0.7,
  style: "solid",
};

const STORAGE_KEY = "pineapple-avatar-settings-v1";

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
  };
}

export function settingsToQuery(settings: AvatarSettings): string {
  const q = new URLSearchParams({
    eye: settings.eyeThickness.toFixed(2),
    eyeH: settings.eyeHeight.toFixed(2),
    mouth: settings.mouthThickness.toFixed(2),
    wobble: settings.wobble.toFixed(2),
    style: settings.style,
  });
  return q.toString();
}

export function previewHref(settings: AvatarSettings): string {
  return `/v1-preview.html?${settingsToQuery(settings)}`;
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
    q.has("style");
  return normalizeSettings(hasQuery ? { ...stored, ...queried } : stored);
}
