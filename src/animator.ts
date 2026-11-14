import "./animator.css";
import {
  applyEyesToFrame,
  detectEyes,
  drawAnimatedEyes,
  sampleEyeMotion,
  type EyePair,
} from "./animator/eyes";
import {
  companionStateMeta,
  type CompanionStateId,
} from "./animator/companionStates";
import { packFromFrameUrls, redrawnStateFrameUrls } from "./animator/loadSheet";
import { exportLottie, exportSvg } from "./animator/exportLottie";
import {
  downloadCanvasPng,
  downloadJson,
  generateSpritesheet,
} from "./animator/packSheet";
import { ANIM_PRESETS, presetById, REDRAWN_ANIM_IDS } from "./animator/presets";
import {
  loadFlatCharacter,
  loadHoodieLayers,
  type LayerImages,
} from "./animator/renderFrame";
import type { AnimId, PackedSpritesheet } from "./animator/types";

type CharacterSource = "hoodie" | "pineapple" | "upload" | "redrawn";

const pineappleUrl = new URL("./assets/pineapple.png", import.meta.url).href;

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="animator">
    <div class="animator__top">
      <h1 class="brand"><a href="/">anana labs</a></h1>
      <a class="nav-back" href="/">← Home</a>
    </div>
    <div class="animator__grid">
      <aside class="panel" aria-label="Controls">
        <h2>Character</h2>
        <div class="seg" role="group" aria-label="Character source">
          <button type="button" data-char="hoodie" aria-pressed="false">Hoodie</button>
          <button type="button" data-char="pineapple" aria-pressed="false">Pineapple</button>
          <button type="button" data-char="redrawn" aria-pressed="true">Redrawn</button>
          <button type="button" data-char="upload" aria-pressed="false">Upload</button>
        </div>
        <label class="field" id="upload-field" hidden style="display: none">
          <span>Image PNG</span>
          <input id="file" type="file" accept="image/png,image/webp,image/jpeg" />
        </label>

        <h2>Animation</h2>
        <div class="seg" role="group" aria-label="Animation">
          ${ANIM_PRESETS.map(
            (p) =>
              `<button type="button" data-anim="${p.id}" aria-pressed="${p.id === "idle"}">${p.label}</button>`,
          ).join("")}
        </div>

        <label class="field">
          <span>Frames</span>
          <input id="frames" type="number" min="4" max="24" value="8" />
        </label>
        <label class="field">
          <span>FPS</span>
          <input id="fps" type="number" min="4" max="30" value="12" />
        </label>
        <label class="field">
          <span>Frame width (px)</span>
          <input id="frame-w" type="number" min="64" max="512" step="16" value="256" />
        </label>

        <button type="button" class="btn btn--primary" id="generate">Generate spritesheet</button>
        <div class="btn-grid">
          <button type="button" class="btn btn--ghost" id="dl-png" disabled>Download PNG</button>
          <button type="button" class="btn btn--ghost" id="dl-json" disabled>Download JSON</button>
          <button type="button" class="btn btn--ghost" id="dl-lottie" disabled>Export Lottie</button>
          <button type="button" class="btn btn--ghost" id="dl-svg" disabled>Export SVG</button>
        </div>
        <p class="status" id="status" aria-live="polite"></p>
      </aside>

      <section class="stage-panel">
        <div class="preview-wrap">
          <div class="preview-stage">
            <img id="preview-base" alt="Animation preview" width="256" height="364" />
            <canvas id="preview-eyes" width="256" height="364" aria-hidden="true"></canvas>
          </div>
        </div>
        <div class="sheet-wrap">
          <canvas id="sheet" width="512" height="364" aria-label="Spritesheet"></canvas>
        </div>
      </section>
    </div>
  </main>
