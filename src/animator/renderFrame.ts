import { HOODIE_PIVOTS } from "../hoodieCharacter";
import type { CharacterPose, LayerPose, Vec2 } from "./types";

export interface LayerImages {
  body: HTMLCanvasElement | HTMLImageElement;
  armL?: HTMLCanvasElement | HTMLImageElement | null;
  armR?: HTMLCanvasElement | HTMLImageElement | null;
  /** Natural pixel size of the source art (all layers share this). */
  width: number;
  height: number;
}

/** Extra margin so rotated arms / squash never clip the frame. */
export const FRAME_PAD = 48;

function sourceSize(img: CanvasImageSource): { w: number; h: number } {
  if (img instanceof HTMLImageElement) {
    return { w: img.naturalWidth, h: img.naturalHeight };
  }
  if (img instanceof HTMLCanvasElement) {
    return { w: img.width, h: img.height };
  }
  if (img instanceof ImageBitmap) {
    return { w: img.width, h: img.height };
  }
  return { w: 0, h: 0 };
}

/**
 * Soft-edge cleanup: drop near-black / fringe pixels that are barely opaque.
 * Keeps the cutouts from showing yellow halos when composited.
 */
export function cleanLayerAlpha(
  img: HTMLImageElement | HTMLCanvasElement,
  threshold = 28,
): HTMLCanvasElement {
  const { w, h } = sourceSize(img);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3]!;
    if (a < threshold) {
      px[i + 3] = 0;
      continue;
    }
    // Kill dark fringe that came from black-background removals
    const r = px[i]!;
    const g = px[i + 1]!;
    const b = px[i + 2]!;
    if (a < 90 && r + g + b < 60) {
      px[i + 3] = 0;
    }
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

function applyLocal(
  ctx: CanvasRenderingContext2D,
  pose: LayerPose,
  pivot: Vec2,
  w: number,
  h: number,
): void {
  const px = pivot.x * w;
  const py = pivot.y * h;
  ctx.translate(pose.x, pose.y);
  ctx.translate(px, py);
  ctx.rotate(pose.rot);
  ctx.scale(pose.sx, pose.sy);
  ctx.translate(-px, -py);
}

/**
 * Hierarchical render: body transform parents the arms so shoulders stay attached.
 * Canvas is padded so swings don't clip.
 */
export function renderFrame(
  layers: LayerImages,
  pose: CharacterPose,
): HTMLCanvasElement {
  const { width: w, height: h } = layers;
  const pad = FRAME_PAD;
  const canvas = document.createElement("canvas");
  canvas.width = w + pad * 2;
  canvas.height = h + pad * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.save();
  ctx.translate(pad, pad);

  // Body parent space
  applyLocal(ctx, pose.body, HOODIE_PIVOTS.chest, w, h);

  // Arms first (under body), local to shoulders inside body space
  if (layers.armL) {
    ctx.save();
    applyLocal(ctx, pose.armL, HOODIE_PIVOTS.shoulderL, w, h);
    ctx.drawImage(layers.armL, 0, 0, w, h);
    ctx.restore();
  }
  if (layers.armR) {
    ctx.save();
    applyLocal(ctx, pose.armR, HOODIE_PIVOTS.shoulderR, w, h);
    ctx.drawImage(layers.armR, 0, 0, w, h);
    ctx.restore();
  }

  ctx.drawImage(layers.body, 0, 0, w, h);
  ctx.restore();

  return canvas;
}

/** Scale a rendered frame down for lighter sheets / preview. */
export function scaleFrame(
  source: HTMLCanvasElement,
  targetW: number,
): HTMLCanvasElement {
  const targetH = Math.round((source.height / source.width) * targetW);
  const out = document.createElement("canvas");
  out.width = targetW;
  out.height = targetH;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return out;
}

/**
 * Crop every frame to the same opaque union bbox (plus margin) so the
 * character doesn't jitter in the sheet / preview.
 */
export function stabilizeFrames(
  frames: HTMLCanvasElement[],
  margin = 8,
): HTMLCanvasElement[] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const frame of frames) {
    const ctx = frame.getContext("2d")!;
    const { data, width, height } = ctx.getImageData(0, 0, frame.width, frame.height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3]! > 16) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  if (!Number.isFinite(minX)) return frames;

  minX = Math.max(0, minX - margin);
  minY = Math.max(0, minY - margin);
  maxX = Math.min(frames[0]!.width - 1, maxX + margin);
  maxY = Math.min(frames[0]!.height - 1, maxY + margin);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;

  return frames.map((frame) => {
    const out = document.createElement("canvas");
    out.width = cw;
    out.height = ch;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(frame, minX, minY, cw, ch, 0, 0, cw, ch);
    return out;
  });
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

export async function loadHoodieLayers(): Promise<LayerImages> {
  const bodyUrl = new URL("../assets/hoodie-body.png", import.meta.url).href;
  const armLUrl = new URL("../assets/hoodie-arm-l.png", import.meta.url).href;
  const armRUrl = new URL("../assets/hoodie-arm-r.png", import.meta.url).href;
  const [bodyImg, armLImg, armRImg] = await Promise.all([
    loadImage(bodyUrl),
    loadImage(armLUrl),
    loadImage(armRUrl),
  ]);
  const body = cleanLayerAlpha(bodyImg);
  const armL = cleanLayerAlpha(armLImg);
  const armR = cleanLayerAlpha(armRImg);
  return {
    body,
    armL,
    armR,
    width: body.width,
    height: body.height,
  };
}

export async function loadFlatCharacter(url: string): Promise<LayerImages> {
  const bodyImg = await loadImage(url);
  const body = cleanLayerAlpha(bodyImg, 20);
  return {
    body,
    armL: null,
    armR: null,
    width: body.width,
    height: body.height,
  };
}
