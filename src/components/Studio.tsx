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
import { DrawPanel } from "./ui/DrawPanel";
import { BackgroundPanel } from "./ui/BackgroundPanel";
import { PlantBrowser } from "./ui/PlantBrowser";
import { SelectionBar } from "./ui/SelectionBar";
import { isBrightBackground } from "@/data/backgrounds";
import { endStroke } from "@/lib/surfaceInteraction";
import type { Quality } from "@/lib/types";

const DPR: Record<Quality, [number, number]> = {
  low: [1, 1],
  medium: [1, 1.5],
  high: [1, 2],
};

export function Studio() {
  const tank = useStudioStore((s) => s.tank);
  const quality = useStudioStore((s) => s.quality);
  const zen = useStudioStore((s) => s.zen);
  const bright = useStudioStore((s) => isBrightBackground(s.background));
  const empty = useStudioStore(
    (s) => s.hardscape.length === 0 && s.plants.length === 0,
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // WebGL only mounts on the client — avoids SSR/window issues.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // End a draw stroke whenever the pointer is released, even off the canvas.
  useEffect(() => {
    const up = () => endStroke();
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const onScreenshot = () => {
    if (canvasRef.current) screenshotCanvas(canvasRef.current);
  };

  // Render nothing interactive until mounted on the client. This keeps WebGL
  // off the server and avoids hydration mismatches from persisted state.
  if (!mounted) {
    return (
      <div className="grid h-full w-full place-items-center bg-sumi">
        <span className="font-display text-sm italic tracking-wide text-stone">
          preparing your tank…
        </span>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-sumi">
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
        onPointerMissed={() => useStudioStore.getState().selectItem(null)}
      >
        <TankScene />
      </Canvas>

      {/* gallery lighting — the scape is presented like an exhibit. With a bright
          (white / backlit) backdrop the dark framing eases off. */}
      {!bright && <div className="gallery-glow" aria-hidden />}
      {!bright && <div className="gallery-vignette" aria-hidden />}

      {/* an empty tank is an invitation */}
      {empty && !zen && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-[16%]">
          <p className="font-display text-base italic text-mist/35">
            Begin with a single stone.
          </p>
        </div>
      )}

      {/* UI overlay — dissolves in Zen mode so only the scape remains */}
      <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-3">
        <Toolbar onScreenshot={onScreenshot} />
        <div
          className={`flex min-h-0 flex-1 gap-3 transition-all duration-[1100ms] ease-out ${
            zen ? "pointer-events-none translate-y-1 opacity-0" : "opacity-100"
          }`}
        >
          <div className="calm-scroll flex w-64 flex-col gap-3 overflow-y-auto pr-0.5">
            <TankPanel />
            <HardscapePalette />
            <DrawPanel />
            <BackgroundPanel />
          </div>
          <div className="flex-1" />
          <div className="flex max-h-full w-64 flex-col">
            <PlantBrowser />
          </div>
        </div>
        <div
          className={`flex justify-center transition-opacity duration-500 ${
            zen ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <SelectionBar />
        </div>
      </div>
    </div>
  );
}
