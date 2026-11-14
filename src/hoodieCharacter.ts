/**
 * Concept-sheet hoodie as layered PNGs (same art, puppet motion).
 * Draw order: arms under body so shoulders stay covered.
 */

export const HOODIE_FACE = {
  left: { x: 0.43, y: 0.41 },
  right: { x: 0.56, y: 0.41 },
  mouth: { x: 0.495, y: 0.465 },
  eyeH: 0.06,
} as const;

export const HOODIE_PIVOTS = {
  /** Inner edge of each arm cutout (where it tucks under the hoodie). */
  shoulderL: { x: 0.276, y: 0.548 },
  shoulderR: { x: 0.74, y: 0.546 },
  /** Body squash/tilt pivot (chest). */
  chest: { x: 0.5, y: 0.52 },
} as const;

const bodyUrl = new URL("./assets/hoodie-body.png", import.meta.url).href;
const armLUrl = new URL("./assets/hoodie-arm-l.png", import.meta.url).href;
const armRUrl = new URL("./assets/hoodie-arm-r.png", import.meta.url).href;

export function hoodieLayersMarkup(): string {
  return `
<div class="hoodie-layers" aria-hidden="true">
  <img class="hoodie-layers__arm hoodie-layers__arm--l" data-anim="arm-l" src="${armLUrl}" alt="" draggable="false" />
  <img class="hoodie-layers__arm hoodie-layers__arm--r" data-anim="arm-r" src="${armRUrl}" alt="" draggable="false" />
  <img class="hoodie-layers__body" data-anim="body" src="${bodyUrl}" alt="" draggable="false" />
</div>`;
}

export interface HoodieLayerHandles {
  root: HTMLElement;
  body: HTMLElement | null;
  armL: HTMLElement | null;
  armR: HTMLElement | null;
}

export function bindHoodieLayers(root: HTMLElement): HoodieLayerHandles {
  return {
    root,
    body: root.querySelector('[data-anim="body"]'),
    armL: root.querySelector('[data-anim="arm-l"]'),
    armR: root.querySelector('[data-anim="arm-r"]'),
  };
}

function soft(t: number): number {
  const x = Math.sin(t);
  return x * (0.7 + 0.3 * Math.abs(x));
}

export interface HoodieMotionState {
  bobY: number;
  tiltDeg: number;
  squashX: number;
  squashY: number;
}

/** Body squash/stretch + mild delayed arm sway around sheet shoulders. */
export function applyHoodieLayerMotion(
  parts: HoodieLayerHandles,
  timeSec: number,
  wobble: number,
  reduced: boolean,
): HoodieMotionState {
  const a = reduced ? 0 : Math.max(0, wobble);
  const breath = soft(timeSec * 1.3);
  const bounce = soft(timeSec * 1.95);
  const sway = soft(timeSec * 1.1 + 0.35);

  const bobY = bounce * (4.5 + a * 3);
  const squashX = 1 + breath * 0.014 * a + bounce * 0.024 * a;
  const squashY = 1 - breath * 0.012 * a - bounce * 0.028 * a;
  const tilt = sway * (1.8 + a * 2);

  const chest = `${HOODIE_PIVOTS.chest.x * 100}% ${HOODIE_PIVOTS.chest.y * 100}%`;
  if (parts.body) {
    parts.body.style.transformOrigin = chest;
    parts.body.style.transform = `translateY(${(-bobY).toFixed(2)}px) rotate(${tilt.toFixed(2)}deg) scale(${squashX.toFixed(4)}, ${squashY.toFixed(4)})`;
  }

  // Arms follow body bob, then add a small local sway at the shoulder
  const arm = soft(timeSec * 1.55) * (4 + a * 5);
  const armBob = soft(timeSec * 1.95 - 0.25) * (2 + a * 1.5);
  const sl = `${HOODIE_PIVOTS.shoulderL.x * 100}% ${HOODIE_PIVOTS.shoulderL.y * 100}%`;
  const sr = `${HOODIE_PIVOTS.shoulderR.x * 100}% ${HOODIE_PIVOTS.shoulderR.y * 100}%`;

  if (parts.armL) {
    parts.armL.style.transformOrigin = sl;
    parts.armL.style.transform = `translateY(${(-bobY + armBob).toFixed(2)}px) rotate(${(tilt - arm).toFixed(2)}deg)`;
  }
  if (parts.armR) {
    parts.armR.style.transformOrigin = sr;
    parts.armR.style.transform = `translateY(${(-bobY + armBob).toFixed(2)}px) rotate(${(tilt + arm).toFixed(2)}deg)`;
  }

  return { bobY, tiltDeg: tilt, squashX, squashY };
}
