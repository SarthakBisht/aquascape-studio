// Substrate as an editable height field so aquascapers can sculpt free-form
// slopes — hills, valleys, terraces — not just a flat front-to-back ramp. The
// field stores absolute soil depth (cm) per grid cell, row-major with j=0 at
// the FRONT (+z) and j=nz-1 at the BACK (-z), i over width (+x = right).
//
// "Behaves like soil": after every sculpt dab the field is relaxed to its angle
// of repose — wherever a cell sits taller than a neighbour can support, the
// excess slumps downhill, exactly like real substrate piled in a tank.

import type { HeightField } from "./types";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Cell repose angle (degrees) by material — sand slumps shallow, soil holds steep. */
const REPOSE: Record<string, number> = {
  sand: 32,
  gravel: 36,
  aquasoil: 42,
};

/** Grid resolution for a tank, ~3 cm cells, clamped to a sane range. */
export function fieldGrid(w: number, d: number) {
  const nx = Math.min(48, Math.max(12, Math.round(w / 3) + 1));
  const nz = Math.min(32, Math.max(8, Math.round(d / 3) + 1));
  return { nx, nz };
}

/** Clean linear ramp (front depth → back depth) — the baseline before sculpting. */
export function makeLinearField(
  nx: number,
  nz: number,
  front: number,
  back: number,
): HeightField {
  const h = new Array<number>(nx * nz);
  for (let j = 0; j < nz; j++) {
    const t = nz > 1 ? j / (nz - 1) : 0;
    const v = front + (back - front) * t;
    for (let i = 0; i < nx; i++) h[j * nx + i] = v;
  }
  return { nx, nz, h };
}

/** Bilinear height at normalized (u,v): u 0→1 left→right, v 0→1 front→back. */
export function sampleField(f: HeightField, u: number, v: number): number {
  const { nx, nz, h } = f;
  const fx = clamp01(u) * (nx - 1);
  const fz = clamp01(v) * (nz - 1);
  const i0 = Math.floor(fx);
  const j0 = Math.floor(fz);
  const i1 = Math.min(i0 + 1, nx - 1);
  const j1 = Math.min(j0 + 1, nz - 1);
  const tx = fx - i0;
  const tz = fz - j0;
  const a = h[j0 * nx + i0];
  const b = h[j0 * nx + i1];
  const c = h[j1 * nx + i0];
  const e = h[j1 * nx + i1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + e * tx) * tz;
}

/**
 * Raise (delta>0) or carve (delta<0) the field with a soft circular brush, then
 * relax to the material's angle of repose. World extents (innerW × innerD, cm)
 * map the brush; heights are clamped to [0, maxDepth].
 */
export function sculptField(
  f: HeightField,
  type: string,
  innerW: number,
  innerD: number,
  px: number,
  pz: number,
  radius: number,
  delta: number,
  maxDepth: number,
): HeightField {
  const { nx, nz } = f;
  const h = f.h.slice();
  const r2 = radius * radius;
  for (let j = 0; j < nz; j++) {
    const cz = (0.5 - j / (nz - 1)) * innerD; // world z of this row
    for (let i = 0; i < nx; i++) {
      const cx = (i / (nx - 1) - 0.5) * innerW; // world x of this col
      const dx = cx - px;
      const dz = cz - pz;
      const dist2 = dx * dx + dz * dz;
      if (dist2 > r2) continue;
      const fall = Math.exp((-dist2 / r2) * 2.2); // gaussian-ish
      const k = j * nx + i;
      h[k] = Math.max(0, Math.min(maxDepth, h[k] + delta * fall));
    }
  }
  return relax({ nx, nz, h }, type, innerW, innerD);
}

/** Slump any over-steep neighbour pairs toward the angle of repose (in place). */
// ponytail: Gauss-Seidel, 6 iterations per dab. A drag = many dabs so steep
// piles settle progressively (feels like real slumping). Bump iterations if a
// single dab must fully settle in one shot.
export function relax(
  f: HeightField,
  type: string,
  innerW: number,
  innerD: number,
  iterations = 6,
): HeightField {
  const { nx, nz } = f;
  const h = f.h;
  const cellW = innerW / (nx - 1);
  const cellD = innerD / (nz - 1);
  const tan = Math.tan(((REPOSE[type] ?? 38) * Math.PI) / 180);
  const stepX = cellW * tan;
  const stepZ = cellD * tan;
  for (let it = 0; it < iterations; it++) {
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * nx + i;
        if (i + 1 < nx) settle(h, a, a + 1, stepX);
        if (j + 1 < nz) settle(h, a, a + nx, stepZ);
      }
    }
  }
  return f;
}

function settle(h: number[], a: number, b: number, maxStep: number) {
  const diff = h[a] - h[b];
  const over = Math.abs(diff) - maxStep;
  if (over <= 0) return;
  const move = over * 0.5;
  if (diff > 0) {
    h[a] -= move;
    h[b] += move;
  } else {
    h[a] += move;
    h[b] -= move;
  }
}
