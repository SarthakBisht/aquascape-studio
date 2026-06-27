"use client";

import { useRef } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { exportLayoutFile, importLayoutFile } from "@/lib/persistence";
import { growthLimit } from "@/lib/units";
import { Btn, Disclosure, Select, Slider } from "./primitives";
import type { Quality, GuideFace, GuideRatio } from "@/lib/types";

const QUALITIES: Quality[] = ["low", "medium", "high"];

export function Toolbar({
  onScreenshot,
  onSaveScape,
  onOpenCalc,
}: {
  onScreenshot: () => void;
  onSaveScape: () => void;
  onOpenCalc: () => void;
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
  const maxGrowth = growthLimit(useStudioStore((s) => s.tank));
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
    <header className="pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-mist/10 bg-soil/65 px-4 py-2.5 text-mist shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md">
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
        <Btn onClick={onSaveScape} title="Save this scape to your gallery">
          ✓ Save
        </Btn>
        <Btn
          onClick={() => setGallery(true)}
          title="Browse your saved aquascapes"
        >
          ▦ Gallery{scapeCount > 0 ? ` (${scapeCount})` : ""}
        </Btn>
        <Btn onClick={onOpenCalc} title="Aquascaping calculators (volume, dosing, CO₂, equipment…)">
          🧮 Calc
        </Btn>

        <span className="mx-0.5 h-5 w-px bg-mist/10" />

        {/* View / display settings */}
        <Disclosure summary="View ▾">
          <label className="flex items-center justify-between gap-4 text-[11px] text-stone">
            ☾ Zen mode
            <Btn
              active={zen}
              onClick={toggleZen}
              title="Hide the interface and just breathe"
            >
              {zen ? "On" : "Off"}
            </Btn>
          </label>
          <label className="flex items-center justify-between gap-4 text-[11px] text-stone">
            Plants
            <Btn
              active={!showPlants}
              onClick={togglePlants}
              title="Hide plants to view the hardscape alone"
            >
              {showPlants ? "Visible" : "Hidden"}
            </Btn>
          </label>
          <label className="flex items-center justify-between gap-4 text-[11px] text-stone">
            Guides
            <Btn active={showGuides} onClick={toggleGuides}>
              {showGuides ? "On" : "Off"}
            </Btn>
          </label>
          {showGuides && (
            <div className="flex gap-2">
              <Select
                value={guides.face}
                onChange={(e) => setGuides({ face: e.target.value as GuideFace })}
                aria-label="Which glass the grid sits on"
                className="flex-1 capitalize"
              >
                <option value="front">Front</option>
                <option value="back">Back</option>
                <option value="both">Both</option>
              </Select>
              <Select
                value={guides.ratio}
                onChange={(e) =>
                  setGuides({ ratio: e.target.value as GuideRatio })
                }
                aria-label="Composition ratio"
                className="flex-1 capitalize"
              >
                <option value="thirds">Thirds</option>
                <option value="golden">Golden</option>
                <option value="both">Both</option>
              </Select>
            </div>
          )}
          <Slider
            label="Growth"
            value={Math.min(growth, maxGrowth)}
            min={0}
            max={maxGrowth}
            step={0.01}
            onChange={setGrowth}
            format={(v) => `${Math.round((v / (maxGrowth || 1)) * 100)}%`}
          />
          <label className="flex items-center justify-between gap-4 text-[11px] text-stone">
            Quality
            <Select
              value={quality}
              onChange={(e) => setQuality(e.target.value as Quality)}
              aria-label="Render quality"
              className="capitalize"
            >
              {QUALITIES.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </Select>
          </label>
        </Disclosure>

        {/* Secondary file actions */}
        <Disclosure summary="⋯ More">
          <Btn onClick={onScreenshot} title="Save a picture">
            Capture
          </Btn>
          <Btn onClick={() => exportLayoutFile(getLayout())}>Export</Btn>
          <Btn onClick={() => fileRef.current?.click()}>Import</Btn>
          <Btn onClick={() => confirm("Clear the whole scape?") && reset()}>
            Reset
          </Btn>
        </Disclosure>
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