`;

const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const previewBase = document.querySelector<HTMLImageElement>("#preview-base")!;
const previewEyes = document.querySelector<HTMLCanvasElement>("#preview-eyes")!;
const sheetCanvas = document.querySelector<HTMLCanvasElement>("#sheet")!;
const uploadField = document.querySelector<HTMLLabelElement>("#upload-field")!;
const fileInput = document.querySelector<HTMLInputElement>("#file")!;
const framesInput = document.querySelector<HTMLInputElement>("#frames")!;
const fpsInput = document.querySelector<HTMLInputElement>("#fps")!;
const frameWInput = document.querySelector<HTMLInputElement>("#frame-w")!;
const generateBtn = document.querySelector<HTMLButtonElement>("#generate")!;
const dlPngBtn = document.querySelector<HTMLButtonElement>("#dl-png")!;
const dlJsonBtn = document.querySelector<HTMLButtonElement>("#dl-json")!;
const dlLottieBtn = document.querySelector<HTMLButtonElement>("#dl-lottie")!;
const dlSvgBtn = document.querySelector<HTMLButtonElement>("#dl-svg")!;
const charButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-char]")];
const animButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-anim]")];

let character: CharacterSource = "redrawn";
let anim: AnimId = "idle";

function isRedrawnAnim(id: AnimId): id is CompanionStateId {
  return (REDRAWN_ANIM_IDS as AnimId[]).includes(id);
}
let layers: LayerImages | null = null;
let packed: PackedSpritesheet | null = null;
let previewRaf = 0;
let previewStart = 0;
let previewFrameUrls: string[] = [];
let previewEyeCache: Array<EyePair | null> = [];
let previewFw = 256;
let previewFh = 364;
let blobUrls: string[] = [];

function setStatus(msg: string): void {
  statusEl.textContent = msg;
}

function setPressed(buttons: HTMLButtonElement[], attr: string, value: string): void {
  for (const b of buttons) {
    b.setAttribute("aria-pressed", String(b.getAttribute(attr) === value));
  }
}

function canvasToBlobUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not encode preview frame"));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}

async function ensureLayers(): Promise<LayerImages> {
  if (character === "hoodie") {
    layers = await loadHoodieLayers();
  } else if (character === "pineapple") {
    layers = await loadFlatCharacter(pineappleUrl);
  } else if (character === "redrawn") {
    throw new Error("Redrawn mode does not use puppet layers");
  } else if (!layers) {
    throw new Error("Upload a character image first");
  }
  return layers;
}

function stopPreview(): void {
  if (previewRaf) cancelAnimationFrame(previewRaf);
  previewRaf = 0;
  for (const u of previewFrameUrls) URL.revokeObjectURL(u);
  previewFrameUrls = [];
  previewEyeCache = [];
  previewBase.removeAttribute("src");
  const ectx = previewEyes.getContext("2d");
  if (ectx) ectx.clearRect(0, 0, previewEyes.width, previewEyes.height);
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = source.width;
  c.height = source.height;
  c.getContext("2d")!.drawImage(source, 0, 0);
  return c;
}

/** Bake blink/look into sheet cells so downloads aren't stoic either. */
function bakeEyesIntoSheet(sheet: PackedSpritesheet): PackedSpritesheet {
  const { atlas, frames } = sheet;
  const outFrames = frames.map((frame, i) => {
    const copy = cloneCanvas(frame);
    // Spread motion across the sheet so a blink/glance actually appears.
    applyEyesToFrame(copy, sampleEyeMotion(i * 0.55 + 0.1));
    return copy;
  });

  const fw = outFrames[0]!.width;
  const fh = outFrames[0]!.height;
  const columns = atlas.meta.columns;
  const rows = atlas.meta.rows;
  const canvas = document.createElement("canvas");
  canvas.width = columns * fw;
  canvas.height = rows * fh;
  const ctx = canvas.getContext("2d")!;
  for (let i = 0; i < outFrames.length; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    ctx.drawImage(outFrames[i]!, col * fw, row * fh);
  }
  return { canvas, atlas: { ...atlas, frames: atlas.frames }, frames: outFrames };
}

async function startPreview(sheet: PackedSpritesheet): Promise<void> {
  stopPreview();
  const { atlas, frames } = sheet;
  const fps = Math.max(1, atlas.meta.fps);
  if (!frames.length) return;

  // Body frames as <img> (never blank). Eyes draw on a transparent overlay canvas.
  const urls: string[] = [];
  const eyeCache: Array<EyePair | null> = [];
  for (const frame of frames) {
    const probe = cloneCanvas(frame);
    eyeCache.push(detectEyes(probe.getContext("2d")!, probe.width, probe.height));
    urls.push(await canvasToBlobUrl(frame));
  }
  previewFrameUrls = urls;
  previewEyeCache = eyeCache;
  previewFw = frames[0]!.width;
  previewFh = frames[0]!.height;

  previewBase.width = previewFw;
  previewBase.height = previewFh;
  previewEyes.width = previewFw;
  previewEyes.height = previewFh;
  previewBase.src = urls[0]!;

  const ectx = previewEyes.getContext("2d")!;
  previewStart = performance.now();

  let frameIdx = 0;
  const paintEyes = (elapsed: number, idx: number) => {
    ectx.clearRect(0, 0, previewFw, previewFh);
    const eyes = previewEyeCache[idx];
    if (eyes) drawAnimatedEyes(ectx, eyes, sampleEyeMotion(elapsed));
  };

  paintEyes(0, 0);

  const tick = (now: number) => {
    const elapsed = (now - previewStart) / 1000;
    const idx = Math.floor(elapsed * fps) % urls.length;
    if (idx !== frameIdx) {
      frameIdx = idx;
      previewBase.src = urls[idx]!;
    }
    paintEyes(elapsed, frameIdx);
    previewRaf = requestAnimationFrame(tick);
  };
  previewRaf = requestAnimationFrame(tick);
}

function showSheet(sheet: PackedSpritesheet): void {
  sheetCanvas.width = sheet.canvas.width;
  sheetCanvas.height = sheet.canvas.height;
  const ctx = sheetCanvas.getContext("2d")!;
  ctx.clearRect(0, 0, sheetCanvas.width, sheetCanvas.height);
  ctx.drawImage(sheet.canvas, 0, 0);
}

function setDownloadsEnabled(on: boolean): void {
  dlPngBtn.disabled = !on;
  dlJsonBtn.disabled = !on;
  dlLottieBtn.disabled = !on;
  dlSvgBtn.disabled = !on;
}

async function generate(): Promise<void> {
  generateBtn.disabled = true;
  setDownloadsEnabled(false);
  setStatus("");
  try {
    const fps = Math.min(30, Math.max(4, Number(fpsInput.value) || 12));
    const frameWidth = Math.min(512, Math.max(64, Number(frameWInput.value) || 256));
    fpsInput.value = String(fps);
    frameWInput.value = String(frameWidth);

    if (character === "redrawn" && isRedrawnAnim(anim)) {
      const meta = companionStateMeta(anim);
      framesInput.value = "8";
      packed = await packFromFrameUrls(redrawnStateFrameUrls(anim), {
        anim,
        fps: fps || meta.fps,
        frameWidth,
      });
    } else {
      // Attack (and any non-redrawn preset) uses procedural hoodie/pineapple layers.
      const src =
        character === "redrawn"
          ? await loadHoodieLayers()
          : await ensureLayers();
      const frameCount = Math.min(24, Math.max(4, Number(framesInput.value) || 8));
      framesInput.value = String(frameCount);
      packed = generateSpritesheet(src, {
        anim,
        frameCount,
        fps,
        frameWidth,
      });
    }

    // Preview uses raw frames + live eye overlay; sheet/download get baked eyes.
    const raw = packed;
    packed = bakeEyesIntoSheet(raw);
    showSheet(packed);
    await startPreview(raw);
    setDownloadsEnabled(true);
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus(err instanceof Error ? err.message : "Generate failed");
  } finally {
    generateBtn.disabled = false;
  }
}

for (const b of charButtons) {
  b.addEventListener("click", () => {
    character = b.dataset.char as CharacterSource;
    setPressed(charButtons, "data-char", character);
    const showUpload = character === "upload";
    uploadField.hidden = !showUpload;
    uploadField.style.display = showUpload ? "" : "none";
    layers = null;
    setStatus("");
  });
}

for (const b of animButtons) {
  b.addEventListener("click", () => {
    anim = b.dataset.anim as AnimId;
    setPressed(animButtons, "data-anim", anim);
    const preset = presetById(anim);
    framesInput.value = String(preset.defaultFrames);
    void generate();
  });
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  for (const u of blobUrls) URL.revokeObjectURL(u);
  blobUrls = [];
  const url = URL.createObjectURL(file);
  blobUrls.push(url);
  try {
    layers = await loadFlatCharacter(url);
    setStatus("");
  } catch {
    setStatus("Could not load that image");
    layers = null;
  }
});

generateBtn.addEventListener("click", () => void generate());

dlPngBtn.addEventListener("click", () => {
  if (!packed) return;
  downloadCanvasPng(packed.canvas, packed.atlas.meta.image);
});

dlJsonBtn.addEventListener("click", () => {
  if (!packed) return;
  const name = packed.atlas.meta.image.replace(/\.png$/i, ".json");
  downloadJson(packed.atlas, name);
});

dlLottieBtn.addEventListener("click", () => {
  if (!packed) return;
  try {
    exportLottie(packed);
  } catch (err) {
    console.error(err);
    setStatus(err instanceof Error ? err.message : "Lottie export failed");
  }
});

dlSvgBtn.addEventListener("click", () => {
  if (!packed) return;
  try {
    exportSvg(packed);
  } catch (err) {
    console.error(err);
    setStatus(err instanceof Error ? err.message : "SVG export failed");
  }
});

// Default: redrawn idle (AI companion resting state).
void (async () => {
  try {
    setPressed(charButtons, "data-char", "redrawn");
    setPressed(animButtons, "data-anim", "idle");
    await generate();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Load failed");
  }
})();
