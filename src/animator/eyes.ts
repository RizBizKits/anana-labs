export interface EyeSprite {
  cx: number;
  cy: number;
  /** Original eye pixels only (transparent elsewhere). */
  patch: HTMLCanvasElement;
  coverW: number;
  coverH: number;
}

export interface EyePair {
  left: EyeSprite;
  right: EyeSprite;
  faceRgb: [number, number, number];
}

export interface EyeMotion {
  /** 1 = open, 0 = closed */
  open: number;
  lookX: number;
  lookY: number;
}

function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

function isEyeWhite(r: number, g: number, b: number, a: number): boolean {
  return a > 80 && r > 165 && g > 165 && b > 165 && Math.abs(r - g) < 45 && Math.abs(g - b) < 45;
}

function isFaceGreen(r: number, g: number, b: number, a: number): boolean {
  return a > 80 && g > r + 8 && g >= b && r < 110 && g < 160 && r + g + b < 320;
}

/**
 * Find the two original white pill eyes and copy their pixels into patches
 * so we can animate without changing art style.
 */
export function detectEyes(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): EyePair | null {
  const { data } = ctx.getImageData(0, 0, w, h);

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let has = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3]! > 24) {
        has = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!has) return null;

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const faceTop = minY + Math.floor(bh * 0.16);
  const faceBot = minY + Math.floor(bh * 0.5);
  const faceLeft = minX + Math.floor(bw * 0.26);
  const faceRight = minX + Math.floor(bw * 0.74);

  let fr = 0;
  let fg = 0;
  let fb = 0;
  let fn = 0;
  for (let y = faceTop; y <= faceBot; y++) {
    for (let x = faceLeft; x <= faceRight; x++) {
      const i = (y * w + x) * 4;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = data[i + 3]!;
      if (!isFaceGreen(r, g, b, a)) continue;
      fr += r;
      fg += g;
      fb += b;
      fn++;
    }
  }
  if (fn < 20) {
    fr = 28;
    fg = 72;
    fb = 42;
  } else {
    fr = Math.round(fr / fn);
    fg = Math.round(fg / fn);
    fb = Math.round(fb / fn);
  }

  type Blob = { cells: Array<[number, number]>; cx: number; cy: number };
  const blobs: Blob[] = [];
  const visited = new Uint8Array(w * h);
  const inFace = (x: number, y: number) =>
    x >= faceLeft && x <= faceRight && y >= faceTop && y <= faceBot;

  for (let y = faceTop; y <= faceBot; y++) {
    for (let x = faceLeft; x <= faceRight; x++) {
      const idx = y * w + x;
      if (visited[idx]) continue;
      const i = idx * 4;
      if (!isEyeWhite(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!)) {
        visited[idx] = 1;
        continue;
      }
      const cells: Array<[number, number]> = [];
      let sx = 0;
      let sy = 0;
      const stack = [idx];
      visited[idx] = 1;
      while (stack.length) {
        const p = stack.pop()!;
        const px = p % w;
        const py = (p / w) | 0;
        if (!inFace(px, py)) continue;
        const j = p * 4;
        if (!isEyeWhite(data[j]!, data[j + 1]!, data[j + 2]!, data[j + 3]!)) continue;
        cells.push([px, py]);
        sx += px;
        sy += py;
        for (const [nx, ny] of [
          [px + 1, py],
          [px - 1, py],
          [px, py + 1],
          [px, py - 1],
        ] as const) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (visited[ni]) continue;
          visited[ni] = 1;
          stack.push(ni);
        }
      }
      if (cells.length >= 5 && cells.length < 500) {
        blobs.push({ cells, cx: sx / cells.length, cy: sy / cells.length });
      }
    }
  }

  if (blobs.length < 2) return null;
  blobs.sort((a, b) => a.cx - b.cx);
  // Take leftmost and rightmost substantial blobs
  const leftBlob = blobs[0]!;
  const rightBlob = blobs[blobs.length - 1]!;

  const makeSprite = (blob: Blob): EyeSprite => {
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    for (const [x, y] of blob.cells) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    const pad = 2;
    x0 = Math.max(0, x0 - pad);
    y0 = Math.max(0, y0 - pad);
    x1 = Math.min(w - 1, x1 + pad);
    y1 = Math.min(h - 1, y1 + pad);
    const pw = x1 - x0 + 1;
    const ph = y1 - y0 + 1;
    const patch = document.createElement("canvas");
    patch.width = pw;
    patch.height = ph;
    const pctx = patch.getContext("2d")!;
    const img = pctx.createImageData(pw, ph);
    const cellSet = new Set(blob.cells.map(([x, y]) => `${x},${y}`));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!cellSet.has(`${x},${y}`)) continue;
        // include a 1px fringe of near-white for anti-alias
        const si = (y * w + x) * 4;
        const di = ((y - y0) * pw + (x - x0)) * 4;
        img.data[di] = data[si]!;
        img.data[di + 1] = data[si + 1]!;
        img.data[di + 2] = data[si + 2]!;
        img.data[di + 3] = data[si + 3]!;
      }
    }
    // also copy soft fringe neighbors that are semi-white
    for (const [x, y] of blob.cells) {
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const) {
        if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
        const si = (ny * w + nx) * 4;
        const a = data[si + 3]!;
        const r = data[si]!;
        const g = data[si + 1]!;
        const b = data[si + 2]!;
        if (a < 40 || r + g + b < 400) continue;
        const di = ((ny - y0) * pw + (nx - x0)) * 4;
        if (img.data[di + 3]! > 0) continue;
        img.data[di] = r;
        img.data[di + 1] = g;
        img.data[di + 2] = b;
        img.data[di + 3] = a;
      }
    }
    pctx.putImageData(img, 0, 0);
    return {
      cx: blob.cx,
      cy: blob.cy,
      patch,
      coverW: pw * 0.65,
      coverH: ph * 0.7,
    };
  };

  return {
    left: makeSprite(leftBlob),
    right: makeSprite(rightBlob),
    faceRgb: [fr, fg, fb],
  };
}

