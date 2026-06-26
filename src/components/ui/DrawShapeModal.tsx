"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useStudioStore } from "@/store/useStudioStore";
import { inflateMask, roughenHeight } from "@/lib/inflate";
import { heightToDataUrl, meshFromHeightfield } from "@/lib/heightfieldMesh";
import { getSurface } from "@/data/hardscapeTextures";
import { TriplanarMaterial } from "@/components/scene/TriplanarMaterial";
import { Btn } from "./primitives";
import type { HardscapeKind } from "@/lib/types";

// Sketch a silhouette → the inflation pipeline turns it into a real 3D piece,
// roughened so it reads as stone (not a smooth pillow). A live preview rebuilds
// on each stroke so you see the 3D before committing.
const RES = 240; // drawing canvas resolution
const MASK = 140; // height-field / mesh resolution
const INK = "#cfe8a0";

const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function PreviewMesh({
  geo,
  kind,
}: {
  geo: THREE.BufferGeometry;
  kind: HardscapeKind;
}) {
  const surface = getSurface(kind === "wood" ? "driftbark" : "granite")!;
  return (
    <mesh geometry={geo}>
      <TriplanarMaterial surface={surface} color="#ffffff" roughness={0.85} seed={1} />
    </mesh>
  );
}

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
  const seedRef = useRef(0);
  const [brush, setBrush] = useState(22);
  const [erase, setErase] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [kind, setKind] = useState<HardscapeKind>("rock");
  const [preview, setPreview] = useState<THREE.BufferGeometry | null>(null);

  // Clear the canvas + a fresh seed whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    const cv = cvRef.current;
    if (cv) cv.getContext("2d")!.clearRect(0, 0, RES, RES);
    last.current = null;
    seedRef.current = Math.floor(Math.random() * 1e9);
    setPreview(null);
  }, [open]);

  // Dispose the preview geometry on unmount / when replaced.
  useEffect(() => () => preview?.dispose(), [preview]);

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

  // Read the current drawing as a silhouette mask at MASK resolution.
  const readMask = (): { mask: Uint8Array; filled: number } => {
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
    return { mask, filled };
  };

  // Inflate + roughen the current mask into a rocky height field.
  const buildHeight = (): Float32Array | null => {
    const { mask, filled } = readMask();
    if (filled < 8) return null;
    const dome = inflateMask(mask, MASK, MASK);
    return roughenHeight(dome, MASK, MASK, seedRef.current, 0.6);
  };

  const rebuildPreview = () => {
    const height = buildHeight();
    setPreview((prev) => {
      prev?.dispose();
      return height ? meshFromHeightfield(height, MASK, MASK) : null;
    });
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
    rebuildPreview();
  };

  const clear = () => {
    cvRef.current!.getContext("2d")!.clearRect(0, 0, RES, RES);
    setPreview((prev) => {
      prev?.dispose();
      return null;
    });
  };

  const create = () => {
    const height = buildHeight();
    if (!height) {
      alert("Draw a shape first 🙂");
      return;
    }
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

        <div className="flex gap-2">
          <canvas
            ref={cvRef}
            width={RES}
            height={RES}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            className="block aspect-square w-1/2 flex-1 cursor-crosshair touch-none rounded-lg border border-mist/15 bg-[#11161a]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)",
              backgroundSize: "10% 10%",
            }}
          />
          <div className="flex w-1/2 flex-1 flex-col">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-mist/15 bg-[#0c1013]">
              {preview ? (
                <Canvas camera={{ position: [0, 0.7, 2.3], fov: 40 }}>
                  <ambientLight intensity={0.7} />
                  <directionalLight position={[2, 3, 2]} intensity={1.3} />
                  <directionalLight position={[-2, 1, -1]} intensity={0.4} />
                  <PreviewMesh geo={preview} kind={kind} />
                  <OrbitControls
                    enablePan={false}
                    autoRotate
                    autoRotateSpeed={2.5}
                    target={[0, 0.5, 0]}
                  />
                </Canvas>
              ) : (
                <div className="grid h-full place-items-center px-2 text-center text-[10px] text-stone/60">
                  3D preview
                  <br />
                  appears here
                </div>
              )}
            </div>
            <span className="mt-1 text-center text-[9px] text-stone/60">
              drag to rotate
            </span>
          </div>
        </div>

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
          Paint a solid silhouette — it’s inflated and roughened into a real stone
          you can orbit (preview at right). Tune its surface in Customize.
        </p>
      </div>
    </div>
  );
}
