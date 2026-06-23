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
  if (data.version !== 1 || !data.tank || !Array.isArray(data.hardscape)) {
    throw new Error("Not a valid .aquascape.json layout file");
  }
  return data;
}

/** Save the current WebGL canvas as a PNG. Requires preserveDrawingBuffer. */
export function screenshotCanvas(canvas: HTMLCanvasElement) {
  triggerDownload(canvas.toDataURL("image/png"), `scape-${Date.now()}.png`);
}
