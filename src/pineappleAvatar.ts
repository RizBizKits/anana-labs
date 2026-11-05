export type Mood = "idle" | "thinking" | "happy";

export interface PineappleAvatarOptions {
  mood?: Mood;
  followPointer?: boolean;
  label?: string;
  /** Horizontal thickness of the eye pills / strokes. 1 = default. */
  eyeThickness?: number;
  /** Stroke thickness of the mouth. 1 = default. */
  mouthThickness?: number;
  /** Fluid blob wobble for outer body + leaves only. 0 = still. */
  wobble?: number;
}

export interface PineappleAvatarHandle {
  update(options: Partial<PineappleAvatarOptions>): void;
  getOptions(): Required<
    Pick<
      PineappleAvatarOptions,
      "mood" | "eyeThickness" | "mouthThickness" | "followPointer" | "wobble"
    >
  >;
  destroy(): void;
}

const FACE = {
  left: { x: 0.3536, y: 0.5815 },
  right: { x: 0.6031, y: 0.5746 },
  mouth: { x: 0.4813, y: 0.6575 },
  eyeH: 0.1,
};

const WOBBLE_FILTER_ID = "pineapple-blob-wobble";

function pillEye(side: "left" | "right", thickness: number, glanceX = 0): string {
  const id = side === "left" ? "L" : "R";
  const t = Math.max(0.25, thickness);
  const w = 2.2 + 7.5 * t;
  const h = 18;
  const x = glanceX - w / 2;
  return `<rect class="eye eye-${id}" x="${x.toFixed(2)}" y="${(-h / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h}" rx="${(w / 2).toFixed(2)}" fill="#111"/>`;
}

function eyeMarkup(mood: Mood, side: "left" | "right", thickness: number): string {
  const id = side === "left" ? "L" : "R";
  const t = Math.max(0.25, thickness);
  if (mood === "happy") {
    const sw = (1.6 + 4.2 * t).toFixed(2);
    return `<path class="eye eye-${id}" d="M -8 3 Q 0 -9 8 3" fill="none" stroke="#111" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  if (mood === "thinking") {
    const glance = side === "left" ? 3.2 : 4.2;
    return pillEye(side, thickness, glance);
  }
  return pillEye(side, thickness, 0);
}

function mouthMarkup(mood: Mood, thickness: number): string {
  const t = Math.max(0.25, thickness);
  const sw = (1.2 + 3.6 * t).toFixed(2);
  if (mood === "happy") {
    return `<path class="mouth" d="M -11 0 Q 0 11 11 0" fill="none" stroke="#111" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  if (mood === "thinking") {
    return `<path class="mouth" d="M -7 2 Q 0 0 7 3" fill="none" stroke="#111" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  return `<path class="mouth" d="M -9 0 Q 0 8 9 0" fill="none" stroke="#111" stroke-width="${sw}" stroke-linecap="round"/>`;
}

function renderFace(
  mood: Mood,
  gazeX: number,
  gazeY: number,
  eyeThickness: number,
  mouthThickness: number,
): string {
  const gx = gazeX * 5;
  const gy = gazeY * 4;
  const { left, right, mouth, eyeH } = FACE;
  const to = (p: { x: number; y: number }) => ({ x: p.x * 100, y: p.y * 100 });
  const L = to(left);
  const R = to(right);
  const M = to(mouth);
  const eyeScale = (eyeH * 100) / 18;
  const mouthScale = (eyeH * 100) / 20;

  return `
    <g class="gaze" transform="translate(${gx} ${gy})">
      <g transform="translate(${L.x} ${L.y}) scale(${eyeScale.toFixed(3)})">${eyeMarkup(mood, "left", eyeThickness)}</g>
      <g transform="translate(${R.x} ${R.y}) scale(${eyeScale.toFixed(3)})">${eyeMarkup(mood, "right", eyeThickness)}</g>
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

  const filterSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  filterSvg.classList.add("pineapple-avatar__filters");
  filterSvg.setAttribute("aria-hidden", "true");
  filterSvg.innerHTML = `
    <defs>
      <filter id="${WOBBLE_FILTER_ID}" x="-14%" y="-14%" width="128%" height="128%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="2" result="noise"></feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs>
  `;
  const turbulence = filterSvg.querySelector("feTurbulence")!;
  const displacement = filterSvg.querySelector("feDisplacementMap")!;

  const stage = document.createElement("div");
  stage.className = "pineapple-avatar__stage";

  // Layer 1: yellow body + leaves — ONLY this wobbles
  const bodyWrap = document.createElement("div");
  bodyWrap.className = "pineapple-avatar__body";
  const bodyImg = document.createElement("img");
  bodyImg.className = "pineapple-avatar__art";
  bodyImg.src = new URL("./assets/pineapple-body.png", import.meta.url).href;
  bodyImg.alt = "";
  bodyImg.draggable = false;
  bodyWrap.append(bodyImg);

  // Layer 2: lattice, white V, sparkles — static
  const detailsImg = document.createElement("img");
  detailsImg.className = "pineapple-avatar__art pineapple-avatar__details";
  detailsImg.src = new URL("./assets/pineapple-details.png", import.meta.url).href;
  detailsImg.alt = "";
  detailsImg.draggable = false;

  // Layer 3: eyes / mouth — static positions, mood only
  const face = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  face.classList.add("pineapple-avatar__face");
  face.setAttribute("viewBox", "0 0 100 100");
  face.setAttribute("aria-hidden", "true");

  stage.append(bodyWrap, detailsImg, face);
  host.append(filterSvg, stage);

  const paintFace = () => {
    face.innerHTML = renderFace(mood, gazeX, gazeY, eyeThickness, mouthThickness);
  };

  const applyWobble = (timeSec: number) => {
    const amount = reduced ? 0 : Math.max(0, wobble);

    // Gentle bob on the whole avatar (not blobby)
    const bob = Math.sin(timeSec * 2.2) * 4;
    stage.style.transform = `translateY(${bob.toFixed(2)}px)`;

    // Jelly + fluid displacement — body/leaves only
    const sx = 1 + Math.sin(timeSec * 2.05) * 0.02 * amount;
    const sy = 1 + Math.cos(timeSec * 2.35) * 0.03 * amount;
    const skew = Math.sin(timeSec * 1.55) * 2.6 * amount;
    const slideX = Math.sin(timeSec * 1.1) * 3.8 * amount;
    bodyWrap.style.transform = `translate(${slideX.toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)}) skewX(${skew.toFixed(2)}deg)`;

    if (amount < 0.02) {
      bodyWrap.style.filter = "none";
      displacement.setAttribute("scale", "0");
      return;
    }
    const freqX = 0.01 + amount * 0.005 + Math.sin(timeSec * 0.65) * 0.003 * amount;
    const freqY = 0.014 + amount * 0.007 + Math.cos(timeSec * 0.55) * 0.004 * amount;
    turbulence.setAttribute(
      "baseFrequency",
      `${Math.max(0.004, freqX).toFixed(4)} ${Math.max(0.004, freqY).toFixed(4)}`,
    );
    displacement.setAttribute("scale", (amount * 12).toFixed(2));
    bodyWrap.style.filter = `url(#${WOBBLE_FILTER_ID})`;
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
      return { mood, eyeThickness, mouthThickness, followPointer, wobble };
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      host.replaceChildren();
      host.classList.remove("pineapple-avatar");
    },
  };
}
