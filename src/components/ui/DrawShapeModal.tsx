"use client";

import { useEffect, useRef, useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { inflateMask } from "@/lib/inflate";
import { heightToDataUrl } from "@/lib/heightfieldMesh";
import { Btn } from "./primitives";
import type { HardscapeKind } from "@/lib/types";

// Sketch a silhouette → the inflation pipeline turns it into a real 3D piece.
// Draw at full canvas res, downscale the mask to MASK for a light mesh + a small
// persisted height PNG.
const RES = 240; // drawing canvas resolution
const MASK = 140; // height-field / mesh resolution
const INK = "#cfe8a0";

const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function DrawShapeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const setCustomMesh = useStudioStore((s) => s.setCustomMesh);
  const addGenerated = useStudioStore((s) => s.addGeneratedHardscape);

  const cvRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [brush, setBrush] = useState(22);
  const [erase, setErase] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [kind, setKind] = useState<HardscapeKind>("rock");

  // Clear the canvas whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    const cv = cvRef.current;
    if (cv) cv.getContext("2d")!.clearRect(0, 0, RES, RES);
    last.current = null;
  }, [open]);

  if (!open) return null;

  const toCanvas = (e: React.PointerEvent) => {
    const cv = cvRef.current!;
    const r = cv.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * RES,
      y: ((e.clientY - r.top) / r.height) * RES,
    };
  };

  const stroke = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const ctx = cvRef.current!.getContext("2d")!;
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = brush * 2;
    ctx.lineCap = "round";
    const line = (p: { x: number; y: number }, q: { x: number; y: number }) => {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    };
    line(a, b);
    if (mirror) line({ x: RES - a.x, y: a.y }, { x: RES - b.x, y: b.y });
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = toCanvas(e);
    last.current = p;
    stroke(p, p);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!last.current) return;
    const p = toCanvas(e);
    stroke(last.current, p);
    last.current = p;
  };
  const onUp = () => {
    last.current = null;
  };

  const clear = () =>
    cvRef.current!.getContext("2d")!.clearRect(0, 0, RES, RES);

  const create = () => {
    // Downscale to the mask resolution and read alpha as the silhouette.
    const off = document.createElement("canvas");
    off.width = off.height = MASK;
    const octx = off.getContext("2d")!;
    octx.drawImage(cvRef.current!, 0, 0, MASK, MASK);
    const data = octx.getImageData(0, 0, MASK, MASK).data;
    const mask = new Uint8Array(MASK * MASK);
    let filled = 0;
    for (let i = 0; i < MASK * MASK; i++) {
      if (data[i * 4 + 3] > 20) {
        mask[i] = 1;
        filled++;
      }
    }
    if (filled < 8) {
      alert("Draw a shape first 🙂");
      return;
    }
    const height = inflateMask(mask, MASK, MASK);
    const meshId = genId();
    setCustomMesh(meshId, {
      height: heightToDataUrl(height, MASK, MASK),
      w: MASK,
      h: MASK,
    });
    addGenerated({
      kind,
      source: "mesh",
      materialId: kind === "wood" ? "spiderwood" : "",
      textureId: kind === "wood" ? "driftbark" : "granite",
      meshId,
    });
    onClose();
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-sumi/70 backdrop-blur-sm">
      <div className="w-[360px] rounded-xl border border-mist/10 bg-soil/95 p-4 text-mist shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm text-moss">Draw a shape → 3D</h2>
          <button
            onClick={onClose}
            className="text-stone hover:text-mist"
            title="Close"
          >
            ✕
          </button>
        </div>

        <canvas
          ref={cvRef}
          width={RES}
          height={RES}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          className="mx-auto block aspect-square w-full cursor-crosshair touch-none rounded-lg border border-mist/15 bg-[#11161a]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)",
            backgroundSize: "10% 10%",
          }}
        />

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Btn active={!erase} onClick={() => setErase(false)}>
            Brush
          </Btn>
          <Btn active={erase} onClick={() => setErase(true)}>
            Erase
          </Btn>
          <Btn active={mirror} onClick={() => setMirror((m) => !m)}>
            ⇋ Mirror
          </Btn>
          <Btn onClick={clear}>Clear</Btn>
          <label className="ml-auto flex items-center gap-1 text-[10px] text-stone">
            size
            <input
              type="range"
              min={6}
              max={48}
              value={brush}
              onChange={(e) => setBrush(Number(e.target.value))}
              className="h-1 w-20 accent-moss"
            />
          </label>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-[10px] text-stone">Type</span>
          <Btn active={kind === "rock"} onClick={() => setKind("rock")}>
            Rock
          </Btn>
          <Btn active={kind === "wood"} onClick={() => setKind("wood")}>
            Wood
          </Btn>
          <button
            onClick={create}
            className="ml-auto rounded-md bg-moss px-3 py-1.5 text-xs font-medium text-sumi transition-colors hover:bg-moss-bright"
          >
            Make 3D →
          </button>
        </div>

        <p className="mt-2 text-[10px] leading-snug text-stone/70">
          Paint a solid silhouette — it’s inflated into a rounded 3D piece you can
          orbit, texture and place. Tune its surface in the Customize panel.
        </p>
      </div>
    </div>
  );
}
