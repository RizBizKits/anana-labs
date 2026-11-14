/** Redrawn AI-companion states (Cursor video → extracted PNG frames). */

export const COMPANION_STATES = [
  { id: "idle", label: "Idle", fps: 10 },
  { id: "thinking", label: "Working", fps: 10 },
  { id: "success", label: "Success", fps: 12 },
  { id: "error", label: "Error", fps: 12 },
  { id: "walk", label: "Walk", fps: 12 },
] as const;

export type CompanionStateId = (typeof COMPANION_STATES)[number]["id"];

/** Alias used by site integrations — same frames as thinking. */
export type CompanionStateAlias = CompanionStateId | "working";

const FRAME_DIRS: Record<CompanionStateId, string> = {
  idle: "idle-frames",
  thinking: "thinking-frames",
  success: "success-frames",
  error: "error-frames",
  walk: "walk-frames",
};

export function normalizeCompanionState(
  id: CompanionStateAlias,
): CompanionStateId {
  return id === "working" ? "thinking" : id;
}

export function companionStateMeta(id: CompanionStateAlias) {
  const normalized = normalizeCompanionState(id);
  return COMPANION_STATES.find((s) => s.id === normalized) ?? COMPANION_STATES[0]!;
}

/** Vite-resolved URLs for the 8 redrawn frames of a companion state. */
export function companionFrameUrls(id: CompanionStateAlias): string[] {
  const dir = FRAME_DIRS[normalizeCompanionState(id)];
  return Array.from({ length: 8 }, (_, i) => {
    const n = String(i).padStart(2, "0");
    return new URL(`../assets/generated/${dir}/f_${n}.png`, import.meta.url).href;
  });
}
