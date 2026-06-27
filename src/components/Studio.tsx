"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useStudioStore } from "@/store/useStudioStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { defaultCameraPosition } from "@/lib/units";
import { screenshotCanvas, captureThumbnail } from "@/lib/persistence";
import { TankScene } from "./scene/TankScene";
import { Toolbar } from "./ui/Toolbar";
import { Gallery } from "./ui/Gallery";
import { CalculatorOverlay } from "./ui/CalculatorOverlay";
import { LeftRail, type Section } from "./ui/LeftRail";
import { SelectionBar } from "./ui/SelectionBar";
import { MobileNotice } from "./ui/MobileNotice";
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
  const mode = useStudioStore((s) => s.mode);
  const zen = useStudioStore((s) => s.zen);
  const selectedId = useStudioStore((s) => s.selectedId);
  const empty = useStudioStore(
    (s) => s.hardscape.length === 0 && s.plants.length === 0,
  );
  const galleryOpen = useLibraryStore((s) => s.galleryOpen);
  const [calcOpen, setCalcOpen] = useState(false);
  const [section, setSection] = useState<Section>("tank");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Keep the active section in step with what the user is doing: selecting a
  // piece reveals its Customize controls; flooding the tank surfaces Fish.
  useEffect(() => {
    if (selectedId && mode === "design") setSection("hardscape");
  }, [selectedId, mode]);
  useEffect(() => {
    setSection((cur) =>
      mode === "underwater" ? "fish" : cur === "fish" ? "tank" : cur,
    );
  }, [mode]);

  // WebGL only mounts on the client — avoids SSR/window issues.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // End a draw stroke whenever the pointer is released, even off the canvas.
  useEffect(() => {
    const up = () => endStroke();
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  // Undo / redo shortcuts: Ctrl/⌘+Z, Ctrl+Shift+Z or Ctrl+Y (ignored while
  // typing in a form field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable);
      // Escape = global "drop everything" → deselect + back to orbit.
      if (e.key === "Escape" && !typing) {
        useStudioStore.getState().deselectAll();
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k !== "z" && k !== "y") return;
      if (typing) return;
      e.preventDefault();
      const store = useStudioStore.getState();
      if (k === "y" || (k === "z" && e.shiftKey)) store.redo();
      else store.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onScreenshot = () => {
    if (canvasRef.current) screenshotCanvas(canvasRef.current);
  };

  // Save the current scape into the local gallery. Like a real aquascaping
  // gallery, tiles show the *flooded* tank — so we flood it (switch to
  // underwater), let the water/fish settle for a beat, capture, then store.
  // Updates the open scape if there is one, else creates a named entry and
  // reveals the gallery. Asks for the name up front (before flooding) so the
  // prompt doesn't interrupt the capture.
  const onSaveScape = () => {
    if (!canvasRef.current) return;
    const store = useStudioStore.getState();
    const lib = useLibraryStore.getState();
    const existing =
      lib.currentId && lib.scapes.some((s) => s.id === lib.currentId);

    let name: string | null = null;
    if (!existing) {
      name = prompt("Name this aquascape", "Untitled scape");
      if (name === null) return; // cancelled
    }

    store.setMode("underwater"); // present it underwater for the gallery shot

    // Give the water surface, caustics and fish a moment to mount + animate
    // before grabbing the frame.
    window.setTimeout(() => {
      if (!canvasRef.current) return;
      const thumb = captureThumbnail(canvasRef.current);
      const layout = useStudioStore.getState().getLayout();
      try {
        if (existing) {
          lib.updateScape(lib.currentId!, thumb, layout);
        } else {
          lib.createScape(name!.trim() || "Untitled scape", thumb, layout);
          lib.setGallery(true);
        }
      } catch {
        alert(
          "Couldn't save — local storage may be full. Delete a scape or two and try again.",
        );
      }
    }, 500);
  };

  // Render nothing interactive until mounted on the client. This keeps WebGL
  // off the server and avoids hydration mismatches from persisted state.
  if (!mounted) {
    return (
      <div className="grid h-full w-full place-items-center bg-mist">
        <span className="font-display text-sm italic tracking-wide text-sumi/50">
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
          gl.localClippingEnabled = true;
        }}
        onPointerMissed={() => useStudioStore.getState().deselectAll()}
      >
        <TankScene />
      </Canvas>

      {/* gallery lighting — scene background is always the dark gallery color,
          so these overlays always enhance the exhibit feel. */}
      <div className="gallery-glow" aria-hidden />
      <div className="gallery-vignette" aria-hidden />

      {/* an empty tank is an invitation */}
      {empty && !zen && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-[16%]">
          <p className="font-display text-base italic text-mist/35">
            Begin with a single stone.
          </p>
        </div>
      )}

      {/* UI overlay — dissolves in Zen mode so only the scape remains */}
      <div className="pointer-events-none absolute inset-0 flex flex-col gap-2 p-2 sm:gap-3 sm:p-3">
        <Toolbar
          onScreenshot={onScreenshot}
          onSaveScape={onSaveScape}
          onOpenCalc={() => setCalcOpen(true)}
        />
        <div
          className={`flex min-h-0 flex-1 transition-all duration-[1100ms] ease-out ${
            zen ? "pointer-events-none translate-y-1 opacity-0" : "opacity-100"
          }`}
        >
          <LeftRail active={section} onSelect={setSection} />
          <div className="flex-1" />
        </div>
        <div
          className={`flex justify-center transition-opacity duration-500 ${
            zen ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <SelectionBar />
        </div>
      </div>

      <MobileNotice />

      {galleryOpen && <Gallery />}
      {calcOpen && <CalculatorOverlay onClose={() => setCalcOpen(false)} />}
    </div>
  );
}
