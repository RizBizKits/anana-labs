import {
  companionFrameUrls,
  normalizeCompanionState,
  type CompanionStateAlias,
  type CompanionStateId,
} from "./companionStates";
import type { AnimId, FrameRect, PackedSpritesheet, SpritesheetAtlas } from "./types";
import { loadImage } from "./renderFrame";

export async function packFromFrameUrls(
  urls: string[],
  opts: { anim: AnimId; fps: number; frameWidth?: number },
): Promise<PackedSpritesheet> {
  const images = await Promise.all(urls.map((u) => loadImage(u)));
  const targetW = opts.frameWidth ?? images[0]!.naturalWidth;
  const frames: HTMLCanvasElement[] = images.map((img) => {
    const h = Math.round((img.naturalHeight / img.naturalWidth) * targetW);
    const c = document.createElement("canvas");
    c.width = targetW;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, targetW, h);
    return c;
  });

  const fw = frames[0]!.width;
  const fh = frames[0]!.height;
  const columns = frames.length;
  const sheet = document.createElement("canvas");
  sheet.width = columns * fw;
  sheet.height = fh;
  const ctx = sheet.getContext("2d")!;
  const durationMs = Math.round(1000 / opts.fps);
  const rects: FrameRect[] = [];

  for (let i = 0; i < frames.length; i++) {
    const x = i * fw;
    ctx.drawImage(frames[i]!, x, 0);
    rects.push({
      name: `${opts.anim}_${String(i).padStart(2, "0")}`,
      x,
      y: 0,
      w: fw,
      h: fh,
      durationMs,
    });
  }

  const atlas: SpritesheetAtlas = {
    meta: {
      image: `${opts.anim}_spritesheet.png`,
      size: { w: sheet.width, h: sheet.height },
      frameSize: { w: fw, h: fh },
      animation: opts.anim,
      frameCount: frames.length,
      fps: opts.fps,
      columns,
      rows: 1,
      generator: "anana-labs/cursor-redrawn",
    },
    frames: rects,
  };

  return { canvas: sheet, atlas, frames };
}

/** Built-in redrawn walk cycle (Cursor image/video gen → extracted frames). */
export function redrawnWalkFrameUrls(): string[] {
  return companionFrameUrls("walk");
}

/** Any redrawn AI-companion state pack. */
export function redrawnStateFrameUrls(
  state: CompanionStateAlias | CompanionStateId,
): string[] {
  return companionFrameUrls(normalizeCompanionState(state));
}
