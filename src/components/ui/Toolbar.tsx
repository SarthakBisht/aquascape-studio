"use client";

import { useRef } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { exportLayoutFile, importLayoutFile } from "@/lib/persistence";
import { Btn } from "./primitives";
import type { Quality } from "@/lib/types";

const QUALITIES: Quality[] = ["low", "medium", "high"];

export function Toolbar({ onScreenshot }: { onScreenshot: () => void }) {
  const mode = useStudioStore((s) => s.mode);
  const setMode = useStudioStore((s) => s.setMode);
  const showGuides = useStudioStore((s) => s.showGuides);
  const toggleGuides = useStudioStore((s) => s.toggleGuides);
  const grownIn = useStudioStore((s) => s.grownIn);
  const setGrownIn = useStudioStore((s) => s.setGrownIn);
  const quality = useStudioStore((s) => s.quality);
  const setQuality = useStudioStore((s) => s.setQuality);
  const zen = useStudioStore((s) => s.zen);
  const toggleZen = useStudioStore((s) => s.toggleZen);
  const getLayout = useStudioStore((s) => s.getLayout);
  const loadLayout = useStudioStore((s) => s.loadLayout);
  const reset = useStudioStore((s) => s.reset);

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

      <div className="ml-auto flex items-center gap-2">
        <Btn active={zen} onClick={toggleZen} title="Hide the interface and just breathe">
          ☾ Zen
        </Btn>

        <span className="mx-0.5 h-5 w-px bg-mist/10" />

        <Btn active={showGuides} onClick={toggleGuides} title="Composition guides">
          Guides
        </Btn>
        <Btn
          active={grownIn}
          onClick={() => setGrownIn(!grownIn)}
          title="Preview plants grown-in"
        >
          {grownIn ? "Grown-in" : "Just planted"}
        </Btn>

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
