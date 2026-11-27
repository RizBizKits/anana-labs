/** Redrawn AI-companion states (Cursor video → extracted PNG frames). */

/** Production moods for the classic redrawn appearance (site / avatar). */
export const COMPANION_MOODS = [
  { id: "idle", label: "Idle", fps: 10 },
  { id: "thinking", label: "Working", fps: 10 },
  { id: "success", label: "Success", fps: 12 },
  { id: "error", label: "Error", fps: 12 },
  { id: "walk", label: "Walk", fps: 12 },
] as const;

/** Other pineapple appearances (animator idle studies). */
export const IDLE_VARIANTS = [
  { id: "idle-open", label: "Idle · open hands", fps: 10 },
  { id: "idle-sleeved", label: "Idle · sleeved", fps: 10 },
  { id: "idle-mitt", label: "Idle · mitt · yellow", fps: 10 },
  { id: "idle-fist", label: "Idle · fist hands", fps: 10 },
  { id: "idle-mitt-sneakers", label: "Idle · mitt + boots", fps: 10 },
] as const;

export const COMPANION_STATES = [
  ...COMPANION_MOODS,
  ...IDLE_VARIANTS,
] as const;

export type CompanionMoodId = (typeof COMPANION_MOODS)[number]["id"];
export type IdleVariantId = (typeof IDLE_VARIANTS)[number]["id"];
export type CompanionStateId = (typeof COMPANION_STATES)[number]["id"];

/** Alias used by site integrations — same frames as thinking. */
export type CompanionStateAlias = CompanionMoodId | "working";

const FRAME_DIRS: Record<CompanionStateId, string> = {
  // Two mitt-hand Idle colors: classic (pre-yellow) + brand yellow.
  idle: "idle-frames-sleeve-mitt-pre-yellow",
  "idle-mitt": "idle-frames-sleeve-mitt",
  "idle-open": "idle-frames-open-hands",
  "idle-sleeved": "idle-frames-sleeved",
  "idle-mitt-sneakers": "idle-frames-mitt-sneakers",
  "idle-fist": "idle-frames-sleeve-fist",
  thinking: "thinking-frames",
  success: "success-frames",
  error: "error-frames",
  walk: "walk-frames",
};

export function normalizeCompanionState(
  id: CompanionStateAlias | CompanionStateId,
): CompanionStateId {
  if (id === "working") return "thinking";
  return id;
}

export function companionStateMeta(id: CompanionStateAlias | CompanionStateId) {
  const normalized = normalizeCompanionState(id);
  return COMPANION_STATES.find((s) => s.id === normalized) ?? COMPANION_STATES[0]!;
}

/** Vite-resolved URLs for the 8 redrawn frames of a companion state. */
export function companionFrameUrls(
  id: CompanionStateAlias | CompanionStateId,
): string[] {
  const dir = FRAME_DIRS[normalizeCompanionState(id)];
  return Array.from({ length: 8 }, (_, i) => {
    const n = String(i).padStart(2, "0");
    return new URL(`../assets/generated/${dir}/f_${n}.png`, import.meta.url).href;
  });
}
