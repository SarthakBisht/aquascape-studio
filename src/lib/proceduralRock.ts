import * as THREE from "three";

// Procedural rock geometry: deform an icosahedron with a few layers of
// value-ish noise so each seed yields a unique-but-stable lump. This is the
// "create your own rock" bridge — the same seed always rebuilds the same rock,
// so we only need to persist a number, not a mesh.

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

/** Cheap multi-octave noise built from summed sines — no deps needed. */
function lumpNoise(p: THREE.Vector3, offsets: number[]): number {
  const [a, b, c, d, e, f] = offsets;
  return (
    Math.sin(p.x * 1.7 + a) * Math.cos(p.y * 1.9 + b) * 0.5 +
    Math.sin(p.y * 3.3 + c) * Math.cos(p.z * 2.7 + d) * 0.25 +
    Math.sin(p.z * 5.1 + e) * Math.cos(p.x * 4.3 + f) * 0.15
  );
}

export interface RockOptions {
  /** Higher = lumpier / more jagged (Seiryu-like vs smooth river stone). */
  jaggedness?: number;
  /** Base detail of the icosahedron (0-3). */
  detail?: number;
  /** Non-uniform shape bias [x, y, z]; e.g. flat slab vs tall spire. */
  shape?: [number, number, number];
}

/**
 * Build a rock BufferGeometry. Caller is responsible for disposing it
 * (geometry sits in GPU memory until .dispose()).
 */
export function makeRockGeometry(
  seed: number,
  { jaggedness = 0.35, detail = 2, shape = [1, 0.8, 1] }: RockOptions = {},
): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  const offsets = Array.from({ length: 6 }, () => rand() * Math.PI * 2);

  const geo = new THREE.IcosahedronGeometry(0.5, detail);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = lumpNoise(v, offsets);
    const displace = 1 + n * jaggedness + (rand() - 0.5) * jaggedness * 0.4;
    v.multiplyScalar(displace);
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
  return geo;
}
