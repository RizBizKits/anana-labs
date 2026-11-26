import "../style.css";
import {
  mountPineappleAvatar,
  MOODS,
  type Mood,
  type PineappleAvatarHandle,
  type RenderStyle,
} from "./pineappleAvatar";
import {
  loadSettings,
  previewHref,
  saveSettings,
  type AvatarSettings,
} from "./avatarSettings";
import {
  buildV1MoodSheet,
  downloadV1Json,
  downloadV1Lottie,
  downloadV1Png,
  downloadV1Svg,
} from "./exportAvatar";
import type { PackedSpritesheet } from "../animator/types";

const initial = loadSettings();

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="stage">
    <div class="stage-top">
      <h1 class="brand"><a href="/">anana labs</a></h1>
      <a class="nav-back" href="/">← Home</a>
    </div>
    <div class="avatar-shell" aria-label="Pineapple avatar">
      <div id="bot"></div>
    </div>
    <div class="controls" role="group" aria-label="Mood">
      ${MOODS.map(
        (m, i) =>
          `<button type="button" data-mood="${m.id}" aria-pressed="${i === 0}">${m.label}</button>`,
      ).join("")}
    </div>
    <div class="controls controls--style" role="group" aria-label="Render style">
      <button type="button" data-style="flat" aria-pressed="${initial.style === "flat"}">Flat</button>
      <button type="button" data-style="solid" aria-pressed="${initial.style === "solid"}">Solid</button>
    </div>
    <div class="sliders" role="group" aria-label="Avatar controls">
      <label class="slider">
        <span>Eye width <output id="eye-out">${initial.eyeThickness.toFixed(2)}</output></span>
        <input id="eye-thickness" type="range" min="0.25" max="2.5" step="0.05" value="${initial.eyeThickness}" />
      </label>
      <label class="slider">
        <span>Eye height <output id="eye-height-out">${initial.eyeHeight.toFixed(2)}</output></span>
        <input id="eye-height" type="range" min="0.25" max="2.5" step="0.05" value="${initial.eyeHeight}" />
      </label>
      <label class="slider">
        <span>Mouth width <output id="mouth-out">${initial.mouthThickness.toFixed(2)}</output></span>
        <input id="mouth-thickness" type="range" min="0.25" max="2.5" step="0.05" value="${initial.mouthThickness}" />
      </label>
      <label class="slider">
        <span>Blob wobble <output id="wobble-out">${initial.wobble.toFixed(2)}</output></span>
        <input id="wobble" type="range" min="0" max="2" step="0.05" value="${initial.wobble}" />
      </label>
    </div>
    <div class="export-panel" aria-label="Export">
      <button type="button" class="btn btn--primary" id="export-build">Generate spritesheet</button>
      <div class="btn-grid">
        <button type="button" class="btn btn--ghost" id="dl-png" disabled>Download PNG</button>
        <button type="button" class="btn btn--ghost" id="dl-json" disabled>Download JSON</button>
        <button type="button" class="btn btn--ghost" id="dl-lottie" disabled>Export Lottie</button>
        <button type="button" class="btn btn--ghost" id="dl-svg" disabled>Export SVG</button>
      </div>
    </div>
    <div class="meta">
      <p class="status" id="status" aria-live="polite">Idle</p>
      <p><a class="preview-link" id="preview-link" href="${previewHref(initial)}">Preview</a></p>
    </div>
  </main>
