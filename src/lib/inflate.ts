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
  console.log(`inflate ok: center=${center.toFixed(3)} edge=${edge.toFixed(3)}`);
}

if (
  typeof process !== "undefined" &&
  typeof process.argv?.[1] === "string" &&
  process.argv[1].includes("inflate")
) {
  demoInflate();
}
