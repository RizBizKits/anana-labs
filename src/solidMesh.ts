import * as THREE from "three";

export interface SolidMeshHandle {
  canvas: HTMLCanvasElement;
  setPointer(x: number, y: number): void;
  setWobble(amount: number): void;
  tick(timeSec: number): void;
  resize(): void;
  destroy(): void;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function distanceField(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e8;
  const dist = new Float32Array(w * h);
  for (let i = 0; i < mask.length; i++) dist[i] = mask[i] ? INF : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      if (x > 0) dist[i] = Math.min(dist[i]!, dist[i - 1]! + 1);
      if (y > 0) dist[i] = Math.min(dist[i]!, dist[i - w]! + 1);
      if (x > 0 && y > 0) dist[i] = Math.min(dist[i]!, dist[i - w - 1]! + 1.414);
      if (x + 1 < w && y > 0) dist[i] = Math.min(dist[i]!, dist[i - w + 1]! + 1.414);
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!mask[i]) continue;
      if (x + 1 < w) dist[i] = Math.min(dist[i]!, dist[i + 1]! + 1);
      if (y + 1 < h) dist[i] = Math.min(dist[i]!, dist[i + w]! + 1);
      if (x + 1 < w && y + 1 < h) dist[i] = Math.min(dist[i]!, dist[i + w + 1]! + 1.414);
      if (x > 0 && y + 1 < h) dist[i] = Math.min(dist[i]!, dist[i + w - 1]! + 1.414);
    }
  }
  return dist;
}

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        resolve(t);
      },
      undefined,
      () => reject(new Error("texture load failed")),
    );
  });
}

function heightAt(
  dist: Float32Array,
  mask: Uint8Array,
  tw: number,
  th: number,
  maxD: number,
  u: number,
  v: number,
): number {
  const x = Math.min(tw - 1, Math.max(0, Math.round(u * (tw - 1))));
  const y = Math.min(th - 1, Math.max(0, Math.round(v * (th - 1))));
  const i = y * tw + x;
  if (!mask[i]) return 0;
  const t = clamp01(dist[i]! / (maxD * 0.72));
  return Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
}

