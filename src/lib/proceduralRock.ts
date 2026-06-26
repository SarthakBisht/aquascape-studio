import * as THREE from "three";

// Procedural rock geometry: deform an icosahedron with layered 3D value noise so
// each seed yields a unique-but-stable stone. Smooth fbm gives the big bulges &
// dents; a *ridged* fbm (1-|noise|, squared) adds the sharp angular crests real
// stone has; a fine octave roughens the surface. Per-seed frequency/strength
// jitter makes no two rocks look like siblings. The same seed always rebuilds
// the same rock, so we persist a number, not a mesh.

/** Small deterministic PRNG (mulberry32). */
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

const smooth = (t: number) => t * t * (3 - 2 * t);

function hash3(ix: number, iy: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + iz * 1274126177 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/** 3D value noise in [0,1) — trilinear interp of a hashed lattice. */
function vnoise3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const w = smooth(z - zi);
  const c000 = hash3(xi, yi, zi, seed);
  const c100 = hash3(xi + 1, yi, zi, seed);
  const c010 = hash3(xi, yi + 1, zi, seed);
  const c110 = hash3(xi + 1, yi + 1, zi, seed);
  const c001 = hash3(xi, yi, zi + 1, seed);
  const c101 = hash3(xi + 1, yi, zi + 1, seed);
  const c011 = hash3(xi, yi + 1, zi + 1, seed);
  const c111 = hash3(xi + 1, yi + 1, zi + 1, seed);
  const x00 = c000 + (c100 - c000) * u;
  const x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u;
  const x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

/** Smooth multi-octave noise (rounded bulges). */
function fbm3(x: number, y: number, z: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let max = 0;
  for (let o = 0; o < 4; o++) {
    sum += amp * vnoise3(x * freq, y * freq, z * freq, seed + o * 53);
    max += amp;
    freq *= 2;
    amp *= 0.5;
  }
  return sum / max;
}

/** Ridged multi-octave noise (sharp crests) — the angular-rock term. */
function ridged3(x: number, y: number, z: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let max = 0;
  for (let o = 0; o < 4; o++) {
    let n = vnoise3(x * freq, y * freq, z * freq, seed + o * 97);
    n = 1 - Math.abs(n * 2 - 1); // fold → ridge
    sum += amp * n * n;
    max += amp;
    freq *= 2;
    amp *= 0.5;
  }
  return sum / max;
}

export interface RockOptions {
  /** Higher = lumpier / more jagged (Seiryu-like vs smooth river stone). */
  jaggedness?: number;
  /** Base detail of the icosahedron (0-3). */
  detail?: number;
  /** Non-uniform shape bias [x, y, z]; e.g. flat slab vs tall spire. */
  shape?: [number, number, number];
  /** Secondary color streaked into the surface as vertex colors (veins). */
  veinColor?: string;
  /** Horizontal stratification (layered slabs). */
  strata?: boolean;
}

/**
 * Build a rock BufferGeometry. Caller is responsible for disposing it
 * (geometry sits in GPU memory until .dispose()). A per-vertex `color`
 * attribute is baked in (mottling + optional veins/bands) so the flat material
 * color reads as textured stone — the material must enable `vertexColors`.
 */
export function makeRockGeometry(
  seed: number,
  {
    jaggedness = 0.35,
    detail = 3,
    shape = [1, 0.8, 1],
    veinColor,
    strata = false,
  }: RockOptions = {},
): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  // Per-seed domain offsets + frequency/strength jitter → distinct silhouettes.
  const ox = rand() * 50;
  const oy = rand() * 50;
  const oz = rand() * 50;
  const lumpFreq = 1.1 + rand() * 0.9; // big-bulge scale
  const ridgeFreq = 2.0 + rand() * 1.8; // crest density
  const ridgeAmt = 0.55 + rand() * 0.75; // crest prominence
  const detailFreq = 5.5 + rand() * 2.5;
  // Anisotropic noise sampling (independent of `shape`) for extra variety.
  const ax = 0.85 + rand() * 0.4;
  const az = 0.85 + rand() * 0.4;
  const bandFreq = 9 + rand() * 8;
  const nseed = (seed * 2654435761) >>> 0;

  const geo = new THREE.IcosahedronGeometry(0.5, detail);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const sx = (v.x * ax + ox) * 2;
    const sy = v.y * 2 + oy;
    const sz = (v.z * az + oz) * 2;

    const lump = fbm3(sx * lumpFreq, sy * lumpFreq, sz * lumpFreq, nseed);
    const ridge = ridged3(sx * ridgeFreq, sy * ridgeFreq, sz * ridgeFreq, nseed + 7);
    const fine = fbm3(sx * detailFreq, sy * detailFreq, sz * detailFreq, nseed + 19);

    let d =
      1 +
      (lump - 0.5) * jaggedness * 1.5 + // bulges & cavities
      ridge * jaggedness * ridgeAmt + // outward angular crests
      (fine - 0.5) * jaggedness * 0.5; // micro roughness
    if (strata) {
      // sharp horizontal ledges → sedimentary slabs
      const band = Math.abs(((v.y * bandFreq) % 2) - 1); // 0..1 triangle wave
      d += (band - 0.5) * 0.22;
    }
    d = Math.max(0.25, d); // never invert through the center

    v.multiplyScalar(d);
    v.x *= shape[0];
    v.y *= shape[1];
    v.z *= shape[2];
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  geo.computeBoundingBox();
  // Seat the rock so its lowest point rests at y = 0.
  const minY = geo.boundingBox!.min.y;
  geo.translate(0, -minY, 0);

  // Bake per-vertex color: subtle mottling so the flat fill reads as stone,
  // blended toward veinColor along horizontal bands. Multiplies the material
  // base color at render time (material must enable vertexColors).
  geo.computeBoundingBox();
  const bbox = geo.boundingBox!;
  const height = Math.max(1e-3, bbox.max.y - bbox.min.y);
  const colors = new Float32Array(pos.count * 3);
  const vein = veinColor ? new THREE.Color(veinColor) : null;
  const c = new THREE.Color();
  const cr = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const mottle = Math.min(1.15, 0.82 + cr() * 0.3);
    c.setScalar(mottle);
    if (vein) {
      const band = Math.abs(Math.sin((v.y / height) * Math.PI * 6 + ox));
      const streak = band > 0.86 ? (band - 0.86) / 0.14 : 0;
      const amt = Math.min(1, streak * (strata ? 1 : 0.7));
      c.lerp(vein, amt * 0.9);
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return geo;
}

// ponytail: one runnable check — geometry stays finite and seated, two seeds differ.
function demoRock() {
  const a = makeRockGeometry(1, { jaggedness: 0.6, strata: true });
  const b = makeRockGeometry(2, { jaggedness: 0.6, strata: true });
  const pa = a.attributes.position.array as ArrayLike<number>;
  for (let i = 0; i < pa.length; i++) {
    if (!Number.isFinite(pa[i])) throw new Error("NaN vertex in rock geometry");
  }
  a.computeBoundingBox();
  if (Math.abs(a.boundingBox!.min.y) > 1e-4) throw new Error("rock not seated at y=0");
  // Different seeds → different shapes.
  const pb = b.attributes.position.array as ArrayLike<number>;
  let same = true;
  for (let i = 0; i < pa.length; i++) {
    if (Math.abs(pa[i] - pb[i]) > 1e-6) {
      same = false;
      break;
    }
  }
  if (same) throw new Error("two seeds produced identical rocks");
  a.dispose();
  b.dispose();
  console.log("proceduralRock demo OK");
}

if (
  typeof process !== "undefined" &&
  process.argv?.[1] &&
  process.argv[1].includes("proceduralRock")
) {
  demoRock();
}
