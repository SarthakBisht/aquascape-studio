"use client";

// Turn a photo into a 3D height field using in-browser monocular depth
// estimation (Depth-Anything v2 small, via transformers.js) clipped to the
// subject by the same background-removal engine the plant tool uses. The model
// + lib are imported lazily so they never touch SSR or the initial bundle; the
// first call downloads the model (onProgress reports it). Output feeds
// meshFromHeightfield — same path as the draw tool.

const MODEL = "onnx-community/depth-anything-v2-small";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pipe: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPipe(onProgress?: (f: number) => void): Promise<any> {
  if (_pipe) return _pipe;
  _pipe = (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = false; // fetch from the HF hub
    const device =
      typeof navigator !== "undefined" &&
      "gpu" in navigator &&
      (navigator as Navigator & { gpu?: unknown }).gpu
        ? "webgpu"
        : "wasm";
    return pipeline("depth-estimation", MODEL, {
      device,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progress_callback: (p: any) => {
        if (onProgress && p?.status === "progress" && typeof p.progress === "number") {
          onProgress(Math.min(1, p.progress / 100));
        }
      },
    });
  })();
  return _pipe;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Draw a source into a res×res canvas and return its RGBA bytes. */
function sampleRGBA(
  src: CanvasImageSource,
  res: number,
): Uint8ClampedArray {
  const cv = document.createElement("canvas");
  cv.width = cv.height = res;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(src, 0, 0, res, res);
  return ctx.getImageData(0, 0, res, res).data;
}

/**
 * Photo → height field (subject only). `onProgress` 0..1 covers the model
 * download (dominates the first call). Returns a square height field at `res`.
 */
export async function depthFromImage(
  file: File,
  onProgress?: (fraction: number) => void,
  res = 160,
): Promise<{ height: Float32Array; w: number; h: number }> {
  const pipe = await getPipe(onProgress);
  onProgress?.(1); // model ready — the rest is fast

  // Subject mask from the background-removal engine.
  const { removeBackground } = await import("@imgly/background-removal");
  const cutout = await removeBackground(file, { output: { format: "image/png" } });
  const maskUrl = URL.createObjectURL(cutout);
  const fileUrl = URL.createObjectURL(file);
  try {
    const maskImg = await loadImage(maskUrl);
    const out = await pipe(fileUrl); // { depth: RawImage, ... }
    const depthCanvas = out.depth.toCanvas() as HTMLCanvasElement;

    const depth = sampleRGBA(depthCanvas, res);
    const mask = sampleRGBA(maskImg, res);

    // Normalize masked depth to [0,1] (brighter = nearer = taller).
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < res * res; i++) {
      if (mask[i * 4 + 3] > 24) {
        const d = depth[i * 4];
        if (d < min) min = d;
        if (d > max) max = d;
      }
    }
    const range = max - min || 1;
    const height = new Float32Array(res * res);
    for (let i = 0; i < res * res; i++) {
      if (mask[i * 4 + 3] > 24) {
        height[i] = (depth[i * 4] - min) / range;
      }
    }
    return { height, w: res, h: res };
  } finally {
    URL.revokeObjectURL(maskUrl);
    URL.revokeObjectURL(fileUrl);
  }
}
