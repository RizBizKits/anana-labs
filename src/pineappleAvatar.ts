export type Mood = "idle" | "thinking" | "happy";

export interface PineappleAvatarOptions {
  mood?: Mood;
  followPointer?: boolean;
  label?: string;
}

export interface PineappleAvatarHandle {
  update(options: Partial<PineappleAvatarOptions>): void;
  destroy(): void;
}

/** Eye / mouth anchors as fractions of the cropped base art. */
const FACE = {
  left: { x: 0.3585, y: 0.5793 },
  right: { x: 0.5981, y: 0.5726 },
  mouth: { x: 0.4811, y: 0.6532 },
  /** Eye pill size relative to art width */
  eyeW: 0.038,
  eyeH: 0.095,
};

function eyeMarkup(mood: Mood, side: "left" | "right"): string {
  const id = side === "left" ? "L" : "R";
  if (mood === "happy") {
    return `<path class="eye eye-${id}" d="M -7 2 Q 0 -8 7 2" fill="none" stroke="#111" stroke-width="3.2" stroke-linecap="round"/>`;
  }
  if (mood === "thinking") {
    // smaller offset pupils / focused look
    const ox = side === "left" ? 2.5 : 3.5;
    return `<ellipse class="eye eye-${id}" cx="${ox}" cy="-1" rx="3.2" ry="7.5" fill="#111"/>`;
  }
  // idle — vertical pills matching the original art
  return `<rect class="eye eye-${id}" x="-3.2" y="-9" width="6.4" height="18" rx="3.2" fill="#111"/>`;
}

function mouthMarkup(mood: Mood): string {
  if (mood === "happy") {
    return `<path class="mouth" d="M -10 0 Q 0 10 10 0" fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  if (mood === "thinking") {
    return `<path class="mouth" d="M -6 2 Q 0 0 6 3" fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round"/>`;
  }
  return `<path class="mouth" d="M -8 0 Q 0 7 8 0" fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round"/>`;
}

function renderFace(mood: Mood, gazeX: number, gazeY: number): string {
  const gx = gazeX * 5;
  const gy = gazeY * 4;
  const { left, right, mouth, eyeW, eyeH } = FACE;
  // SVG overlay uses viewBox 0 0 100 100 matching the art box
  const to = (p: { x: number; y: number }) => ({ x: p.x * 100, y: p.y * 100 });
  const L = to(left);
  const R = to(right);
  const M = to(mouth);
  const scale = eyeW * 100; // ~3.8 → scale eyes in local units where pill is ~6.4 wide

  return `
    <g class="gaze" transform="translate(${gx} ${gy})">
      <g transform="translate(${L.x} ${L.y}) scale(${(scale / 6.4).toFixed(3)})">${eyeMarkup(mood, "left")}</g>
      <g transform="translate(${R.x} ${R.y}) scale(${(scale / 6.4).toFixed(3)})">${eyeMarkup(mood, "right")}</g>
      <g transform="translate(${M.x} ${M.y}) scale(${(eyeH * 100 / 18).toFixed(3)})">${mouthMarkup(mood)}</g>
    </g>
  `;
}

export function mountPineappleAvatar(
  host: HTMLElement,
  initial: PineappleAvatarOptions = {},
): PineappleAvatarHandle {
  let mood: Mood = initial.mood ?? "idle";
  let followPointer = initial.followPointer ?? true;
  let gazeX = 0;
  let gazeY = 0;
  let raf = 0;
  let targetX = 0;
  let targetY = 0;

  host.replaceChildren();
  host.classList.add("pineapple-avatar");
  host.setAttribute("role", "img");
  host.setAttribute("aria-label", initial.label ?? "Pineapple");

  const stage = document.createElement("div");
  stage.className = "pineapple-avatar__stage";

  const img = document.createElement("img");
  img.className = "pineapple-avatar__art";
  img.src = new URL("./assets/pineapple-base.png", import.meta.url).href;
  img.alt = "";
  img.draggable = false;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("pineapple-avatar__face");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("aria-hidden", "true");

  stage.append(img, svg);
  host.append(stage);

  const paint = () => {
    svg.innerHTML = renderFace(mood, gazeX, gazeY);
  };

  const tick = () => {
    gazeX += (targetX - gazeX) * 0.14;
    gazeY += (targetY - gazeY) * 0.14;
    paint();
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

  paint();
  raf = requestAnimationFrame(tick);
  window.addEventListener("pointermove", onPointer);

  return {
    update(options) {
      if (options.mood) mood = options.mood;
      if (options.followPointer !== undefined) followPointer = options.followPointer;
      if (options.label !== undefined) host.setAttribute("aria-label", options.label);
      if (!followPointer) {
        targetX = 0;
        targetY = 0;
      }
      paint();
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      host.replaceChildren();
      host.classList.remove("pineapple-avatar");
    },
  };
}
