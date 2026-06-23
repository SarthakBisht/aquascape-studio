"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useStudioStore } from "@/store/useStudioStore";
import { defaultCameraPosition } from "@/lib/units";
import { screenshotCanvas } from "@/lib/persistence";
import { TankScene } from "./scene/TankScene";
import { Toolbar } from "./ui/Toolbar";
import { TankPanel } from "./ui/TankPanel";
import { HardscapePalette } from "./ui/HardscapePalette";
import { PlantBrowser } from "./ui/PlantBrowser";
import { SelectionBar } from "./ui/SelectionBar";
import type { Quality } from "@/lib/types";

const DPR: Record<Quality, [number, number]> = {
  low: [1, 1],
  medium: [1, 1.5],
  high: [1, 2],
};

export function Studio() {
  const tank = useStudioStore((s) => s.tank);
  const quality = useStudioStore((s) => s.quality);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // WebGL only mounts on the client — avoids SSR/window issues.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const onScreenshot = () => {
    if (canvasRef.current) screenshotCanvas(canvasRef.current);
  };

  // Render nothing interactive until mounted on the client. This keeps WebGL
  // off the server and avoids hydration mismatches from persisted state.
  if (!mounted) {
    return (
      <div className="grid h-full w-full place-items-center bg-slate-950 text-sm text-slate-500">
        Loading studio…
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <Canvas
        dpr={DPR[quality]}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        camera={{
          position: defaultCameraPosition(tank),
          fov: 45,
          near: 1,
          far: 6000,
        }}
        onCreated={({ gl }) => {
          canvasRef.current = gl.domElement;
        }}
      >
        <TankScene />
      </Canvas>

      {/* UI overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-3">
        <Toolbar onScreenshot={onScreenshot} />
        <div className="flex min-h-0 flex-1 gap-3">
          <div className="flex w-64 flex-col gap-3 overflow-y-auto">
            <TankPanel />
            <HardscapePalette />
          </div>
          <div className="flex-1" />
          <div className="flex max-h-full w-64 flex-col">
            <PlantBrowser />
          </div>
        </div>
        <div className="flex justify-center">
          <SelectionBar />
        </div>
      </div>
    </div>
  );
}
