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
