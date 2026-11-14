import "./avatar.css";
import {
  companionFrameUrls,
  companionStateMeta,
  normalizeCompanionState,
  type CompanionStateAlias,
} from "./animator/companionStates";
import type { SolidMeshHandle } from "./solidMesh";
import {
  HOODIE_FACE,
  applyHoodieLayerMotion,
  bindHoodieLayers,
  hoodieLayersMarkup,
  type HoodieLayerHandles,
} from "./hoodieCharacter";

/** AI companion states for website / agent feedback. */
export const MOODS = [
  { id: "idle", label: "Idle" },
  { id: "thinking", label: "Working" },
  { id: "success", label: "Success" },
  { id: "error", label: "Error" },
] as const;

export type Mood = (typeof MOODS)[number]["id"];
/** `working` is an alias for `thinking`. */
export type MoodInput = Mood | "working";
export type RenderStyle = "flat" | "solid";
export type EyeStyle = "simple" | "emotive";
export type CharacterId = "pineapple" | "hoodie";

export interface PineappleAvatarOptions {
  mood?: MoodInput;
  followPointer?: boolean;
  label?: string;
  eyeThickness?: number;
  eyeHeight?: number;
  mouthThickness?: number;
  wobble?: number;
  /** Flat cutout vs real WebGL inflated mesh. */
  style?: RenderStyle;
  /** Classic black pills vs cartoon white ovals. */
  eyeStyle?: EyeStyle;
  /** Cartoon blink rate. 0 = off, 1 ≈ every ~4s, 2 ≈ every ~2s. */
  blinkFrequency?: number;
  /** Classic fruit vs hoodie outfit character. */
  character?: CharacterId;
  /**
   * Hoodie uses redrawn AI-state sprite loops (idle/working/success/error).
   * Default true for hoodie. Set false to keep the layered puppet + face overlay.
   */
  companionSprites?: boolean;
}

function normalizeMood(mood: MoodInput): Mood {
  return mood === "working" ? "thinking" : mood;
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
      | "style"
      | "eyeStyle"
      | "blinkFrequency"
      | "character"
    >
  >;
  destroy(): void;
}

type FaceLandmarks = {
  left: { x: number; y: number };
  right: { x: number; y: number };
  mouth: { x: number; y: number };
  eyeH: number;
};

const FACE_PINEAPPLE: FaceLandmarks = {
  left: { x: 0.3524, y: 0.5809 },
  right: { x: 0.6024, y: 0.574 },
  mouth: { x: 0.4803, y: 0.657 },
  eyeH: 0.1,
};

const CHARACTERS: Record<
  CharacterId,
  {
    art?: string;
    face: FaceLandmarks;
    ink: string;
    label: string;
    kind: "png" | "layers";
  }
> = {
  pineapple: {
    kind: "png",
    art: new URL("./assets/pineapple.png", import.meta.url).href,
    face: FACE_PINEAPPLE,
    ink: "#111",
    label: "Pineapple",
  },
  hoodie: {
    kind: "layers",
    face: HOODIE_FACE,
    ink: "#fff",
    label: "Hoodie",
  },
};

function pillEye(
  side: "left" | "right",
  thickness: number,
  height: number,
  glanceX = 0,
  glanceY = 0,
  ink = "#111",
): string {
  const id = side === "left" ? "L" : "R";
  const t = Math.max(0.25, thickness);
  const hh = Math.max(0.25, height);
  const w = 2.2 + 7.5 * t;
  const h = 10 + 14 * hh;
  const x = glanceX - w / 2;
  const y = glanceY - h / 2;
  return `<rect class="eye eye-${id}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${(w / 2).toFixed(2)}" fill="${ink}"/>`;
}

function closedEye(
  side: "left" | "right",
  thickness: number,
  height: number,
  ink = "#111",
): string {
  const id = side === "left" ? "L" : "R";
  const sw = (1.6 + 4.2 * Math.max(0.25, thickness)).toFixed(2);
  const rise = 5 + 8 * Math.max(0.25, height);
  return `<path class="eye eye-${id}" d="M -8 3 Q 0 ${(-rise + 3).toFixed(2)} 8 3" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round"/>`;
}

/** 0 = open, 1 = fully closed — eased for cartoon timing. */
function blinkAmount(timeSec: number, frequency: number, reduced: boolean): number {
  if (reduced || frequency <= 0.001) return 0;
  const interval = Math.max(1.1, 5.2 / frequency);
  const t = timeSec % interval;
  const dur = 0.16;
  if (t > dur) return 0;
  const u = t / dur;
  // Ease-in close, ease-out open (holds shut a hair)
  if (u < 0.38) {
    const c = u / 0.38;
    return c * c;
  }
  if (u < 0.5) return 1;
  const o = (u - 0.5) / 0.5;
  return 1 - o * o * (3 - 2 * o);
}

