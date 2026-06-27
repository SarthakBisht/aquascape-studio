"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";

// Bring-your-own hardscape texture. Unlike a plant cutout (lib/plantImage.ts),
// a rock/wood surface *tiles* — no background removal, just a downscale to keep
// the data URL small enough for localStorage (customSurfaces mirrors
// customPlantTextures). The triplanar shader (TriplanarMaterial) projects it on
// the three world planes, so it needs no real UVs and must wrap (Repeat).

/** Load a picked image → a small WebP data URL for persistence. Kept modest
 *  (it tiles) so localStorage doesn't blow its ~5 MB quota. */
export async function loadSurfaceImage(file: File, max = 384): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return cv.toDataURL("image/webp", 0.75);
}

/** data URL → a RepeatWrapping texture for triplanar tiling (null until loaded). */
export function useSurfaceTexture(url?: string): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    let active = true;
    const t = new THREE.TextureLoader().load(
      url,
      (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping;
        if (active) setTex(loaded);
      },
      undefined,
      () => {}, // on error keep the flat/colored fallback
    );
    return () => {
      active = false;
      t.dispose();
    };
  }, [url]);
  return tex;
}
