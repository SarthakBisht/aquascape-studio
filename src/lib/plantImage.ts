"use client";

// Turn a dropped/picked plant photo into a billboard-ready texture: strip the
// background with an in-browser AI model, then downscale to a small, alpha-
// preserving PNG data URL that THREE.TextureLoader can consume directly
// (see usePlantTexture). The heavy model lib is imported lazily so it never
// touches SSR or the initial bundle.

const MAX_DIM = 512;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function downscaleToDataUrl(blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Remove the background from a plant image and return a transparent PNG data URL.
 * `onProgress` reports 0..1 (the model download dominates the first call).
 */
export async function processPlantImage(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const { removeBackground } = await import("@imgly/background-removal");
  const cutout = await removeBackground(file, {
    output: { format: "image/png" },
    progress: (_key: string, current: number, total: number) => {
      if (onProgress && total > 0) onProgress(current / total);
    },
  });
  return downscaleToDataUrl(cutout);
}