function cartoonClosedEye(
  side: "left" | "right",
  thickness: number,
  height: number,
  ink = "#111",
): string {
  const id = side === "left" ? "L" : "R";
  const t = Math.max(0.25, thickness);
  const hh = Math.max(0.25, height);
  const rx = 4.4 + 3.6 * t;
  const sw = (2 + 3.6 * t).toFixed(2);
  const rise = (5 + 7 * hh).toFixed(2);
  return `<g class="eye eye-${id}">
    <path d="M ${(-rx).toFixed(2)} 2 Q 0 ${(-Number(rise)).toFixed(2)} ${rx.toFixed(2)} 2" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round"/>
  </g>`;
}

/** Classic cartoon eyes: white ovals + bold black pupils (+ tiny spark). */
function emotiveEye(
  mood: Mood,
  side: "left" | "right",
  thickness: number,
  height: number,
  blink = 0,
  ink = "#111",
): string {
  const id = side === "left" ? "L" : "R";
  const t = Math.max(0.25, thickness);
  const hh = Math.max(0.25, height);
  const rx = 4.4 + 3.6 * t;
  const ry = 5.6 + 4.8 * hh;
  const pupil = 2.1 + 1.35 * Math.min(t, hh);
  const b = Math.min(1, Math.max(0, blink));
  // On dark faces (white ink), sclera stays white; lid/pupil strokes use ink.
  const lid = ink === "#fff" ? "#fff" : "#111";
  const pupilFill = ink === "#fff" ? "#1a1a1a" : "#111";
  const scleraStroke = ink === "#fff" ? "rgba(255,255,255,0.35)" : "#111";

  if (mood === "success" || b > 0.82) {
    return cartoonClosedEye(side, thickness, height, lid);
  }

  if (mood === "error") {
    // Worried tilt — pupils drift inward / down a touch.
    const openRy = Math.max(0.4, ry * (1 - b * 0.94));
    const pupilFade = Math.max(0, 1 - b * 1.35);
    const px = side === "left" ? -0.8 : 0.8;
    const py = 1.2;
    return `<g class="eye eye-${id}">
      <ellipse cx="0" cy="0" rx="${rx.toFixed(2)}" ry="${openRy.toFixed(2)}" fill="#fff" stroke="${scleraStroke}" stroke-width="1.15"/>
      <g opacity="${pupilFade.toFixed(2)}">
        <circle class="pupil" cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${pupil.toFixed(2)}" fill="${pupilFill}"/>
        <circle cx="${(px - pupil * 0.35).toFixed(2)}" cy="${(py - pupil * 0.4).toFixed(2)}" r="${(pupil * 0.28).toFixed(2)}" fill="#fff"/>
      </g>
    </g>`;
  }

  let px = 0;
  let py = 0;
  if (mood === "thinking") {
    px = side === "left" ? 1.5 : 1.8;
    py = -1.4;
  }

  const openRy = Math.max(0.4, ry * (1 - b * 0.94));
  const pupilFade = Math.max(0, 1 - b * 1.35);

  return `<g class="eye eye-${id}">
    <ellipse cx="0" cy="0" rx="${rx.toFixed(2)}" ry="${openRy.toFixed(2)}" fill="#fff" stroke="${scleraStroke}" stroke-width="1.15"/>
    <g opacity="${pupilFade.toFixed(2)}">
      <circle class="pupil" cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${pupil.toFixed(2)}" fill="${pupilFill}"/>
      <circle cx="${(px - pupil * 0.35).toFixed(2)}" cy="${(py - pupil * 0.4).toFixed(2)}" r="${(pupil * 0.28).toFixed(2)}" fill="#fff"/>
    </g>
  </g>`;
}

function eyeMarkup(
  mood: Mood,
  side: "left" | "right",
  thickness: number,
  height: number,
  eyeStyle: EyeStyle,
  blink = 0,
  ink = "#111",
): string {
  if (eyeStyle === "emotive") {
    return emotiveEye(mood, side, thickness, height, blink, ink);
  }
  switch (mood) {
    case "success":
      return closedEye(side, thickness, height, ink);
    case "thinking":
      return pillEye(side, thickness, height, side === "left" ? 3.2 : 4.2, -1, ink);
    case "error":
      return pillEye(side, thickness, height, side === "left" ? -1.5 : 1.5, 1.2, ink);
    case "idle":
    default:
      return pillEye(side, thickness, height, 0, 0, ink);
  }
}

