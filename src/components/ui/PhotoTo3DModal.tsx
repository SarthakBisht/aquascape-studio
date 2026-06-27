"use client";

import { useRef, useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { depthFromImage } from "@/lib/depthFromImage";
import { heightToDataUrl } from "@/lib/heightfieldMesh";
import { Btn } from "./primitives";
import type { HardscapeKind } from "@/lib/types";

const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

// Drop/pick a photo → in-browser AI depth → a real 3D piece. First run downloads
// the depth model (progress shown). Reuses the same height-field → mesh path as
// the draw tool.
export function PhotoTo3DModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const setCustomMesh = useStudioStore((s) => s.setCustomMesh);
  const addGenerated = useStudioStore((s) => s.addGeneratedHardscape);

  const [kind, setKind] = useState<HardscapeKind>("wood");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  async function handleFile(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    setBusy(true);
    setProgress(0);
    try {
      const { height, w, h } = await depthFromImage(file, setProgress);
      const meshId = genId();
      setCustomMesh(meshId, { height: heightToDataUrl(height, w, h), w, h });
      addGenerated({
        kind,
        source: "mesh",
        materialId: kind === "wood" ? "spiderwood" : "",
        textureId: kind === "wood" ? "driftbark" : "granite",
        meshId,
      });
      onClose();
    } catch (e) {
      alert(`Couldn't build 3D from that photo: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-sumi/70 backdrop-blur-sm">
      <div className="w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-mist/10 bg-soil/95 p-4 text-mist shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm text-moss">Photo → 3D</h2>
          <button onClick={onClose} className="text-stone hover:text-mist" title="Close">
            ✕
          </button>
        </div>

        <div className="mb-3 flex items-center gap-1.5">
          <span className="text-[10px] text-stone">Type</span>
          <Btn active={kind === "rock"} onClick={() => setKind("rock")}>
            Rock
          </Btn>
          <Btn active={kind === "wood"} onClick={() => setKind("wood")}>
            Wood
          </Btn>
        </div>

        <div
          onClick={() => !busy && fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`relative grid h-40 cursor-pointer place-items-center rounded-lg border border-dashed text-center text-xs text-stone transition-colors ${
            dragOver ? "border-moss bg-moss/10" : "border-mist/20 bg-[#11161a] hover:bg-mist/[0.04]"
          }`}
        >
          {busy ? (
            <div className="flex flex-col items-center gap-2 text-moss">
              <span className="h-4 w-4 animate-spin rounded-full border border-moss border-t-transparent" />
              <span>
                {progress < 1
                  ? `downloading depth model… ${Math.round(progress * 100)}%`
                  : "estimating depth…"}
              </span>
            </div>
          ) : (
            <span>
              Drop a driftwood / rock photo here
              <br />
              or click to choose
            </span>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <p className="mt-2 text-[10px] leading-snug text-stone/70">
          The background is removed and depth estimated in your browser (first use
          downloads a small AI model). Then tune surface & color in Customize.
        </p>
      </div>
    </div>
  );
}