/** Continuous blink + gentle glance — original art is reused as the sprite. */
export function sampleEyeMotion(timeSec: number): EyeMotion {
  const blinkEvery = 2.6;
  const phase = timeSec % blinkEvery;
  let open = 1;
  if (phase < 0.08) open = 1 - phase / 0.08;
  else if (phase < 0.14) open = (phase - 0.08) / 0.06;
  const cycle = Math.floor(timeSec / blinkEvery);
  if (cycle % 3 === 1 && phase > 0.22 && phase < 0.34) {
    const p = phase - 0.22;
    open = p < 0.05 ? 1 - p / 0.05 : clamp((p - 0.05) / 0.07, 0, 1);
  }
  open = clamp(open, 0.05, 1);

  // Keep glance subtle so the original eye art still reads.
  const lookX = Math.sin(timeSec * 0.65) * 0.22 + Math.sin(timeSec * 1.7) * 0.08;
  const lookY = Math.sin(timeSec * 0.5 + 0.8) * 0.1;
  return { open, lookX, lookY };
}

/** Face-colored stamp matching the exact original eye silhouette (no green halo). */
function stampFaceLid(
  ctx: CanvasRenderingContext2D,
  eye: EyeSprite,
  faceRgb: [number, number, number],
  x: number,
  y: number,
  scaleY: number,
): void {
  const w = eye.patch.width;
  const h = eye.patch.height;
  const lid = document.createElement("canvas");
  lid.width = w;
  lid.height = h;
  const lctx = lid.getContext("2d")!;
  lctx.fillStyle = `rgb(${faceRgb[0]}, ${faceRgb[1]}, ${faceRgb[2]})`;
  lctx.fillRect(0, 0, w, h);
  lctx.globalCompositeOperation = "destination-in";
  lctx.drawImage(eye.patch, 0, 0);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, scaleY);
  ctx.drawImage(lid, -w / 2, -h / 2);
  ctx.restore();
}

/** Cover baked eyes with the same silhouette, then stamp original patches. */
export function drawAnimatedEyes(
  ctx: CanvasRenderingContext2D,
  eyes: EyePair,
  motion: EyeMotion,
): void {
  const open = Math.max(0.05, motion.open);

  for (const eye of [eyes.left, eyes.right]) {
    const ox = eye.cx + motion.lookX * eye.coverW * 0.45;
    const oy = eye.cy + motion.lookY * eye.coverH * 0.3;

    // Cover the baked eye + act as eyelid — exact original silhouette, no halo.
    stampFaceLid(ctx, eye, eyes.faceRgb, eye.cx, eye.cy, 1);
    if (ox !== eye.cx || oy !== eye.cy) {
      stampFaceLid(ctx, eye, eyes.faceRgb, ox, oy, 1);
    }

    // Original eye pixels, blinked + glanced.
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(1, open);
    ctx.drawImage(eye.patch, -eye.patch.width / 2, -eye.patch.height / 2);
    ctx.restore();
  }
}

/** Apply eye animation onto a frame canvas (mutates / returns same canvas). */
export function applyEyesToFrame(
  frame: HTMLCanvasElement,
  motion: EyeMotion,
  cache?: { eyes: EyePair | null },
): HTMLCanvasElement {
  const ctx = frame.getContext("2d")!;
  const eyes = cache?.eyes ?? detectEyes(ctx, frame.width, frame.height);
  if (cache) cache.eyes = eyes;
  if (!eyes) return frame;
  drawAnimatedEyes(ctx, eyes, motion);
  return frame;
}