function mouthMarkup(mood: Mood, thickness: number, ink = "#111"): string {
  const t = Math.max(0.25, thickness);
  const sw = (1.2 + 3.6 * t).toFixed(2);
  switch (mood) {
    case "success":
      return `<path class="mouth" d="M -11 0 Q 0 11 11 0" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round"/>`;
    case "thinking":
      return `<path class="mouth" d="M -7 2 Q 0 0 7 3" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round"/>`;
    case "error":
      return `<path class="mouth" d="M -9 3 Q 0 -2 9 3" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round"/>`;
    case "idle":
    default:
      return `<path class="mouth" d="M -9 0 Q 0 8 9 0" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
}

function renderFace(
  mood: Mood,
  gazeX: number,
  gazeY: number,
  eyeThickness: number,
  eyeHeight: number,
  mouthThickness: number,
  eyeStyle: EyeStyle,
  blink = 0,
  face: FaceLandmarks = FACE_PINEAPPLE,
  ink = "#111",
): string {
  // Cartoon eyes are bigger — keep gaze subtler so they stay planted
  const gScale = eyeStyle === "emotive" ? 3.5 : 5;
  const gx = gazeX * gScale;
  const gy = gazeY * (eyeStyle === "emotive" ? 2.8 : 4);
  const { left, right, mouth, eyeH } = face;
  const to = (p: { x: number; y: number }) => ({ x: p.x * 100, y: p.y * 100 });
  const L = to(left);
  const R = to(right);
  const M = to(mouth);
  const eyeScale = ((eyeH * 100) / 18) * (eyeStyle === "emotive" ? 1.05 : 1);
  const mouthScale = (eyeH * 100) / 20;
  return `
    <g class="gaze" transform="translate(${gx} ${gy})">
      <g transform="translate(${L.x} ${L.y}) scale(${eyeScale.toFixed(3)})">${eyeMarkup(mood, "left", eyeThickness, eyeHeight, eyeStyle, blink, ink)}</g>
      <g transform="translate(${R.x} ${R.y}) scale(${eyeScale.toFixed(3)})">${eyeMarkup(mood, "right", eyeThickness, eyeHeight, eyeStyle, blink, ink)}</g>
      <g transform="translate(${M.x} ${M.y}) scale(${mouthScale.toFixed(3)})">${mouthMarkup(mood, mouthThickness, ink)}</g>
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
  let mood: Mood = normalizeMood(initial.mood ?? "idle");
  let followPointer = initial.followPointer ?? true;
  let eyeThickness = initial.eyeThickness ?? 1;
  let eyeHeight = initial.eyeHeight ?? 1;
  let mouthThickness = initial.mouthThickness ?? 1;
  let wobble = initial.wobble ?? 0.7;
  let style: RenderStyle = initial.style ?? "flat";
  let eyeStyle: EyeStyle = initial.eyeStyle ?? "emotive";
  let blinkFrequency = initial.blinkFrequency ?? 1;
  let character: CharacterId = initial.character ?? "pineapple";
  let companionSprites = initial.companionSprites ?? true;
  let gazeX = 0;
  let gazeY = 0;
  let raf = 0;
  let targetX = 0;
  let targetY = 0;
  let mesh: SolidMeshHandle | null = null;
  let meshLoading = false;
  let destroyed = false;
  let spriteUrls: string[] = [];
  let spriteIdx = -1;
  let spriteStart = performance.now();
  const reduced = prefersReducedMotion();

  host.replaceChildren();
  host.classList.add("pineapple-avatar");
  host.setAttribute("role", "img");
  host.setAttribute(
    "aria-label",
    initial.label ?? CHARACTERS[character].label,
  );

  const space = document.createElement("div");
  space.className = "pineapple-avatar__space";

  const shadow = document.createElement("div");
  shadow.className = "pineapple-avatar__shadow";

  const stage = document.createElement("div");
  stage.className = "pineapple-avatar__stage";

  const art = document.createElement("img");
  art.className = "pineapple-avatar__art pineapple-avatar__art--flat";
  art.alt = "";
  art.draggable = false;

  const layersHost = document.createElement("div");
  layersHost.className = "pineapple-avatar__layers";

  const volumeRoot = document.createElement("div");
  volumeRoot.className = "pineapple-avatar__volume";

  const face = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  face.classList.add("pineapple-avatar__face");
  face.setAttribute("viewBox", "0 0 100 100");
  face.setAttribute("aria-hidden", "true");
  face.setAttribute("shape-rendering", "geometricPrecision");

  stage.append(art, layersHost, volumeRoot, face);
  space.append(shadow, stage);
  host.append(space);

  let hoodieParts: HoodieLayerHandles | null = null;

  const usingCompanionSprites = () =>
    character === "hoodie" && companionSprites && !reduced;

  const loadCompanionSprites = () => {
    const state = normalizeCompanionState(mood as CompanionStateAlias);
    spriteUrls = companionFrameUrls(state);
    spriteIdx = -1;
    spriteStart = performance.now();
    if (spriteUrls[0]) art.src = spriteUrls[0];
  };

  const syncCharacterArt = () => {
    const def = CHARACTERS[character];
    const sprites = usingCompanionSprites();
    host.classList.toggle("pineapple-avatar--sprites", sprites);
    host.classList.toggle(
      "pineapple-avatar--layers",
      def.kind === "layers" && !sprites,
    );
    hoodieParts = null;
    layersHost.replaceChildren();

    if (sprites) {
      art.style.display = "";
      face.style.display = "none";
      loadCompanionSprites();
      return;
    }

    face.style.display = "";
    spriteUrls = [];
    spriteIdx = -1;

    if (def.kind === "layers") {
      art.removeAttribute("src");
      art.style.display = "none";
      layersHost.innerHTML = hoodieLayersMarkup();
      const root = layersHost.querySelector(".hoodie-layers");
      if (root instanceof HTMLElement) hoodieParts = bindHoodieLayers(root);
    } else {
      art.style.display = "";
      art.src = def.art ?? "";
    }
  };
  syncCharacterArt();

  const syncStyleClass = () => {
    const solidOk = style === "solid" && character === "pineapple";
    host.classList.toggle("pineapple-avatar--solid", solidOk);
  };
  syncStyleClass();

  const paintFace = (timeSec = performance.now() / 1000) => {
    if (usingCompanionSprites()) {
      face.innerHTML = "";
      return;
    }
    const blink =
      eyeStyle === "emotive"
        ? blinkAmount(timeSec, blinkFrequency, reduced)
        : 0;
    const def = CHARACTERS[character];
    face.innerHTML = renderFace(
      mood,
      gazeX,
      gazeY,
      eyeThickness,
      eyeHeight,
      mouthThickness,
      eyeStyle,
      blink,
      def.face,
      def.ink,
    );
  };

  const advanceCompanionSprite = (now: number) => {
    if (!spriteUrls.length) return;
    const fps = companionStateMeta(mood).fps;
    const idx = Math.floor(((now - spriteStart) / 1000) * fps) % spriteUrls.length;
    if (idx !== spriteIdx) {
      spriteIdx = idx;
      art.src = spriteUrls[idx]!;
    }
  };

  const ensureMesh = async () => {
    if (mesh || meshLoading || destroyed || character !== "pineapple") return;
    meshLoading = true;
    const artUrl = CHARACTERS.pineapple.art!;
    try {
      const { createSolidMesh } = await import("./solidMesh");
      const built = await createSolidMesh(volumeRoot, artUrl);
      if (destroyed) {
        built.destroy();
        return;
      }
      if (character !== "pineapple") {
        built.destroy();
        return;
      }
      mesh = built;
      volumeRoot.replaceChildren(built.canvas);
      host.classList.add("pineapple-avatar--solid-ready");
      mesh.setWobble(reduced ? 0 : wobble);
      paintFace();
      built.resize();
    } catch (err) {
      console.warn("Solid mesh failed, staying flat", err);
    } finally {
      meshLoading = false;
    }
  };

  const remesh = () => {
    mesh?.destroy();
    mesh = null;
    host.classList.remove("pineapple-avatar--solid-ready");
    volumeRoot.replaceChildren();
    if (style === "solid" && character === "pineapple") void ensureMesh();
  };

  if (style === "solid" && character === "pineapple") void ensureMesh();

  const softWave = (t: number) => {
    const x = Math.sin(t);
    return x * (0.65 + 0.35 * Math.abs(x));
  };

  const applyFlatMotion = (timeSec: number) => {
    const a = reduced ? 0 : Math.max(0, wobble);
    shadow.style.opacity = "0";

    if (usingCompanionSprites()) {
      // Redrawn loops already carry pose motion — keep a light stage follow only.
      const sway = softWave(timeSec * 1.05 + 0.4) * (0.6 + a * 0.4);
      stage.style.transform = `translate(${(sway * 2 + gazeX * 4).toFixed(2)}px, 0) rotate(${(gazeX * 2.5).toFixed(2)}deg)`;
      face.style.transform = "";
      return;
    }

    if (character === "hoodie" && hoodieParts) {
      const m = applyHoodieLayerMotion(hoodieParts, timeSec, a, reduced);
      stage.style.transform = `rotate(${(gazeX * 3).toFixed(2)}deg)`;
      face.style.transformOrigin = "50% 52%";
      face.style.transform = `translateY(${(-m.bobY).toFixed(2)}px) rotate(${m.tiltDeg.toFixed(2)}deg) scale(${m.squashX.toFixed(4)}, ${m.squashY.toFixed(4)})`;
      return;
    }

    face.style.transform = "";
    const bounce = softWave(timeSec * 2.05);
    const breath = softWave(timeSec * 1.35);
    const sway = softWave(timeSec * 1.15 + 0.5);
    const bob = bounce * (5 + a * 3);
    const sx = 1 + breath * 0.02 * a + bounce * 0.03 * a;
    const sy = 1 - breath * 0.018 * a - bounce * 0.034 * a;
    const rot = sway * (2.5 + a * 2) + gazeX * 3;
    const slideX = sway * (3.5 + a * 2.5);
    stage.style.transform = `translate(${slideX.toFixed(2)}px, ${bob.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
  };

  const tick = () => {
    const now = performance.now();
    const timeSec = now / 1000;
    gazeX += (targetX - gazeX) * 0.08;
    gazeY += (targetY - gazeY) * 0.08;
    if (usingCompanionSprites()) advanceCompanionSprite(now);
    paintFace(timeSec);

    if (style === "solid" && mesh && character === "pineapple") {
      const tiltY = gazeX * 10;
      const tiltX = -gazeY * 6;
      stage.style.transform = `perspective(900px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
      shadow.style.opacity = "0";
      mesh.setPointer(gazeX, gazeY);
      mesh.setWobble(reduced ? 0 : wobble);
      mesh.tick(timeSec);
    } else {
      applyFlatMotion(timeSec);
    }
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

  const onResize = () => mesh?.resize();

  paintFace();
  raf = requestAnimationFrame(tick);
  window.addEventListener("pointermove", onPointer);
  window.addEventListener("resize", onResize);

  return {
    update(options) {
      const prevMood = mood;
      const prevSprites = companionSprites;
      if (options.mood) mood = normalizeMood(options.mood);
      if (options.followPointer !== undefined) followPointer = options.followPointer;
      if (options.eyeThickness !== undefined) eyeThickness = options.eyeThickness;
      if (options.eyeHeight !== undefined) eyeHeight = options.eyeHeight;
      if (options.mouthThickness !== undefined) mouthThickness = options.mouthThickness;
      if (options.wobble !== undefined) wobble = options.wobble;
      if (options.eyeStyle !== undefined) eyeStyle = options.eyeStyle;
      if (options.blinkFrequency !== undefined) blinkFrequency = options.blinkFrequency;
      if (options.companionSprites !== undefined) companionSprites = options.companionSprites;
      if (options.character !== undefined && options.character !== character) {
        character = options.character;
        syncCharacterArt();
        syncStyleClass();
        if (options.label === undefined) {
          host.setAttribute("aria-label", CHARACTERS[character].label);
        }
        remesh();
      } else if (
        options.companionSprites !== undefined &&
        options.companionSprites !== prevSprites
      ) {
        syncCharacterArt();
      } else if (mood !== prevMood && usingCompanionSprites()) {
        loadCompanionSprites();
      }
      if (options.style !== undefined) {
        style = options.style;
        syncStyleClass();
        if (style === "solid" && character === "pineapple") void ensureMesh();
        else {
          host.classList.remove("pineapple-avatar--solid-ready");
          stage.style.transform = "";
        }
      }
      if (options.label !== undefined) host.setAttribute("aria-label", options.label);
      if (!followPointer) {
        targetX = 0;
        targetY = 0;
      }
      if (mesh) mesh.setWobble(reduced ? 0 : wobble);
      paintFace();
    },
    getOptions() {
      return {
        mood,
        eyeThickness,
        eyeHeight,
        mouthThickness,
        followPointer,
        wobble,
        style,
        eyeStyle,
        blinkFrequency,
        character,
      };
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      mesh?.destroy();
      mesh = null;
      host.replaceChildren();
      host.classList.remove(
        "pineapple-avatar",
        "pineapple-avatar--solid",
        "pineapple-avatar--solid-ready",
        "pineapple-avatar--sprites",
        "pineapple-avatar--layers",
      );
    },
  };
}
