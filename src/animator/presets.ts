import type { AnimId, AnimPreset, CharacterPose, LayerPose } from "./types";

export const ANIM_PRESETS: AnimPreset[] = [
  { id: "idle", label: "Idle", durationSec: 1.4, defaultFrames: 8 },
  { id: "thinking", label: "Working", durationSec: 1.2, defaultFrames: 8 },
  { id: "success", label: "Success", durationSec: 0.9, defaultFrames: 8 },
  { id: "error", label: "Error", durationSec: 1.1, defaultFrames: 8 },
  { id: "walk", label: "Walk", durationSec: 0.9, defaultFrames: 8 },
];

/** Presets that have Cursor-redrawn frame packs (not procedural puppet). */
export const REDRAWN_ANIM_IDS: AnimId[] = [
  "idle",
  "thinking",
  "success",
  "error",
  "walk",
];

export function presetById(id: AnimId): AnimPreset {
  return ANIM_PRESETS.find((p) => p.id === id) ?? ANIM_PRESETS[0]!;
}

const identity = (): LayerPose => ({ x: 0, y: 0, rot: 0, sx: 1, sy: 1 });

function soft(t: number): number {
  const x = Math.sin(t);
  return x * (0.7 + 0.3 * Math.abs(x));
}

/**
 * Poses are hierarchical: body is the parent; armL/armR are local
 * offsets/rotations around the shoulders (applied after body).
 * Keep angles modest so cutout shoulders stay sealed.
 */
export function samplePose(anim: AnimId, t: number): CharacterPose {
  const u = ((t % 1) + 1) % 1;
  const body = identity();
  const armL = identity();
  const armR = identity();

  if (anim === "idle") {
    const breath = soft(u * Math.PI * 2);
    const sway = soft(u * Math.PI * 2 + 0.35);
    body.y = breath * -5;
    body.sx = 1 + breath * 0.012;
    body.sy = 1 - breath * 0.016;
    body.rot = sway * 0.025;
    // tiny local arm drift (degrees→radians kept small)
    armL.rot = sway * -0.06 + soft(u * Math.PI * 2 * 1.15) * 0.04;
    armR.rot = sway * 0.06 + soft(u * Math.PI * 2 * 1.15 + 1.1) * -0.04;
    return { body, armL, armR };
  }

  if (anim === "thinking") {
    // Working: contemplative bob + one arm raised toward chin.
    const breath = soft(u * Math.PI * 2);
    const nod = soft(u * Math.PI * 2 * 0.85 + 0.4);
    body.y = breath * -4;
    body.sx = 1 + breath * 0.01;
    body.sy = 1 - breath * 0.014;
    body.rot = nod * 0.03;
    armL.rot = 0.08 + soft(u * Math.PI * 2) * 0.04;
    armR.rot = -0.55 + soft(u * Math.PI * 2 * 1.1) * 0.06;
    armR.y = -6;
    return { body, armL, armR };
  }

  if (anim === "success") {
    // Celebrate: hop + both arms up.
    const hop = Math.abs(Math.sin(u * Math.PI * 2));
    body.y = -hop * 12;
    body.sx = 1 + hop * 0.04;
    body.sy = 1 - hop * 0.05;
    body.rot = soft(u * Math.PI * 2) * 0.05;
    armL.rot = -0.55 - hop * 0.12;
    armR.rot = 0.55 + hop * 0.12;
    return { body, armL, armR };
  }

  if (anim === "error") {
    // Apologetic shrink + soft shrug.
    const breath = soft(u * Math.PI * 2);
    body.y = 4 + breath * 2;
    body.sx = 0.96 + breath * 0.01;
    body.sy = 1.04 - breath * 0.012;
    body.rot = soft(u * Math.PI * 2 + 0.6) * 0.04;
    armL.rot = 0.35 + soft(u * Math.PI * 2) * 0.05;
    armR.rot = -0.35 + soft(u * Math.PI * 2 + 1) * -0.05;
    return { body, armL, armR };
  }

  if (anim === "walk") {
    // Front-facing walk-in-place: readable bob + opposite arm sway.
    const cycle = u * Math.PI * 2;
    const bob = Math.abs(Math.sin(cycle)) * 14;
    const lean = Math.sin(cycle) * 0.05;
    const armSwing = Math.sin(cycle) * 0.32; // ~18°
    body.y = -bob;
    body.rot = lean;
    body.sx = 1 + Math.sin(cycle * 2) * 0.018;
    body.sy = 1 - Math.sin(cycle * 2) * 0.03;
    armL.rot = -armSwing;
    armR.rot = armSwing;
    return { body, armL, armR };
  }

  // Fallback: idle breath
  const breath = soft(u * Math.PI * 2);
  body.y = breath * -5;
  body.sx = 1 + breath * 0.012;
  body.sy = 1 - breath * 0.016;
  return { body, armL, armR };
}
