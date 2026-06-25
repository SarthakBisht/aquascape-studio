import * as THREE from "three";

// Black-body color temperature → RGB (Tanner Helland approximation), as a
// THREE.Color. Warm (~3000K) is orange-white, ~6500K neutral, cool (8000K+)
// blue-white. Pure function — no deps beyond three.
export function kelvinToRgb(kelvin: number): THREE.Color {
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100;
  let r: number;
  let g: number;
  let b: number;

  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }
  if (t >= 66) {
    b = 255;
  } else if (t <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  }

  const norm = (x: number) => Math.max(0, Math.min(255, x)) / 255;
  return new THREE.Color(norm(r), norm(g), norm(b));
}
