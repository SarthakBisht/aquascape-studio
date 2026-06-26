"use client";

// Dev-only batch tool (unlinked): drop raw plant photos named "<species-id>.jpg"
// and it strips each background (reusing the in-app AI cutout, lib/plantImage.ts)
// and downloads a transparent "<species-id>.png" ready to drop into public/plants/.
// First run downloads the background-removal model (progress shown).

import { useState } from "react";
import { processPlantImage } from "@/lib/plantImage";

type Status = "queued" | "working" | "done" | "error";
interface Item {
  id: string; // species id = filename without extension
  status: Status;
  progress: number;
  out?: string; // transparent PNG data URL
  error?: string;
}

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim();
}

function download(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export default function CutoutPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  async function run(files: FileList) {
    const list = Array.from(files);
    setItems(list.map((f) => ({ id: baseName(f.name), status: "queued", progress: 0 })));
    setBusy(true);
    // Sequential — the model is heavy; parallel runs thrash WASM memory.
    for (let i = 0; i < list.length; i++) {
      setItems((s) => s.map((it, j) => (j === i ? { ...it, status: "working" } : it)));
      try {
        const out = await processPlantImage(list[i], (p) =>
          setItems((s) => s.map((it, j) => (j === i ? { ...it, progress: p } : it))),
        );
        setItems((s) => s.map((it, j) => (j === i ? { ...it, status: "done", progress: 1, out } : it)));
        download(out, `${baseName(list[i].name)}.png`);
      } catch (e) {
        setItems((s) =>
          s.map((it, j) =>
            j === i ? { ...it, status: "error", error: e instanceof Error ? e.message : String(e) } : it,
          ),
        );
      }
    }
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24, fontFamily: "system-ui", color: "#e7e7e7", background: "#141414", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Plant cutout tool</h1>
      <p style={{ opacity: 0.75, fontSize: 14, lineHeight: 1.5 }}>
        Name each raw photo after its species id (e.g. <code>java-fern.jpg</code>), drop them
        below, and a transparent <code>&lt;id&gt;.png</code> downloads for each. Move the PNGs
        into <code>public/plants/</code>; I&rsquo;ll wire <code>texture</code> on the species.
        First run downloads the AI model (~tens of MB).
      </p>

      <label
        style={{
          display: "block", border: "2px dashed #555", borderRadius: 12, padding: 28,
          textAlign: "center", cursor: busy ? "wait" : "pointer", marginTop: 16,
          opacity: busy ? 0.6 : 1, background: "#1c1c1c",
        }}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          style={{ display: "none" }}
          onChange={(e) => e.target.files && e.target.files.length && run(e.target.files)}
        />
        {busy ? "Processing…" : "Click to pick raw plant photos (multiple)"}
      </label>

      <ul style={{ listStyle: "none", padding: 0, marginTop: 20, display: "grid", gap: 10 }}>
        {items.map((it, i) => (
          <li key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#1c1c1c", borderRadius: 10, padding: 10 }}>
            <div
              style={{
                width: 56, height: 56, borderRadius: 8, flex: "0 0 auto",
                backgroundColor: "#2a2a2a",
                backgroundImage:
                  "linear-gradient(45deg,#333 25%,transparent 25%),linear-gradient(-45deg,#333 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#333 75%),linear-gradient(-45deg,transparent 75%,#333 75%)",
                backgroundSize: "12px 12px",
                backgroundPosition: "0 0,0 6px,6px -6px,-6px 0",
                display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
              }}
            >
              {it.out && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.out} alt={it.id} style={{ maxWidth: "100%", maxHeight: "100%" }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{it.id}.png</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {it.status === "working"
                  ? `cutting… ${Math.round(it.progress * 100)}%`
                  : it.status === "error"
                    ? `error: ${it.error}`
                    : it.status}
              </div>
            </div>
            {it.out && (
              <button
                onClick={() => download(it.out!, `${it.id}.png`)}
                style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid #555", background: "#2a2a2a", color: "#e7e7e7", cursor: "pointer" }}
              >
                re-download
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
