import * as THREE from "three";

// Procedural rock geometry: a base primitive displaced by layered 3D value noise.
// Smooth fbm gives the big bulges & dents; a *ridged* fbm (1-|noise|, squared)
// adds the sharp angular crests real stone has; a fine octave roughens it. The
// base primitive (set by the form) decides the silhouette family: an icosahedron
// for convex stones (boulder/slab/spire/shard…), a half-torus for arches, a lathe
// for bowls — so we get genuinely non-convex shapes, not just lumpy spheres.
// Per-seed jitter + taper/flat/tilt make no two rocks siblings. The same seed +
// params always rebuild the same rock, so we persist numbers, not a mesh.

export type RockPrimitive = "icosa" | "lathe" | "torus";

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

/** Build the un-deformed base mesh for a form. */
function buildBase(primitive: RockPrimitive, detail: number): THREE.BufferGeometry {
  if (primitive === "torus") {
    // Half-torus = an arch standing on both feet (arc 0..π, peak up).
    const g = new THREE.TorusGeometry(0.34, 0.15, 12, 48, Math.PI);
    g.computeVertexNormals();
    return g;
  }
  if (primitive === "lathe") {
    // Revolve a U cross-section → a bowl with a real concave interior. The
    // profile starts & ends on the axis (x=0) so the shell closes into a solid.
    const profile = [
      [0.0, 0.02],
      [0.4, 0.02],
      [0.52, 0.1],
      [0.55, 0.45],
      [0.55, 0.6],
      [0.46, 0.6],
      [0.44, 0.32],
      [0.34, 0.16],
      [0.0, 0.2],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.LatheGeometry(profile, 40);
    g.computeVertexNormals();
    return g;
  }
  const g = new THREE.IcosahedronGeometry(0.5, Math.max(0, Math.min(3, detail)));
  g.computeVertexNormals();
  return g;
}

export interface RockOptions {
  /** Base primitive (default icosa). icosa = radial displace (gap-free on the
   *  non-indexed polyhedron); lathe/torus displace along the shared normal. */
  primitive?: RockPrimitive;
  /** Higher = lumpier / more jagged (Seiryu-like vs smooth river stone). */
  jaggedness?: number;
  /** Base detail of the icosahedron (0-3). */
  detail?: number;
  /** Non-uniform shape bias [x, y, z]; e.g. flat slab vs tall spire. */
  shape?: [number, number, number];
  /** Radius scaled by height: + = wide base/anvil, − = wide top/spire. */
  taper?: number;
  /** Planar cleave 0..1 — compresses the top & a side into flat faces. */
  flat?: number;
  /** Small lean 0..1 so the piece isn't axis-symmetric. */
  tilt?: number;
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
    primitive = "icosa",
    jaggedness = 0.35,
    detail = 3,
    shape = [1, 0.8, 1],
    taper = 0,
    flat = 0,
    tilt = 0,
    veinColor,
    strata = false,
  }: RockOptions = {},
): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  // Per-seed domain offsets + frequency/strength jitter → distinct silhouettes.
  const ox = rand() * 50;
  const oy = rand() * 50;
  const oz = rand() * 50;
  const lumpFreq = 1.1 + rand() * 0.9;
  const ridgeFreq = 2.0 + rand() * 1.8;
  const ridgeAmt = 0.55 + rand() * 0.75;
  const detailFreq = 5.5 + rand() * 2.5;
  const ax = 0.85 + rand() * 0.4;
  const az = 0.85 + rand() * 0.4;
  const bandFreq = 9 + rand() * 8;
  const tiltDir = rand() < 0.5 ? 1 : -1;
  const nseed = (seed * 2654435761) >>> 0;

  const geo = buildBase(primitive, detail);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  geo.computeBoundingSphere();
  const R = geo.boundingSphere!.radius || 0.5;
  const useRadial = primitive === "icosa";

  const v = new THREE.Vector3();
  const dir = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Sample noise in a normalized frame so frequency is consistent per primitive.
    const sx = (v.x / R) * ax + ox;
    const sy = v.y / R + oy;
    const sz = (v.z / R) * az + oz;

    const lump = fbm3(sx * lumpFreq, sy * lumpFreq, sz * lumpFreq, nseed);
    const ridge = ridged3(sx * ridgeFreq, sy * ridgeFreq, sz * ridgeFreq, nseed + 7);
    const fine = fbm3(sx * detailFreq, sy * detailFreq, sz * detailFreq, nseed + 19);

    let amp =
      (lump - 0.5) * 1.5 + // bulges & cavities
      ridge * ridgeAmt + // outward angular crests
      (fine - 0.5) * 0.5; // micro roughness
    amp *= jaggedness;
    if (strata) {
      const band = Math.abs(((v.y / R) * bandFreq) % 2) - 1; // triangle wave
      amp += band * 0.18;
    }
    amp += (rand() - 0.5) * jaggedness * 0.15; // grit
    amp *= R;

    // icosa: displace radially (duplicated polyhedron verts share a direction →
    // gap-free). lathe/torus: along the shared vertex normal.
    if (useRadial) {
      dir.copy(v).normalize();
    } else {
      dir.fromBufferAttribute(nrm, i);
    }
    pos.setXYZ(i, v.x + dir.x * amp, v.y + dir.y * amp, v.z + dir.z * amp);
  }

  // --- post-transforms: shape → taper → flat (all on the position attribute) ---
  geo.computeBoundingBox();
  let bb = geo.boundingBox!;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.x *= shape[0];
    v.y *= shape[1];
    v.z *= shape[2];
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  if (taper !== 0 || flat !== 0) {
    geo.computeBoundingBox();
    bb = geo.boundingBox!;
    const minY = bb.min.y;
    const H = Math.max(1e-3, bb.max.y - minY);
    const topCut = bb.max.y - flat * 0.45 * H;
    const botCut = minY + flat * 0.45 * H;
    const keep = 1 - flat; // overshoot kept beyond the cut plane (soft cleave)
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (taper !== 0) {
        const yNorm = (v.y - minY) / H;
        const f = 1 + taper * (yNorm - 0.5);
        v.x *= f;
        v.z *= f;
      }
      if (flat > 0) {
        if (v.y > topCut) v.y = topCut + (v.y - topCut) * keep;
        else if (v.y < botCut) v.y = botCut + (v.y - botCut) * keep;
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }

  // tilt: a small lean so it doesn't read as axis-symmetric.
  if (tilt > 0) {
    geo.rotateZ(tiltDir * tilt * 0.5);
    geo.rotateX(tilt * 0.25);
  }

  geo.computeVertexNormals();
  geo.computeBoundingBox();
  // Seat the rock so its lowest point rests at y = 0.
  geo.translate(0, -geo.boundingBox!.min.y, 0);

  // Bake per-vertex color: subtle mottling so the flat fill reads as stone,
  // blended toward veinColor along horizontal bands. Multiplies the material
  // base color at render time (material must enable vertexColors).
  geo.computeBoundingBox();
  const height = Math.max(1e-3, geo.boundingBox!.max.y - geo.boundingBox!.min.y);
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

// ponytail: one runnable check — every primitive stays finite + seated, and two
// seeds differ. Run: node --experimental-strip-types src/lib/proceduralRock.ts
function demoRock() {
  for (const primitive of ["icosa", "lathe", "torus"] as const) {
    const g = makeRockGeometry(1, {
      primitive,
      jaggedness: 0.6,
      taper: -0.3,
      flat: 0.5,
      tilt: 0.3,
      strata: true,
    });
    const p = g.attributes.position.array as ArrayLike<number>;
    for (let i = 0; i < p.length; i++) {
      if (!Number.isFinite(p[i])) throw new Error(`NaN vertex in ${primitive}`);
    }
    g.computeBoundingBox();
    if (Math.abs(g.boundingBox!.min.y) > 1e-4)
      throw new Error(`${primitive} not seated at y=0`);
    g.dispose();
  }
  const a = makeRockGeometry(1).attributes.position.array as ArrayLike<number>;
  const b = makeRockGeometry(2).attributes.position.array as ArrayLike<number>;
  let same = true;
  for (let i = 0; i < a.length; i++)
    if (Math.abs(a[i] - b[i]) > 1e-6) {
      same = false;
      break;
    }
  if (same) throw new Error("two seeds produced identical rocks");
  console.log("proceduralRock demo OK");
}

if (
  typeof process !== "undefined" &&
  process.argv?.[1] &&
  process.argv[1].includes("proceduralRock")
) {
  demoRock();
}
