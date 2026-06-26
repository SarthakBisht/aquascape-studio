import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { resolveSubstrate, type SubstrateVariant } from "@/data/substrates";
import type { SubstrateConfig } from "./types";

// Procedural seamless GRANULAR PBR maps for the substrate. Unlike the hardscape
// surfaces (fbm lumps), substrate must read as packed individual grains/pellets
// — so the height field is a TILEABLE CELLULAR (Worley) field: each cell owns
// one jittered grain, every grain gets its own colour + brightness jitter (the
// key to aquasoil realism), dark crevices between grains. albedo+normal+rough
// CanvasTextures, cached per variant id. No bundled images (CORS-safe).

const TEX = 256;
const GRAINS = 22; // grain cells across one tile → repeat tuned to grainMm

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Tileable value noise (micro intra-grain detail); lattice wraps at `period`. */
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
  const sx = smooth(fx);
  const sy = smooth(fy);
  const a =
    hash2(x0w, y0w, seed) +
    (hash2(x1w, y0w, seed) - hash2(x0w, y0w, seed)) * sx;
  const b =
    hash2(x0w, y1w, seed) +
    (hash2(x1w, y1w, seed) - hash2(x0w, y1w, seed)) * sx;
  return a + (b - a) * sy;
}

/** Tileable cellular: nearest jittered feature point. Returns its distance and
 *  the winning grain's two random values (brightness + colour-mix). Feature
 *  points are placed at unwrapped cell coords but seeded from the WRAPPED cell
 *  index, so the field is exactly periodic at the tile seam. Exported for the
 *  node self-check. */
export function cellular(
  u: number,
  v: number,
  period: number,
  seed: number,
): { f1: number; gj: number; gc: number } {
  const gx = u * period;
  const gy = v * period;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  let best = 1e9;
  let bwx = 0;
  let bwy = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx;
      const cy = iy + dy;
      const wx = ((cx % period) + period) % period;
      const wy = ((cy % period) + period) % period;
      const fx = cx + hash2(wx, wy, seed);
      const fy = cy + hash2(wx, wy, seed + 57);
      const ddx = fx - gx;
      const ddy = fy - gy;
      const dd = ddx * ddx + ddy * ddy;
      if (dd < best) {
        best = dd;
        bwx = wx;
        bwy = wy;
      }
    }
  }
  return {
    f1: Math.sqrt(best),
    gj: hash2(bwx, bwy, seed + 991),
    gc: hash2(bwx, bwy, seed + 123),
  };
}

const hexToRgb = (hex: string): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
};

function canvasTexture(
  data: Uint8ClampedArray,
  colorSpace: THREE.ColorSpace,
): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = TEX;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(TEX, TEX);
  img.data.set(data);
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = colorSpace;
  return tex;
}

interface TextureSet {
  albedo: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
}

const cache = new Map<string, TextureSet>();

function buildTextureSet(s: SubstrateVariant): TextureSet {
  const seed = [...s.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7);

  // Height (grain dome + micro) and per-pixel grain colour/brightness.
  const H = new Float32Array(TEX * TEX);
  const albedo = new Uint8ClampedArray(TEX * TEX * 4);
  const rough = new Uint8ClampedArray(TEX * TEX * 4);
  const normal = new Uint8ClampedArray(TEX * TEX * 4);
  const base = hexToRgb(s.color);
  const accent = hexToRgb(s.accent);

  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const u = x / TEX;
      const v = y / TEX;
      const { f1, gj, gc } = cellular(u, v, GRAINS, seed);
      // grain dome: high at centre, → 0 at the cell boundary (dark crevice)
      const dome = smooth(clamp01(1 - f1 / 0.72));
      const micro = vnoise(u, v, GRAINS * 4, seed + 17); // intra-grain speckle
      const h = dome * 0.85 + micro * 0.15;
      const i = y * TEX + x;
      H[i] = h;

      // per-grain colour (mix base↔accent) × per-grain brightness × crevice AO
      const grainBright = 0.7 + gj * 0.5; // 0.7..1.2 across grains
      const ao = 0.4 + 0.6 * dome; // valleys between grains stay dark
      const speck = 0.88 + micro * 0.24;
      const t = gc;
      const j = i * 4;
      albedo[j] = (base[0] + (accent[0] - base[0]) * t) * grainBright * ao * speck;
      albedo[j + 1] =
        (base[1] + (accent[1] - base[1]) * t) * grainBright * ao * speck;
      albedo[j + 2] =
        (base[2] + (accent[2] - base[2]) * t) * grainBright * ao * speck;
      albedo[j + 3] = 255;

      // matte; grain tops a touch glossier (catch wet sheen)
      const r = (0.94 - 0.18 * dome) * 255;
      rough[j] = rough[j + 1] = rough[j + 2] = r;
      rough[j + 3] = 255;
    }
  }

  // Normal from height gradient (wrapping neighbours → tiles), scaled by relief.
  const bump = 3.0 * s.relief;
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const l = H[y * TEX + ((x - 1 + TEX) % TEX)];
      const rr = H[y * TEX + ((x + 1) % TEX)];
      const up = H[((y - 1 + TEX) % TEX) * TEX + x];
      const dn = H[((y + 1) % TEX) * TEX + x];
      const nx = (l - rr) * bump;
      const ny = (up - dn) * bump;
      const inv = 1 / Math.hypot(nx, ny, 1);
      const j = (y * TEX + x) * 4;
      normal[j] = (nx * inv * 0.5 + 0.5) * 255;
      normal[j + 1] = (ny * inv * 0.5 + 0.5) * 255;
      normal[j + 2] = (inv * 0.5 + 0.5) * 255;
      normal[j + 3] = 255;
    }
  }

  return {
    albedo: canvasTexture(albedo, THREE.SRGBColorSpace),
    normal: canvasTexture(normal, THREE.NoColorSpace),
    roughness: canvasTexture(rough, THREE.NoColorSpace),
  };
}

function getTextureSet(s: SubstrateVariant): TextureSet {
  let hit = cache.get(s.id);
  if (!hit) {
    hit = buildTextureSet(s);
    cache.set(s.id, hit);
  }
  return hit;
}

/** Granular PBR maps for a substrate, tiled to the tank size at real grain
 *  scale. Returns cloned textures (own repeat) so the editor and gallery can
 *  show different tanks without clobbering each other's tiling. */
export function useSubstrateTextures(
  substrate: SubstrateConfig,
  wCm: number,
  dCm: number,
): TextureSet {
  const variant = resolveSubstrate(substrate);
  const tex = useMemo(() => {
    const set = getTextureSet(variant);
    // grains across an axis = mm-span / grainMm; tile holds GRAINS grains.
    const rx = Math.max(1, (wCm * 10) / (variant.grainMm * GRAINS));
    const ry = Math.max(1, (dCm * 10) / (variant.grainMm * GRAINS));
    const clone = (src: THREE.CanvasTexture) => {
      const c = src.clone();
      c.wrapS = c.wrapT = THREE.RepeatWrapping;
      c.repeat.set(rx, ry);
      c.anisotropy = 8;
      c.needsUpdate = true;
      return c;
    };
    return {
      albedo: clone(set.albedo),
      normal: clone(set.normal),
      roughness: clone(set.roughness),
    };
  }, [variant, wCm, dCm]);

  // Clones share the cached source canvas but own a GPU upload → free on swap.
  useEffect(
    () => () => {
      tex.albedo.dispose();
      tex.normal.dispose();
      tex.roughness.dispose();
    },
    [tex],
  );

  return tex;
}
