import type { PackedSpritesheet } from "./types";

function canvasToPngDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}

function downloadText(contents: string, filename: string, mime: string): void {
  const blob = new Blob([contents], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Lottie image-sequence JSON (embedded PNG frames). Plays in lottie-web / LottieFiles. */
export function buildLottieFromSheet(sheet: PackedSpritesheet): object {
  const { frames, atlas } = sheet;
  const fw = atlas.meta.frameSize.w;
  const fh = atlas.meta.frameSize.h;
  const fps = Math.max(1, atlas.meta.fps);
  const n = frames.length;
  const name = atlas.meta.animation;

  const assets = frames.map((frame, i) => ({
    id: `img_${i}`,
    w: fw,
    h: fh,
    u: "",
    p: canvasToPngDataUrl(frame),
    e: 1,
  }));

  const layers = frames.map((_, i) => ({
    ddd: 0,
    ind: i + 1,
    ty: 2,
    nm: `${name}_${String(i).padStart(2, "0")}`,
    refId: `img_${i}`,
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [fw / 2, fh / 2, 0] },
      a: { a: 0, k: [fw / 2, fh / 2, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    ip: i,
    op: i + 1,
    st: i,
    bm: 0,
  }));

  return {
    v: "5.7.4",
    fr: fps,
    ip: 0,
    op: n,
    w: fw,
    h: fh,
    nm: name,
    ddd: 0,
    assets,
    layers,
  };
}

/** Animated SVG with embedded PNG frames + per-frame CSS opacity windows. */
export function buildAnimatedSvgFromSheet(sheet: PackedSpritesheet): string {
  const { frames, atlas } = sheet;
  const fw = atlas.meta.frameSize.w;
  const fh = atlas.meta.frameSize.h;
  const fps = Math.max(1, atlas.meta.fps);
  const n = frames.length;
  const durationSec = n / fps;
  const name = atlas.meta.animation;
  const step = 100 / n;

  const keyframes = frames
    .map((_, i) => {
      const a = +(i * step).toFixed(4);
      const b = +((i + 1) * step).toFixed(4);
      if (i === 0) {
        return `@keyframes show${i}{0%,${b}%{opacity:1}${b > 99.99 ? "" : `;${b}%,100%{opacity:0}`}}`;
      }
      if (i === n - 1) {
        return `@keyframes show${i}{0%,${a}%{opacity:0};${a}%,100%{opacity:1}}`;
      }
      return `@keyframes show${i}{0%,${a}%{opacity:0};${a}%,${b}%{opacity:1};${b}%,100%{opacity:0}}`;
    })
    .join("");

  const rules = frames
    .map(
      (_, i) =>
        `#f${i}{animation:show${i} ${durationSec}s steps(1,end) infinite}`,
    )
    .join("");

  const images = frames
    .map((frame, i) => {
      const href = canvasToPngDataUrl(frame);
      return `  <image id="f${i}" width="${fw}" height="${fh}" href="${href}" xlink:href="${href}" opacity="${i === 0 ? 1 : 0}"/>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${fw}" height="${fh}" viewBox="0 0 ${fw} ${fh}" role="img" aria-label="${name}">
  <title>${name}</title>
  <style><![CDATA[${keyframes}${rules}]]></style>
${images}
</svg>
`;
}

export function exportLottie(sheet: PackedSpritesheet): void {
  const base = sheet.atlas.meta.animation;
  downloadText(
    JSON.stringify(buildLottieFromSheet(sheet)),
    `${base}.lottie.json`,
    "application/json",
  );
}

export function exportSvg(sheet: PackedSpritesheet): void {
  const base = sheet.atlas.meta.animation;
  downloadText(
    buildAnimatedSvgFromSheet(sheet),
    `${base}.svg`,
    "image/svg+xml",
  );
}
