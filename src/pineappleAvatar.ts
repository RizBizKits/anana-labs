export const MOODS = [
  { id: "idle", label: "Idle" },
  { id: "thinking", label: "Thinking" },
  { id: "happy", label: "Happy" },
  { id: "love", label: "Love" },
] as const;

export type Mood = (typeof MOODS)[number]["id"];

export interface PineappleAvatarOptions {
  mood?: Mood;
  followPointer?: boolean;
  label?: string;
  /** Horizontal thickness of the eye pills / strokes. 1 = default. */
  eyeThickness?: number;
  /** Vertical height of the eye pills / arcs. 1 = default. */
  eyeHeight?: number;
  /** Stroke thickness of the mouth. 1 = default. */
  mouthThickness?: number;
  /** Jelly wobble amount for the whole pineapple. 0 = still. */
  wobble?: number;
}

export interface PineappleAvatarHandle {
  update(options: Partial<PineappleAvatarOptions>): void;
  getOptions(): Required<
    Pick<
      PineappleAvatarOptions,
      | "mood"
      | "eyeThickness"
      | "eyeHeight"
      | "mouthThickness"
      | "followPointer"
      | "wobble"
    >
  >;
  destroy(): void;
}

const FACE = {
  left: { x: 0.3524, y: 0.5809 },
  right: { x: 0.6024, y: 0.574 },
  mouth: { x: 0.4803, y: 0.657 },
  eyeH: 0.1,
};

function pillEye(
  side: "left" | "right",
  thickness: number,
  height: number,
  glanceX = 0,
  glanceY = 0,
): string {
  const id = side === "left" ? "L" : "R";
  const t = Math.max(0.25, thickness);
  const hh = Math.max(0.25, height);
  const w = 2.2 + 7.5 * t;
  const h = 10 + 14 * hh;
  const x = glanceX - w / 2;
  const y = glanceY - h / 2;
  return `<rect class="eye eye-${id}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${(w / 2).toFixed(2)}" fill="#111"/>`;
}

function closedEye(side: "left" | "right", thickness: number, height: number): string {
  const id = side === "left" ? "L" : "R";
  const sw = (1.6 + 4.2 * Math.max(0.25, thickness)).toFixed(2);
  const rise = 5 + 8 * Math.max(0.25, height);
  return `<path class="eye eye-${id}" d="M -8 3 Q 0 ${(-rise + 3).toFixed(2)} 8 3" fill="none" stroke="#111" stroke-width="${sw}" stroke-linecap="round"/>`;
}

function heartEye(side: "left" | "right", thickness: number, height: number): string {
  const id = side === "left" ? "L" : "R";
  const s = 0.55 + 0.35 * Math.max(0.25, thickness);
  const v = 0.55 + 0.4 * Math.max(0.25, height);
  return `<path class="eye eye-${id}" transform="scale(${s.toFixed(3)} ${v.toFixed(3)})" d="M0 6 C0 6 -10 -2 -10 -8 C-10 -12 -6 -14 -3 -12 C-1 -11 0 -9 0 -9 C0 -9 1 -11 3 -12 C6 -14 10 -12 10 -8 C10 -2 0 6 0 6Z" fill="#111"/>`;
}

function eyeMarkup(
  mood: Mood,
  side: "left" | "right",
  thickness: number,
  height: number,
): string {
  switch (mood) {
    case "happy":
      return closedEye(side, thickness, height);
    case "thinking":
      return pillEye(side, thickness, height, side === "left" ? 3.2 : 4.2, -1);
    case "love":
      return heartEye(side, thickness, height);
    case "idle":
    default:
      return pillEye(side, thickness, height, 0, 0);
  }
}