`;

const host = document.querySelector<HTMLDivElement>("#bot")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const previewLink = document.querySelector<HTMLAnchorElement>("#preview-link")!;
const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-mood]")];
const styleButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-style]")];
const eyeInput = document.querySelector<HTMLInputElement>("#eye-thickness")!;
const eyeHeightInput = document.querySelector<HTMLInputElement>("#eye-height")!;
const mouthInput = document.querySelector<HTMLInputElement>("#mouth-thickness")!;
const wobbleInput = document.querySelector<HTMLInputElement>("#wobble")!;
const eyeOut = document.querySelector<HTMLOutputElement>("#eye-out")!;
const eyeHeightOut = document.querySelector<HTMLOutputElement>("#eye-height-out")!;
const mouthOut = document.querySelector<HTMLOutputElement>("#mouth-out")!;
const wobbleOut = document.querySelector<HTMLOutputElement>("#wobble-out")!;
const exportBuildBtn = document.querySelector<HTMLButtonElement>("#export-build")!;
const dlPngBtn = document.querySelector<HTMLButtonElement>("#dl-png")!;
const dlJsonBtn = document.querySelector<HTMLButtonElement>("#dl-json")!;
const dlLottieBtn = document.querySelector<HTMLButtonElement>("#dl-lottie")!;
const dlSvgBtn = document.querySelector<HTMLButtonElement>("#dl-svg")!;

let style: RenderStyle = initial.style;
let currentMood: Mood = "idle";
let packed: PackedSpritesheet | null = null;

function setDownloadsEnabled(on: boolean): void {
  dlPngBtn.disabled = !on;
  dlJsonBtn.disabled = !on;
  dlLottieBtn.disabled = !on;
  dlSvgBtn.disabled = !on;
}

const avatar = mountPineappleAvatar(host, {
  mood: "idle",
  followPointer: true,
  label: "Pineapple",
  ...initial,
  style,
});

function readSettings(): AvatarSettings {
  return {
    eyeThickness: Number(eyeInput.value),
    eyeHeight: Number(eyeHeightInput.value),
    mouthThickness: Number(mouthInput.value),
    wobble: Number(wobbleInput.value),
    style,
  };
}

function setMood(mood: Mood) {
  currentMood = mood;
  avatar.update({ mood });
  status.textContent = mood[0]!.toUpperCase() + mood.slice(1);
  for (const btn of buttons) {
    btn.setAttribute("aria-pressed", String(btn.dataset.mood === mood));
  }
  // Settings/mood changed — previous sheet may no longer match.
  packed = null;
  setDownloadsEnabled(false);
}

function setStyle(next: RenderStyle) {
  style = next;
  for (const btn of styleButtons) {
    btn.setAttribute("aria-pressed", String(btn.dataset.style === next));
  }
  syncControls();
}

function syncControls() {
  const settings = readSettings();
  eyeOut.value = settings.eyeThickness.toFixed(2);
  eyeHeightOut.value = settings.eyeHeight.toFixed(2);
  mouthOut.value = settings.mouthThickness.toFixed(2);
  wobbleOut.value = settings.wobble.toFixed(2);
  avatar.update(settings);
  saveSettings(settings);
  previewLink.href = previewHref(settings);
  packed = null;
  setDownloadsEnabled(false);
}

async function generateExport(): Promise<void> {
  exportBuildBtn.disabled = true;
  setDownloadsEnabled(false);
  const settings = readSettings();
  status.textContent = `Exporting ${currentMood}…`;
  try {
    packed = await buildV1MoodSheet({
      mood: currentMood,
      eyeThickness: settings.eyeThickness,
      eyeHeight: settings.eyeHeight,
      mouthThickness: settings.mouthThickness,
      wobble: settings.wobble,
      frameCount: 8,
      fps: 12,
      frameWidth: 256,
    });
    setDownloadsEnabled(true);
    status.textContent =
      style === "solid"
        ? `${currentMood[0]!.toUpperCase()}${currentMood.slice(1)} sheet ready (flat composite)`
        : `${currentMood[0]!.toUpperCase()}${currentMood.slice(1)} sheet ready`;
  } catch (err) {
    console.error(err);
    packed = null;
    status.textContent = err instanceof Error ? err.message : "Export failed";
  } finally {
    exportBuildBtn.disabled = false;
  }
}

for (const btn of buttons) {
  btn.addEventListener("click", () => setMood(btn.dataset.mood as Mood));
}
for (const btn of styleButtons) {
  btn.addEventListener("click", () => setStyle(btn.dataset.style as RenderStyle));
}
eyeInput.addEventListener("input", syncControls);
eyeHeightInput.addEventListener("input", syncControls);
mouthInput.addEventListener("input", syncControls);
wobbleInput.addEventListener("input", syncControls);

exportBuildBtn.addEventListener("click", () => void generateExport());
dlPngBtn.addEventListener("click", () => {
  if (!packed) return;
  downloadV1Png(packed);
});
dlJsonBtn.addEventListener("click", () => {
  if (!packed) return;
  downloadV1Json(packed);
});
dlLottieBtn.addEventListener("click", () => {
  if (!packed) return;
  try {
    downloadV1Lottie(packed);
  } catch (err) {
    console.error(err);
    status.textContent = err instanceof Error ? err.message : "Lottie export failed";
  }
});
dlSvgBtn.addEventListener("click", () => {
  if (!packed) return;
  try {
    downloadV1Svg(packed);
  } catch (err) {
    console.error(err);
    status.textContent = err instanceof Error ? err.message : "SVG export failed";
  }
});

saveSettings(initial);
previewLink.href = previewHref(initial);

declare global {
  interface Window {
    pineappleAvatarV1: PineappleAvatarHandle;
    setPineappleMoodV1: (mood: Mood) => void;
  }
}
window.pineappleAvatarV1 = avatar;
window.setPineappleMoodV1 = setMood;
