/**
 * Offline frame capture for v1 avatar → same export formats as v2 animator.
 */

import {
  downloadCanvasPng,
  downloadJson,
} from "../animator/packSheet";
import { exportLottie, exportSvg } from "../animator/exportLottie";
import type { PackedSpritesheet, SpritesheetAtlas, FrameRect } from "../animator/types";
import { renderFace, type Mood } from "./pineappleAvatar";

export interface V1ExportOptions {
  mood: Mood;
  eyeThickness: number;
  eyeHeight: number;
  mouthThickness: number;
  wobble: number;
  frameCount?: number;
  fps?: number;
  frameWidth?: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

function svgToImage(svgMarkup: string, size: number): Promise<HTMLImageElement> {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" shape-rendering="geometricPrecision">
${svgMarkup}
</svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  return loadImage(url).finally(() => URL.revokeObjectURL(url));
}

function sampleGaze(mood: Mood, t: number): { x: number; y: number } {
  switch (mood) {
    case "thinking":
      return {
        x: 0.55 + Math.sin(t * 1.8) * 0.12,
        y: -0.15 + Math.sin(t * 2.4) * 0.08,
      };
    case "love":
      return { x: 0, y: 0 };
    case "happy":
      return {
        x: Math.sin(t * 2.1) * 0.15,
        y: Math.sin(t * 1.7) * 0.1,
      };
    case "idle":
    default:
      return {
        x: Math.sin(t * 0.9) * 0.35,
        y: Math.sin(t * 1.1) * 0.22,
      };
  }
}

function bestColumns(n: number): number {
  const root = Math.ceil(Math.sqrt(n));
  for (let c = root; c <= n; c++) {
    if (n % c === 0) return c;
  }
  return root;
}

/** Build a spritesheet of the v1 pineapple + face for the current mood/settings. */
export async function buildV1MoodSheet(
  opts: V1ExportOptions,
): Promise<PackedSpritesheet> {
  const frameCount = Math.min(24, Math.max(4, opts.frameCount ?? 8));
  const fps = Math.min(30, Math.max(6, opts.fps ?? 12));
  const frameWidth = Math.min(512, Math.max(96, opts.frameWidth ?? 256));
  const artUrl = new URL("../assets/pineapple.png", import.meta.url).href;
  const art = await loadImage(artUrl);

  const aspect = art.naturalHeight / art.naturalWidth;
  const fw = frameWidth;
  const fh = Math.round(fw * aspect);
  const pad = Math.round(fw * 0.08);
  const canvasW = fw + pad * 2;
  const canvasH = fh + pad * 2;

  const a = Math.max(0, opts.wobble);
  const frames: HTMLCanvasElement[] = [];

  for (let i = 0; i < frameCount; i++) {
    const t = i / fps;
    const gaze = sampleGaze(opts.mood, t);
    const faceMarkup = renderFace(
      opts.mood,
      gaze.x,
      gaze.y,
      opts.eyeThickness,
      opts.eyeHeight,
      opts.mouthThickness,
    );
    const faceImg = await svgToImage(faceMarkup, 512);

    const bob = Math.sin(t * 2.2) * (4 + a * 2);
    const sx =
      1 + Math.sin(t * 2.05) * 0.03 * a + Math.sin(t * 3.4) * 0.012 * a;
    const sy =
      1 + Math.cos(t * 2.35) * 0.042 * a + Math.cos(t * 4.1) * 0.014 * a;
    const skew =
      Math.sin(t * 1.55) * 3.4 * a + Math.sin(t * 2.8) * 1.2 * a;
    const slideX =
      Math.sin(t * 1.1) * 5 * a + Math.sin(t * 2.6) * 1.8 * a;

    const frame = document.createElement("canvas");
    frame.width = canvasW;
    frame.height = canvasH;
    const ctx = frame.getContext("2d")!;
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.imageSmoothingEnabled = true;

    const cx = canvasW / 2 + slideX * (fw / 220);
    const cy = canvasH / 2 + bob * (fh / 280);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.transform(sx, 0, Math.tan((skew * Math.PI) / 180), sy, 0, 0);
    ctx.drawImage(art, -fw / 2, -fh / 2, fw, fh);
    ctx.drawImage(faceImg, -fw / 2, -fh / 2, fw, fh);
    ctx.restore();

    frames.push(frame);
  }

  const columns = bestColumns(frameCount);
  const rows = Math.ceil(frameCount / columns);
  const durationMs = Math.round(1000 / fps);
  const sheet = document.createElement("canvas");
  sheet.width = columns * canvasW;
  sheet.height = rows * canvasH;
  const sctx = sheet.getContext("2d")!;
  sctx.clearRect(0, 0, sheet.width, sheet.height);

  const rects: FrameRect[] = [];
  for (let i = 0; i < frames.length; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = col * canvasW;
    const y = row * canvasH;
    sctx.drawImage(frames[i]!, x, y);
    rects.push({
      name: `${opts.mood}_${String(i).padStart(2, "0")}`,
      x,
      y,
      w: canvasW,
      h: canvasH,
      durationMs,
    });
  }

  const imageName = `v1_${opts.mood}_spritesheet.png`;
  const atlas: SpritesheetAtlas = {
    meta: {
      image: imageName,
      size: { w: sheet.width, h: sheet.height },
      frameSize: { w: canvasW, h: canvasH },
      animation: `v1_${opts.mood}`,
      frameCount,
      fps,
      columns,
      rows,
      generator: "anana-labs/v1-avatar-export",
    },
    frames: rects,
  };

  return { canvas: sheet, atlas, frames };
}

export function downloadV1Png(sheet: PackedSpritesheet): void {
  downloadCanvasPng(sheet.canvas, sheet.atlas.meta.image);
}

export function downloadV1Json(sheet: PackedSpritesheet): void {
  const name = sheet.atlas.meta.image.replace(/\.png$/i, ".json");
  downloadJson(sheet.atlas, name);
}

export function downloadV1Lottie(sheet: PackedSpritesheet): void {
  exportLottie(sheet);
}

export function downloadV1Svg(sheet: PackedSpritesheet): void {
  exportSvg(sheet);
}
