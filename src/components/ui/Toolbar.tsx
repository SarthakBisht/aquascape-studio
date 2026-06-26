"use client";

import { useRef } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { exportLayoutFile, importLayoutFile } from "@/lib/persistence";
import { Btn } from "./primitives";
import type { Quality, GuideFace, GuideRatio } from "@/lib/types";

const QUALITIES: Quality[] = ["low", "medium", "high"];

export function Toolbar({
  onScreenshot,
  onSaveScape,
}: {
  onScreenshot: () => void;
  onSaveScape: () => void;
}) {
  const mode = useStudioStore((s) => s.mode);
  const setMode = useStudioStore((s) => s.setMode);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  const canUndo = useStudioStore((s) => s.past.length > 0);
  const canRedo = useStudioStore((s) => s.future.length > 0);
  const showGuides = useStudioStore((s) => s.showGuides);
  const toggleGuides = useStudioStore((s) => s.toggleGuides);
  const guides = useStudioStore((s) => s.guides);
  const setGuides = useStudioStore((s) => s.setGuides);
  const growth = useStudioStore((s) => s.growth);
  const setGrowth = useStudioStore((s) => s.setGrowth);
  const quality = useStudioStore((s) => s.quality);
  const setQuality = useStudioStore((s) => s.setQuality);
  const zen = useStudioStore((s) => s.zen);
  const toggleZen = useStudioStore((s) => s.toggleZen);
  const showPlants = useStudioStore((s) => s.showPlants);
  const togglePlants = useStudioStore((s) => s.togglePlants);
  const getLayout = useStudioStore((s) => s.getLayout);
  const loadLayout = useStudioStore((s) => s.loadLayout);
  const cleanScape = useStudioStore((s) => s.cleanScape);
  const style = useStudioStore((s) => s.style);
  const reset = useStudioStore((s) => s.reset);
  const setGallery = useLibraryStore((s) => s.setGallery);
  const scapeCount = useLibraryStore((s) => s.scapes.length);

  const fileRef = useRef<HTMLInputElement>(null);

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      loadLayout(await importLayoutFile(file));
    } catch (err) {
      alert((err as Error).message);
    }
    e.target.value = "";
  };

  return (
    <header className="pointer-events-auto flex items-center gap-4 rounded-lg border border-mist/10 bg-soil/65 px-4 py-2.5 text-mist shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md">
      {/* wordmark */}
      <div className="flex items-center gap-2.5">
        <span
          className="h-3.5 w-3.5 rounded-full"
          style={{
            background: "radial-gradient(circle at 32% 30%, #c2a06a, #6f6a4a)",
          }}
        />
        <div className="leading-none">
          <span className="font-display text-[15px] tracking-wide text-mist">
            Aquascape Studio
          </span>
          <span className="ml-2 hidden font-display text-[11px] italic text-stone/70 sm:inline">
            learn from nature
          </span>
        </div>
      </div>

      <div className="flex overflow-hidden rounded-md border border-mist/10">
        <Btn active={mode === "design"} onClick={() => setMode("design")}>
          Design
        </Btn>
        <Btn active={mode === "underwater"} onClick={() => setMode("underwater")}>
          Underwater
        </Btn>
      </div>

      <div className="flex items-center gap-1">
        <Btn onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
          ↶
        </Btn>
        <Btn onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
          ↷
        </Btn>
      </div>

      <Btn
        onClick={cleanScape}
        title={`Tidy & fill the scape (${style ?? "nature"} style): remove pieces left outside the tank, reseat the rest on the substrate, and plant the missing layers`}
      >
        ✨ Clean
      </Btn>

      <div className="ml-auto flex items-center gap-2">
        <Btn active={zen} onClick={toggleZen} title="Hide the interface and just breathe">
          ☾ Zen
        </Btn>

        <span className="mx-0.5 h-5 w-px bg-mist/10" />

        <Btn
          active={!showPlants}
          onClick={togglePlants}
          title="Hide plants to view the hardscape alone"
        >
          {showPlants ? "Hide plants" : "Show plants"}
        </Btn>

        <Btn active={showGuides} onClick={toggleGuides} title="Composition guides">
          Guides
        </Btn>
        {showGuides && (
          <>
            <select
              value={guides.face}
              onChange={(e) => setGuides({ face: e.target.value as GuideFace })}
              title="Which glass the grid sits on"
              className="rounded-md border border-mist/10 bg-mist/[0.06] px-1.5 py-1 text-xs capitalize text-mist"
            >
              <option value="front" className="bg-soil">Front</option>
              <option value="back" className="bg-soil">Back</option>
              <option value="both" className="bg-soil">Both</option>
            </select>
            <select
              value={guides.ratio}
              onChange={(e) => setGuides({ ratio: e.target.value as GuideRatio })}
              title="Composition ratio"
              className="rounded-md border border-mist/10 bg-mist/[0.06] px-1.5 py-1 text-xs text-mist"
            >
              <option value="thirds" className="bg-soil">Thirds</option>
              <option value="golden" className="bg-soil">Golden</option>
              <option value="both" className="bg-soil">Both</option>
            </select>
          </>
        )}
        <label
          className="flex items-center gap-1.5 text-[11px] font-light text-stone"
          title="How grown-in the plants look"
        >
          Growth
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={growth}
            onChange={(e) => setGrowth(Number(e.target.value))}
            className="h-1 w-20 cursor-pointer accent-moss"
          />
        </label>

        <label className="flex items-center gap-1.5 text-[11px] font-light text-stone">
          Quality
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as Quality)}
            className="rounded-md border border-mist/10 bg-mist/[0.06] px-1.5 py-1 text-xs capitalize text-mist"
          >
            {QUALITIES.map((q) => (
              <option key={q} value={q} className="bg-soil">
                {q}
              </option>
            ))}
          </select>
        </label>

        <span className="mx-0.5 h-5 w-px bg-mist/10" />

        <Btn onClick={onSaveScape} title="Save this scape to your gallery">
          ✓ Save
        </Btn>
        <Btn
          onClick={() => setGallery(true)}
          title="Browse your saved aquascapes"
        >
          ▦ Gallery{scapeCount > 0 ? ` (${scapeCount})` : ""}
        </Btn>

        <span className="mx-0.5 h-5 w-px bg-mist/10" />

        <Btn onClick={onScreenshot} title="Save a picture">
          Capture
        </Btn>
        <Btn onClick={() => exportLayoutFile(getLayout())}>Export</Btn>
        <Btn onClick={() => fileRef.current?.click()}>Import</Btn>
        <Btn onClick={() => confirm("Clear the whole scape?") && reset()}>
          Reset
        </Btn>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={onImport}
        />
      </div>
    </header>
  );
}
