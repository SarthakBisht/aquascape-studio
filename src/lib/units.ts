import type { TankDimensions, Vec3 } from "./types";

// 1 three.js world unit == 1 cm. Keeping a single conversion point here means
// we can rescale the whole scene later without hunting through components.
export const CM = 1;

/** A sensible orbit-camera start position for a given tank size. */
export function defaultCameraPosition(dims: TankDimensions): Vec3 {
  const reach = Math.max(dims.width, dims.height, dims.depth);
  return [dims.width * 0.9, dims.height * 0.85, reach * 1.9];
}

/** Where the camera should look — roughly the visual center of the tank. */
export function tankCenter(dims: TankDimensions): Vec3 {
  return [0, dims.height * 0.45, 0];
}

/** Tank water volume in litres (cm³ / 1000). */
export function tankVolumeL(dims: TankDimensions): number {
  return (dims.width * dims.depth * dims.height) / 1000;
}

// Both UI caps scale with volume so a nano can't be stuffed and a big tank
// isn't starved. Tuned so the default 60×30×36 tank (~65 L) keeps its old
// caps (fish 40, growth 1). ponytail: linear in volume, clamp the ends.
/** Max fish the count slider allows for this tank (~0.6 fish/L, min 6).
 *  ponytail: no upper cap — huge tanks spawn hundreds of meshes; add LOD/
 *  instancing in Fish.tsx if a giant tank chugs. */
export function fishCountLimit(dims: TankDimensions): number {
  return Math.round(Math.max(6, tankVolumeL(dims) * 0.6));
}
/** Max grown-in level (0..1) — small tanks can't fully overgrow. */
export function growthLimit(dims: TankDimensions): number {
  return Math.max(0.4, Math.min(1, tankVolumeL(dims) / 65));
}
