import * as THREE from "three";
import type { HardscapeSurface } from "./types";

// Procedural seamless PBR maps for the hardscape surface library. Each surface
// descriptor → tileable albedo + normal + roughness CanvasTextures, derived from
// one periodic value-noise height field. No bundled image files (avoids the
// CORS/404 texture gotcha). Cached per surface id for the app lifetime.
//
// Upgrade path: to use real scanned maps, replace getTextureSet() with a
// TextureLoader on /public/textures/<id>/{albedo,normal,roughness}.jpg.

const TEX = 384;

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Tileable value noise over [0,1): lattice wraps at `period` so it repeats. */
function vnoise(x: number, y: number, period: number, seed: number): number {
  const gx = x * period;
  const gy = y * period;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const x0w = ((x0 % period) + period) % period;
  const y0w = ((y0 % period) + period) % period;
  const x1w = (x0w + 1) % period;
  const y1w = (y0w + 1) % period;
  const v00 = hash2(x0w, y0w, seed);
  const v10 = hash2(x1w, y0w, seed);
  const v01 = hash2(x0w, y1w, seed);
  const v11 = hash2(x1w, y1w, seed);
  const sx = smooth(fx);
  const sy = smooth(fy);
  const a = v00 + (v10 - v00) * sx;
  const b = v01 + (v11 - v01) * sx;
  return a + (b - a) * sy;
}

function fbm(x: number, y: number, seed: number, basePeriod: number): number {
  let sum = 0;
  let amp = 0.5;
  let per = basePeriod;
  let max = 0;
  for (let o = 0; o < 4; o++) {
    sum += amp * vnoise(x, y, per, seed + o * 101);
    max += amp;
    per *= 2;
    amp *= 0.5;
  }
  return sum / max;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
};

function canvasTexture(data: Uint8ClampedArray): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = TEX;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(TEX, TEX);
  img.data.set(data);
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace; // albedo is sRGB->linear'd in the shader
  tex.anisotropy = 4;
  return tex;
}

export interface TextureSet {
  albedo: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
}

const cache = new Map<string, TextureSet>();

export function getTextureSet(s: HardscapeSurface): TextureSet {
  const hit = cache.get(s.id);
  if (hit) return hit;

  const seed = [...s.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7);
  const period = Math.max(2, Math.round(s.tileCm / s.grainCm));

  // Height field (shared by all three maps) + a coarse macro field for patchy
  // colour/brightness variation so the surface never reads as flat wallpaper.
  const H = new Float32Array(TEX * TEX);
  const M = new Float32Array(TEX * TEX);
  const warpPer = Math.max(2, Math.round(period / 2));
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const u = x / TEX;
      const v = y / TEX;
      // Domain warp (seamless: warp noise wraps too) breaks up the lattice grid.
      const wx = (vnoise(u, v, warpPer, seed + 311) - 0.5) * 0.18;
      const wy = (vnoise(u, v, warpPer, seed + 733) - 0.5) * 0.18;
      let h = fbm(u + wx, v + wy, seed, period);
      if (s.strata) {
        // horizontal bands → sedimentary stone / wood grain
        h = h * 0.6 + (0.5 + 0.5 * Math.sin((v + wy) * Math.PI * period)) * 0.4;
      }
      H[y * TEX + x] = h;
      M[y * TEX + x] = fbm(u, v, seed + 1009, 2); // coarse patches
    }
  }

  const base = hexToRgb(s.base);
  const accent = hexToRgb(s.accent);
  const albedo = new Uint8ClampedArray(TEX * TEX * 4);
  const rough = new Uint8ClampedArray(TEX * TEX * 4);
  const normal = new Uint8ClampedArray(TEX * TEX * 4);

  for (let i = 0; i < TEX * TEX; i++) {
    const h = H[i];
    const m = M[i]; // coarse patch 0..1
    // albedo: blend base→accent by grain (nudged by the macro patch), with a
    // deeper crevice darkening (cheap AO) and patchy overall brightness.
    const t = Math.min(1, Math.max(0, (h - 0.35) / 0.4 + (m - 0.5) * 0.5));
    const ao = 0.55 + h * 0.55; // low spots stay dark → reads as cracks/pits
    const shade = ao * (0.85 + m * 0.32);
    const j = i * 4;
    albedo[j] = (base[0] + (accent[0] - base[0]) * t) * shade;
    albedo[j + 1] = (base[1] + (accent[1] - base[1]) * t) * shade;
    albedo[j + 2] = (base[2] + (accent[2] - base[2]) * t) * shade;
    albedo[j + 3] = 255;

    const r =
      Math.min(
        1,
        Math.max(0, s.roughBase + (h - 0.5) * s.roughVar + (m - 0.5) * 0.12),
      ) * 255;
    rough[j] = rough[j + 1] = rough[j + 2] = r;
    rough[j + 3] = 255;
  }

  // Normal from height gradient (wrapping neighbours so it tiles).
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const l = H[y * TEX + ((x - 1 + TEX) % TEX)];
      const rr = H[y * TEX + ((x + 1) % TEX)];
      const u = H[((y - 1 + TEX) % TEX) * TEX + x];
      const d = H[((y + 1) % TEX) * TEX + x];
      const nx = (l - rr) * s.bump;
      const ny = (u - d) * s.bump;
      const nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      const j = (y * TEX + x) * 4;
      normal[j] = (nx * inv * 0.5 + 0.5) * 255;
      normal[j + 1] = (ny * inv * 0.5 + 0.5) * 255;
      normal[j + 2] = (nz * inv * 0.5 + 0.5) * 255;
      normal[j + 3] = 255;
    }
  }

  const set: TextureSet = {
    albedo: canvasTexture(albedo),
    normal: canvasTexture(normal),
    roughness: canvasTexture(rough),
  };
  cache.set(s.id, set);
  return set;
}
