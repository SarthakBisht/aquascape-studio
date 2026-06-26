import * as THREE from "three";
import type { DriftParams } from "./types";

// Procedural branching driftwood: a trunk plus recursive tapered limbs swept as
// tubes, gnarled by a seeded PRNG. Output is one BufferGeometry (manually merged,
// no deps) with baked bark vertex colors, normalized to ~unit size and seated at
// y=0 so the existing scale (~14) and vertexColors material path render it like
// the library wood. Caller disposes (Hardscape pattern).

export const DEFAULT_DRIFT: DriftParams = {
  branches: 4,
  length: 1.1,
  gnarl: 0.45,
  taper: 0.55,
  splits: 1,
  thickness: 0.9,
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RADIAL = 6;

interface Mesh {
  pos: number[];
  idx: number[];
}

/** Sweep a tapered tube of `RADIAL` sides along a poly-line, append to `out`. */
function tubeAlong(points: THREE.Vector3[], r0: number, r1: number, out: Mesh) {
  if (points.length < 2) return;
  const curve = new THREE.CatmullRomCurve3(points);
  const divisions = points.length * 6;
  const frames = curve.computeFrenetFrames(divisions, false);
  const base = out.pos.length / 3;

  for (let i = 0; i <= divisions; i++) {
    const t = i / divisions;
    const p = curve.getPoint(t);
    const r = r0 + (r1 - r0) * t;
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j < RADIAL; j++) {
      const a = (j / RADIAL) * Math.PI * 2;
      const cx = Math.cos(a);
      const sy = Math.sin(a);
      out.pos.push(
        p.x + (N.x * cx + B.x * sy) * r,
        p.y + (N.y * cx + B.y * sy) * r,
        p.z + (N.z * cx + B.z * sy) * r,
      );
    }
  }
  for (let i = 0; i < divisions; i++) {
    for (let j = 0; j < RADIAL; j++) {
      const a = base + i * RADIAL + j;
      const b = base + i * RADIAL + ((j + 1) % RADIAL);
      const c = base + (i + 1) * RADIAL + j;
      const d = base + (i + 1) * RADIAL + ((j + 1) % RADIAL);
      out.idx.push(a, c, b, b, c, d);
    }
  }
}

function buildLimb(
  start: THREE.Vector3,
  dir: THREE.Vector3,
  len: number,
  radius: number,
  depth: number,
  p: DriftParams,
  rand: () => number,
  out: Mesh,
) {
  const segs = 4;
  const points = [start.clone()];
  const d = dir.clone().normalize();
  const pos = start.clone();
  for (let k = 0; k < segs; k++) {
    d.x += (rand() - 0.5) * p.gnarl;
    d.y += (rand() - 0.5) * p.gnarl * 0.6 + 0.04; // gentle upward reach
    d.z += (rand() - 0.5) * p.gnarl;
    d.normalize();
    pos.addScaledVector(d, len / segs);
    points.push(pos.clone());
  }
  const tipR = Math.max(0.012, radius * p.taper);
  tubeAlong(points, radius, tipR, out);

  if (depth < p.splits) {
    const kids = 1 + (rand() < 0.5 ? 1 : 0);
    for (let c = 0; c < kids; c++) {
      const from = points[segs - (c % 2)];
      const cdir = d.clone();
      cdir.x += (rand() - 0.5) * 1.1;
      cdir.z += (rand() - 0.5) * 1.1;
      cdir.y += 0.2;
      buildLimb(from, cdir, len * 0.68, tipR * 1.4, depth + 1, p, rand, out);
    }
  }
}

export function makeDriftwoodGeometry(
  seed: number,
  params: DriftParams = DEFAULT_DRIFT,
): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  const out: Mesh = { pos: [], idx: [] };
  const baseR = 0.06 * params.thickness;

  // Trunk: a short gnarled stump the limbs spring from.
  const trunkTop = new THREE.Vector3(
    (rand() - 0.5) * 0.2,
    params.length * 0.45,
    (rand() - 0.5) * 0.2,
  );
  buildLimb(
    new THREE.Vector3(0, 0, 0),
    trunkTop.clone().normalize(),
    params.length * 0.5,
    baseR * 1.5,
    99, // trunk never splits on its own
    { ...params, splits: 0 },
    rand,
    out,
  );

  // Primary limbs radiating from around the trunk.
  for (let i = 0; i < params.branches; i++) {
    const ang = (i / params.branches) * Math.PI * 2 + rand() * 0.8;
    const startH = trunkTop.clone().multiplyScalar(0.4 + rand() * 0.6);
    const dir = new THREE.Vector3(
      Math.cos(ang),
      0.5 + rand() * 0.6,
      Math.sin(ang),
    );
    buildLimb(startH, dir, params.length * (0.7 + rand() * 0.5), baseR, 0, params, rand, out);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(out.pos, 3),
  );
  geo.setIndex(out.idx);

  // Normalize to ~unit size, seat lowest point at y=0.
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const size = new THREE.Vector3();
  bb.getSize(size);
  const norm = 1.2 / (Math.max(size.x, size.y, size.z) || 1);
  geo.scale(norm, norm, norm);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox!.min.y, 0);

  // Bake bark mottle (multiplied by the material base color; vertexColors on).
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const cr = mulberry32((seed ^ 0x85ebca6b) >>> 0);
  for (let i = 0; i < count; i++) {
    const m = 0.74 + cr() * 0.34;
    colors[i * 3] = m;
    colors[i * 3 + 1] = m * 0.97;
    colors[i * 3 + 2] = m * 0.92;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