function buildInflatedGeometry(
  dist: Float32Array,
  mask: Uint8Array,
  tw: number,
  th: number,
  maxD: number,
): THREE.BufferGeometry {
  const gw = 96;
  const gh = Math.max(8, Math.round(gw * (th / tw)));
  const aspect = tw / th;
  const worldH = 2.15;
  const worldW = worldH * aspect;
  const thick = 0.48;

  type Cell = { fi: number; bi: number; u: number; v: number; alive: boolean };
  const grid: Cell[][] = [];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const pushV = (x: number, y: number, z: number, u: number, v: number) => {
    positions.push(x, y, z);
    uvs.push(u, 1 - v);
    return positions.length / 3 - 1;
  };

  for (let j = 0; j < gh; j++) {
    grid[j] = [];
    for (let i = 0; i < gw; i++) {
      const u = i / (gw - 1);
      const v = j / (gh - 1);
      const tx = Math.min(tw - 1, Math.round(u * (tw - 1)));
      const ty = Math.min(th - 1, Math.round(v * (th - 1)));
      const alive = !!mask[ty * tw + tx];
      const h = heightAt(dist, mask, tw, th, maxD, u, v);
      const x = (u - 0.5) * worldW;
      const y = (0.5 - v) * worldH;
      // Thin sticks (arms/legs) get almost-flat extrusion so they don't ghost
      const localThick = thick * (0.35 + 0.65 * h);
      const z = h * localThick;
      if (!alive) {
        grid[j]![i] = { fi: -1, bi: -1, u, v, alive: false };
        continue;
      }
      const fi = pushV(x, y, z, u, v);
      // Skip a real back shell on ultra-thin features (avoids triple-limb ghosts)
      const bi = h < 0.14 ? fi : pushV(x, y, -z * 0.85, u, v);
      grid[j]![i] = { fi, bi, u, v, alive: true };
    }
  }

  const tryQuad = (a: Cell, b: Cell, c: Cell, d: Cell) => {
    if (!a.alive || !b.alive || !c.alive || !d.alive) return;
    indices.push(a.fi, b.fi, d.fi, b.fi, c.fi, d.fi);
    // Only emit back faces when every corner has a distinct back vertex
    if (
      a.bi !== a.fi &&
      b.bi !== b.fi &&
      c.bi !== c.fi &&
      d.bi !== d.fi
    ) {
      indices.push(a.bi, d.bi, b.bi, b.bi, d.bi, c.bi);
    }
  };

  for (let j = 0; j < gh - 1; j++) {
    for (let i = 0; i < gw - 1; i++) {
      tryQuad(grid[j]![i]!, grid[j]![i + 1]!, grid[j + 1]![i + 1]!, grid[j + 1]![i]!);
    }
  }

  // Rim only on medium-edge cells — skip hairline sticks (arms/legs)
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const cell = grid[j]![i]!;
      if (!cell.alive || cell.bi === cell.fi) continue;
      const h = heightAt(dist, mask, tw, th, maxD, cell.u, cell.v);
      if (h > 0.18 || h < 0.08) continue;
      for (const [ni, nj] of [
        [i + 1, j],
        [i, j + 1],
      ] as const) {
        if (ni >= gw || nj >= gh) continue;
        const other = grid[nj]![ni]!;
        if (!other.alive || other.bi === other.fi) continue;
        indices.push(cell.fi, other.fi, other.bi, cell.fi, other.bi, cell.bi);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.normalizeNormals();
  return geo;
}

export async function createSolidMesh(
  host: HTMLElement,
  textureUrl: string,
): Promise<SolidMeshHandle> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("image"));
    el.src = textureUrl;
  });

  const tw = 160;
  const th = Math.max(8, Math.round(tw * (img.naturalHeight / img.naturalWidth)));
  const c = document.createElement("canvas");
  c.width = tw;
  c.height = th;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, tw, th);
  const data = ctx.getImageData(0, 0, tw, th).data;
  // Harder alpha cutoff kills fringe “ghost shells” on thin limbs
  const raw = new Uint8Array(tw * th);
  for (let i = 0, p = 0; i < raw.length; i++, p += 4) {
    raw[i] = (data[p + 3] ?? 0) > 90 ? 1 : 0;
  }
  // One-pixel dilate so skinny arms/legs get enough depth samples
  const mask = new Uint8Array(tw * th);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const i = y * tw + x;
      if (raw[i]) {
        mask[i] = 1;
        continue;
      }
      let hit = 0;
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= tw || ny >= th) continue;
          if (raw[ny * tw + nx]) {
            hit = 1;
            break;
          }
        }
      }
      mask[i] = hit;
    }
  }
  const dist = distanceField(mask, tw, th);
  let maxD = 1;
  for (let i = 0; i < dist.length; i++) if (mask[i] && dist[i]! > maxD) maxD = dist[i]!;

  const texture = await loadTexture(textureUrl);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  camera.position.set(0, 0.05, 4.2);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Keep colors close to the flat art — ACES was crushing the yellow
  renderer.toneMapping = THREE.NoToneMapping;
  const canvas = renderer.domElement;
  canvas.className = "pineapple-avatar__art pineapple-avatar__art--solid";
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.style.display = "block";

  // Bright, even lighting so yellow stays sunny
  const ambient = new THREE.AmbientLight(0xffffff, 1.15);
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(-1.6, 2.8, 4);
  const fill = new THREE.DirectionalLight(0xffffff, 0.55);
  fill.position.set(2.2, 0.8, 2.5);
  const hemi = new THREE.HemisphereLight(0xfff6df, 0x3a2a10, 0.45);
  scene.add(ambient, key, fill, hemi);

  const geo = buildInflatedGeometry(dist, mask, tw, th, maxD);
  // alphaTest (no transparent) + FrontSide: thin limbs stay single-shell
  // instead of ghosted front/back stacks. Mild CSS tilt still reads fine.
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0,
    emissive: new THREE.Color("#201800"),
    emissiveIntensity: 0.18,
    transparent: false,
    alphaTest: 0.5,
    depthWrite: true,
    side: THREE.FrontSide,
  });
  const pineapple = new THREE.Mesh(geo, mat);
  const root = new THREE.Group();
  root.add(pineapple);
  scene.add(root);

  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.68, 48), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.15;
  scene.add(shadow);

  let pointerX = 0;
  let pointerY = 0;
  let wobbleAmt = 0.7;

  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, Math.round(w * (img.naturalHeight / img.naturalWidth)));
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    canvas.style.width = "100%";
    canvas.style.height = "auto";
  };

  if (host.clientWidth < 8) {
    renderer.setSize(280, Math.round(280 * (img.naturalHeight / img.naturalWidth)), false);
  } else {
    resize();
  }

  return {
    canvas,
    setPointer(x, y) {
      pointerX = x;
      pointerY = y;
    },
    setWobble(amount) {
      wobbleAmt = amount;
    },
    tick(timeSec) {
      const a = Math.max(0, wobbleAmt);
      const bob = Math.sin(timeSec * 1.7) * (0.025 + a * 0.035);
      const sx = 1 + Math.sin(timeSec * 2.0) * 0.028 * a;
      const sy = 1 + Math.cos(timeSec * 2.15) * 0.036 * a;
      const sz = 1 + Math.sin(timeSec * 1.9) * 0.02 * a;

      // Subtle turn only — big orbit is done in CSS with the SVG face
      root.rotation.set(-pointerY * 0.12, pointerX * 0.18, Math.sin(timeSec * 1.2) * 0.03 * a);
      root.position.y = bob;
      root.scale.set(sx, sy, sz);

      shadow.scale.set(1.05 / sx, 1, 1.05 / Math.max(0.85, sy));
      shadow.material.opacity = 0.16 + a * 0.05;
      shadow.position.x = pointerX * 0.08;

      key.position.x = -1.6 + pointerX * 0.5;
      key.position.y = 2.8 - pointerY * 0.35;

      renderer.render(scene, camera);
    },
    resize,
    destroy() {
      geo.dispose();
      mat.dispose();
      texture.dispose();
      shadow.geometry.dispose();
      shadowMat.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
