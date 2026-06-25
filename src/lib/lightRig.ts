import * as THREE from "three";
import { kelvinToRgb } from "./lightColor";
import type { LightFixture } from "./types";

// Shared helpers so the underwater visuals (water tint, god-ray shafts,
// caustics) all respond to the SAME light rig — the actual fixtures' type,
// color, intensity, and position — instead of a hardcoded look.

/** A fixture's emitted color: kelvin→rgb for spot/flood, the picked hue for rgb. */
export function fixtureColor(l: LightFixture): THREE.Color {
  return l.type === "rgb" ? new THREE.Color(l.color) : kelvinToRgb(l.kelvin);
}

export interface RigSummary {
  /** On-fixtures with non-zero intensity. */
  active: LightFixture[];
  /** Sum of active intensities. */
  intensity: number;
  /** Intensity-weighted average color of the active fixtures (white if none). */
  color: THREE.Color;
  /** Intensity-weighted average X/Z position (0,0 if none). */
  centerX: number;
  centerZ: number;
}

export function summarizeRig(lights: LightFixture[]): RigSummary {
  const active = lights.filter((l) => l.on && l.intensity > 0);
  const color = new THREE.Color(0, 0, 0);
  const tmp = new THREE.Color();
  let intensity = 0;
  let cx = 0;
  let cz = 0;
  for (const l of active) {
    const w = l.intensity;
    tmp.copy(fixtureColor(l)).multiplyScalar(w);
    color.add(tmp);
    cx += l.x * w;
    cz += l.z * w;
    intensity += w;
  }
  if (intensity > 0) {
    color.multiplyScalar(1 / intensity);
    cx /= intensity;
    cz /= intensity;
  } else {
    color.setRGB(1, 1, 1);
  }
  return { active, intensity, color, centerX: cx, centerZ: cz };
}

// Deep-water absorption tint — water absorbs warm (red) wavelengths first, so
// light reads cooler/greener with depth. `t` 0 (surface) .. 1 (floor).
const DEEP_WATER = new THREE.Color("#1f6f7a");
export function attenuateForDepth(color: THREE.Color, t: number): THREE.Color {
  return color.clone().lerp(DEEP_WATER, Math.max(0, Math.min(1, t)));
}
