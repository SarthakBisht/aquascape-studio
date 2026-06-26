import * as THREE from "three";

// Build a solid 3D piece from a height field (0 = outside the silhouette, >0 =
// domed interior). Front surface is displaced +H, back surface −H, and the
// silhouette rim is a shared z=0 seam so the shell closes into a real volume you
// can orbit — not a flat relief. Shared by the draw tool and the depth-photo
// path. Caller disposes (Hardscape pattern).
//
// Also: encode/decode the height field as a small grayscale PNG so layouts
// persist light and rebuild deterministically (no model re-run).

export function meshFromHeightfield(
  height: Float32Array,
  w: number,
  h: number,
  opts?: { depth?: number },
): THREE.BufferGeometry {
  const eps = 0.02;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const T = (opts?.depth ?? 0.7) * (Math.min(w, h) / 2);

  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && height[y * w + x] > eps;

  const fIdx = new Int32Array(w * h).fill(-1);
  const bIdx = new Int32Array(w * h).fill(-1);
  const pos: number[] = [];
  let n = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const i = y * w + x;
      const X = x - cx;
      const Y = cy - y; // flip so image-up is world-up
      const H = height[i];
      const isB =
        !inside(x - 1, y) ||
        !inside(x + 1, y) ||
        !inside(x, y - 1) ||
        !inside(x, y + 1);
      if (isB) {
        pos.push(X, Y, 0);
        fIdx[i] = bIdx[i] = n++;
      } else {
        pos.push(X, Y, H * T);
        fIdx[i] = n++;
        pos.push(X, Y, -H * T);
        bIdx[i] = n++;
      }
    }
  }

  const idx: number[] = [];
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      if (
        !inside(x, y) ||
        !inside(x + 1, y) ||
        !inside(x, y + 1) ||
        !inside(x + 1, y + 1)
      )
        continue;
      const a = y * w + x;
      const b = y * w + x + 1;
      const c = (y + 1) * w + x;
      const d = (y + 1) * w + x + 1;
      // front (+z)
      idx.push(fIdx[a], fIdx[c], fIdx[b], fIdx[b], fIdx[c], fIdx[d]);
      // back (−z), reversed winding
      idx.push(bIdx[a], bIdx[b], bIdx[c], bIdx[b], bIdx[d], bIdx[c]);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);

  // Normalize to ~unit size and seat at y=0 (matches driftwood/rock scale).
  geo.computeBoundingBox();
  const size = new THREE.Vector3();
  geo.boundingBox!.getSize(size);
  const norm = 1.2 / (Math.max(size.x, size.y, size.z) || 1);
  geo.scale(norm, norm, norm);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox!.min.y, 0);

  // Neutral mottle so the plain (no-surface) material path isn't black.
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const m = 0.82 + ((i * 2654435761) % 1000) / 1000 * 0.18;
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = m;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Encode a height field [0,1] as a grayscale PNG data URL (for persistence). */
export function heightToDataUrl(
  height: Float32Array,
  w: number,
  h: number,
): string {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, Math.round(height[i] * 255)));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL("image/png");
}

/** Decode a grayscale height PNG back into a height field. */
export function loadHeightField(
  dataUrl: string,
): Promise<{ height: Float32Array; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, w, h).data;
      const height = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) height[i] = data[i * 4] / 255;
      resolve({ height, w, h });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
