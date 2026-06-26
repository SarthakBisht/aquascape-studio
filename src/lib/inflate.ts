// Turn a 2D silhouette mask into a rounded "puffed pillow" height field via a
// chamfer Euclidean distance transform (distance from the silhouette edge),
// shaped into a spherical dome. Feeds meshFromHeightfield for the draw tool.
// No deps. Self-check at the bottom: `npx tsx src/lib/inflate.ts`.

/**
 * @param mask 1 = inside the silhouette, 0 = outside (length w*h).
 * @returns height field in [0,1]; 0 outside, domed toward the interior.
 */
export function inflateMask(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  // 0 distance on background, INF on foreground.
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;

  const ORTHO = 1;
  const DIAG = Math.SQRT2;
  const at = (x: number, y: number) => d[y * w + x];
  const rel = (x: number, y: number, add: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return INF;
    return at(x, y) + add;
  };

  // Forward pass (top-left → bottom-right).
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      d[i] = Math.min(
        d[i],
        rel(x - 1, y, ORTHO),
        rel(x, y - 1, ORTHO),
        rel(x - 1, y - 1, DIAG),
        rel(x + 1, y - 1, DIAG),
      );
    }
  }
  // Backward pass (bottom-right → top-left).
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      d[i] = Math.min(
        d[i],
        rel(x + 1, y, ORTHO),
        rel(x, y + 1, ORTHO),
        rel(x + 1, y + 1, DIAG),
        rel(x - 1, y + 1, DIAG),
      );
    }
  }

  let max = 0;
  for (let i = 0; i < w * h; i++) if (d[i] < INF) max = Math.max(max, d[i]);
  const out = new Float32Array(w * h);
  if (max <= 0) return out;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    const t = d[i] / max; // 0 at edge → 1 at deepest point
    out[i] = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))); // spherical dome
  }
  return out;
}

// --- stone relief: roughen a smooth inflated dome so drawn pieces read as rock,
// not pillows. 2D value noise (bumps) + ridged noise (crests), enveloped by the
// dome height so the silhouette edges stay at 0. Baked into the height field
// before it's persisted, so reload rebuilds the same rocky surface. ---

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
const smooth2 = (t: number) => t * t * (3 - 2 * t);
function vnoise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smooth2(x - xi);
  const v = smooth2(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
}
function fbm2(x: number, y: number, seed: number, ridged: boolean): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  let max = 0;
  for (let o = 0; o < 4; o++) {
    let n = vnoise2(x * f, y * f, seed + o * 71);
    if (ridged) n = 1 - Math.abs(n * 2 - 1);
    sum += amp * n;
    max += amp;
    f *= 2;
    amp *= 0.5;
  }
  return sum / max;
}

/** Add rocky surface relief to an inflated height field. `amount` 0..1. */
export function roughenHeight(
  height: Float32Array,
  w: number,
  h: number,
  seed: number,
  amount = 0.5,
): Float32Array {
  const out = new Float32Array(w * h);
  let max = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const H = height[i];
      if (H <= 0) continue;
      const u = (x / w) * 6;
      const v = (y / h) * 6;
      const bumps = (fbm2(u, v, seed, false) - 0.5) * 1.4;
      const crest = (fbm2(u * 1.5, v * 1.5, seed + 7, true) - 0.3) * 0.8;
      const val = Math.max(0, H * (1 + amount * (bumps + crest)));
      out[i] = val;
      if (val > max) max = val;
    }
  }
  if (max > 0) for (let i = 0; i < w * h; i++) out[i] /= max; // renormalize to [0,1]
  return out;
}

export function demoInflate() {
  const w = 16;
  const h = 16;
  const mask = new Uint8Array(w * h);
  for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) mask[y * w + x] = 1;
  const hf = inflateMask(mask, w, h);
  const center = hf[8 * w + 8];
  const edge = hf[4 * w + 4];
  if (!(center > edge)) throw new Error(`inflate dome failed: ${center} <= ${edge}`);
  if (hf[0] !== 0) throw new Error("outside should be 0");

  // roughen: surface varies (≠ smooth dome) and the silhouette stays at 0.
  const rough = roughenHeight(hf, w, h, 123, 0.6);
  if (rough[0] !== 0) throw new Error("roughen leaked outside the silhouette");
  let diff = 0;
  for (let i = 0; i < w * h; i++) diff += Math.abs(rough[i] - hf[i]);
  if (diff < 1e-3) throw new Error("roughen produced no relief");
  console.log(
    `inflate ok: center=${center.toFixed(3)} edge=${edge.toFixed(3)} reliefΔ=${diff.toFixed(2)}`,
  );
}

if (
  typeof process !== "undefined" &&
  typeof process.argv?.[1] === "string" &&
  process.argv[1].includes("inflate")
) {
  demoInflate();
}