function mouthMarkup(mood: Mood, thickness: number): string {
  const t = Math.max(0.25, thickness);
  const sw = (1.2 + 3.6 * t).toFixed(2);

  switch (mood) {
    case "happy":
      return `<path class="mouth" d="M -11 0 Q 0 11 11 0" fill="none" stroke="#111" stroke-width="${sw}" stroke-linecap="round"/>`;
    case "thinking":
      return `<path class="mouth" d="M -7 2 Q 0 0 7 3" fill="none" stroke="#111" stroke-width="${sw}" stroke-linecap="round"/>`;
    case "love":
      return `<path class="mouth" d="M -10 0 Q 0 12 10 0" fill="none" stroke="#111" stroke-width="${sw}" stroke-linecap="round"/>`;
    case "idle":
    default:
      return `<path class="mouth" d="M -9 0 Q 0 8 9 0" fill="none" stroke="#111" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
}

function renderFace(
  mood: Mood,
  gazeX: number,
  gazeY: number,
  eyeThickness: number,
  eyeHeight: number,
  mouthThickness: number,
): string {
  const lockGaze = mood === "love";
  const gx = lockGaze ? 0 : gazeX * 5;
  const gy = lockGaze ? 0 : gazeY * 4;
  const { left, right, mouth, eyeH } = FACE;
  const to = (p: { x: number; y: number }) => ({ x: p.x * 100, y: p.y * 100 });
  const L = to(left);
  const R = to(right);
  const M = to(mouth);
  const eyeScale = (eyeH * 100) / 18;
  const mouthScale = (eyeH * 100) / 20;

  return `
    <g class="gaze" transform="translate(${gx} ${gy})">
      <g transform="translate(${L.x} ${L.y}) scale(${eyeScale.toFixed(3)})">${eyeMarkup(mood, "left", eyeThickness, eyeHeight)}</g>
      <g transform="translate(${R.x} ${R.y}) scale(${eyeScale.toFixed(3)})">${eyeMarkup(mood, "right", eyeThickness, eyeHeight)}</g>
      <g transform="translate(${M.x} ${M.y}) scale(${mouthScale.toFixed(3)})">${mouthMarkup(mood, mouthThickness)}</g>
    </g>
  `;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function mountPineappleAvatar(
  host: HTMLElement,
  initial: PineappleAvatarOptions = {},
): PineappleAvatarHandle {
  let mood: Mood = initial.mood ?? "idle";
  let followPointer = initial.followPointer ?? true;
  let eyeThickness = initial.eyeThickness ?? 1;
  let eyeHeight = initial.eyeHeight ?? 1;
  let mouthThickness = initial.mouthThickness ?? 1;
  let wobble = initial.wobble ?? 0.7;
  let gazeX = 0;
  let gazeY = 0;
  let raf = 0;
  let targetX = 0;
  let targetY = 0;
  const reduced = prefersReducedMotion();

  host.replaceChildren();
  host.classList.add("pineapple-avatar");
  host.setAttribute("role", "img");
  host.setAttribute("aria-label", initial.label ?? "Pineapple");

  const stage = document.createElement("div");
  stage.className = "pineapple-avatar__stage";

  const art = document.createElement("img");
  art.className = "pineapple-avatar__art";
  art.src = new URL("./assets/pineapple.png", import.meta.url).href;
  art.alt = "";
  art.draggable = false;

  const face = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  face.classList.add("pineapple-avatar__face");
  face.setAttribute("viewBox", "0 0 100 100");
  face.setAttribute("aria-hidden", "true");
  face.setAttribute("shape-rendering", "geometricPrecision");

  stage.append(art, face);
  host.append(stage);

  const paintFace = () => {
    face.innerHTML = renderFace(
      mood,
      gazeX,
      gazeY,
      eyeThickness,
      eyeHeight,
      mouthThickness,
    );
  };

  const applyWobble = (timeSec: number) => {
    const a = reduced ? 0 : Math.max(0, wobble);
    const bob = Math.sin(timeSec * 2.2) * (4 + a * 2);
    const sx =
      1 + Math.sin(timeSec * 2.05) * 0.03 * a + Math.sin(timeSec * 3.4) * 0.012 * a;
    const sy =
      1 + Math.cos(timeSec * 2.35) * 0.042 * a + Math.cos(timeSec * 4.1) * 0.014 * a;
    const skew = Math.sin(timeSec * 1.55) * 3.4 * a + Math.sin(timeSec * 2.8) * 1.2 * a;
    const slideX = Math.sin(timeSec * 1.1) * 5 * a + Math.sin(timeSec * 2.6) * 1.8 * a;
    stage.style.transform = `translate(${slideX.toFixed(2)}px, ${bob.toFixed(2)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)}) skewX(${skew.toFixed(2)}deg)`;
  };

  const tick = () => {
    gazeX += (targetX - gazeX) * 0.14;
    gazeY += (targetY - gazeY) * 0.14;
    paintFace();
    applyWobble(performance.now() / 1000);
    raf = requestAnimationFrame(tick);
  };

  const onPointer = (e: PointerEvent) => {
    if (!followPointer) return;
    const rect = host.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.55;
    targetX = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width * 0.6)));
    targetY = Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height * 0.6)));
  };

  paintFace();
  raf = requestAnimationFrame(tick);
  window.addEventListener("pointermove", onPointer);

  return {
    update(options) {
      if (options.mood) mood = options.mood;
      if (options.followPointer !== undefined) followPointer = options.followPointer;
      if (options.eyeThickness !== undefined) eyeThickness = options.eyeThickness;
      if (options.eyeHeight !== undefined) eyeHeight = options.eyeHeight;
      if (options.mouthThickness !== undefined) mouthThickness = options.mouthThickness;
      if (options.wobble !== undefined) wobble = options.wobble;
      if (options.label !== undefined) host.setAttribute("aria-label", options.label);
      if (!followPointer) {
        targetX = 0;
        targetY = 0;
      }
      paintFace();
    },
    getOptions() {
      return { mood, eyeThickness, eyeHeight, mouthThickness, followPointer, wobble };
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      host.replaceChildren();
      host.classList.remove("pineapple-avatar");
    },
  };
}
