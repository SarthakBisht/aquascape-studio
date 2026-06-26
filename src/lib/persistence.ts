import type { Layout } from "./types";

// Layout export/import for sharing without a backend. A layout is just JSON, so
// people can hand a .aquascape.json file around or check it into a repo.

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function exportLayoutFile(layout: Layout) {
  const blob = new Blob([JSON.stringify(layout, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `scape-${Date.now()}.aquascape.json`);
  URL.revokeObjectURL(url);
}

export async function importLayoutFile(file: File): Promise<Layout> {
  const text = await file.text();
  const data = JSON.parse(text) as Layout;
  if (
    (data.version !== 1 && data.version !== 2) ||
    !data.tank ||
    !Array.isArray(data.hardscape)
  ) {
    throw new Error("Not a valid .aquascape.json layout file");
  }
  return data;
}

/** Save the current WebGL canvas as a PNG. Requires preserveDrawingBuffer. */
export function screenshotCanvas(canvas: HTMLCanvasElement) {
  triggerDownload(canvas.toDataURL("image/png"), `scape-${Date.now()}.png`);
}

/** Downscaled JPEG snapshot of the canvas for gallery thumbnails (keeps
 *  localStorage small). Requires preserveDrawingBuffer. */
export function captureThumbnail(canvas: HTMLCanvasElement, maxW = 480): string {
  const scale = Math.min(1, maxW / canvas.width);
  const c = document.createElement("canvas");
  c.width = Math.round(canvas.width * scale);
  c.height = Math.round(canvas.height * scale);
  const ctx = c.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/jpeg", 0.7);
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.72);
}
