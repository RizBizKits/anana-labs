import { samplePose } from "./presets";
import {
  renderFrame,
  scaleFrame,
  stabilizeFrames,
  type LayerImages,
} from "./renderFrame";
import type {
  AnimId,
  FrameRect,
  PackedSpritesheet,
  SpritesheetAtlas,
} from "./types";

export interface PackOptions {
  anim: AnimId;
  frameCount: number;
  fps: number;
  /** Output frame width in px (height keeps aspect). */
  frameWidth: number;
  columns?: number;
}

function bestColumns(n: number): number {
  const root = Math.ceil(Math.sqrt(n));
  for (let c = root; c <= n; c++) {
    if (n % c === 0) return c;
  }
  return root;
}

export function generateSpritesheet(
  layers: LayerImages,
  opts: PackOptions,
): PackedSpritesheet {
  const { anim, frameCount, fps, frameWidth } = opts;
  const columns = opts.columns ?? bestColumns(frameCount);
  const rows = Math.ceil(frameCount / columns);
  const durationMs = Math.round(1000 / fps);

  const raw: HTMLCanvasElement[] = [];
  for (let i = 0; i < frameCount; i++) {
    const t = i / frameCount;
    const pose = samplePose(anim, t);
    raw.push(renderFrame(layers, pose));
  }

  // Shared crop so the character stays planted across frames.
  const stable = stabilizeFrames(raw, 10);
  const frames = stable.map((f) => scaleFrame(f, frameWidth));

  const fw = frames[0]!.width;
  const fh = frames[0]!.height;
  const sheet = document.createElement("canvas");
  sheet.width = columns * fw;
  sheet.height = rows * fh;
  const ctx = sheet.getContext("2d")!;
  ctx.clearRect(0, 0, sheet.width, sheet.height);

  const rects: FrameRect[] = [];
  for (let i = 0; i < frames.length; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = col * fw;
    const y = row * fh;
    ctx.drawImage(frames[i]!, x, y);
    rects.push({
      name: `${anim}_${String(i).padStart(2, "0")}`,
      x,
      y,
      w: fw,
      h: fh,
      durationMs,
    });
  }

  const imageName = `${anim}_spritesheet.png`;
  const atlas: SpritesheetAtlas = {
    meta: {
      image: imageName,
      size: { w: sheet.width, h: sheet.height },
      frameSize: { w: fw, h: fh },
      animation: anim,
      frameCount,
      fps,
      columns,
      rows,
      generator: "anana-labs/local-2d-animator",
    },
    frames: rects,
  };

  return { canvas: sheet, atlas, frames };
}

export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
