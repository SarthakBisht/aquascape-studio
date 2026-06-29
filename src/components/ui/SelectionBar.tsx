"use client";

import { useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { getMaterial } from "@/data/hardscapeMaterials";
import { HardscapeEditPanel } from "./HardscapeEditPanel";
import { Btn } from "./primitives";
import type { TransformMode } from "@/lib/types";

const MODES: { id: TransformMode; label: string }[] = [
  { id: "translate", label: "Move" },
  { id: "rotate", label: "Rotate" },
  { id: "scale", label: "Scale" },
];

// Selection editor — a right-docked panel (contextual / temporary), so the
// Customize controls sit on the screen edge and never cover the centered rock.
// The left rail holds the always-available sections.
export function SelectionBar() {
  const mode = useStudioStore((s) => s.mode);
  const selectedId = useStudioStore((s) => s.selectedId);
  const hardscape = useStudioStore((s) => s.hardscape);
  const transformMode = useStudioStore((s) => s.transformMode);
  const setTransformMode = useStudioStore((s) => s.setTransformMode);
  const setTool = useStudioStore((s) => s.setTool);
  const updateHardscape = useStudioStore((s) => s.updateHardscape);
  const duplicateHardscape = useStudioStore((s) => s.duplicateHardscape);
  const removeHardscape = useStudioStore((s) => s.removeHardscape);
  const deselectAll = useStudioStore((s) => s.deselectAll);
  // Selecting a piece is the moment you want to tune it → Customize defaults open
  // (it's on the right edge now, so it can't hide the rock). Toggle to collapse.
  const [showCustomize, setShowCustomize] = useState(true);

  if (mode !== "design" || !selectedId) return null;
  const item = hardscape.find((h) => h.id === selectedId);
  if (!item) return null;
  const mat = getMaterial(item.materialId);

  return (
    <aside className="calm-scroll pointer-events-auto flex max-h-full w-72 max-w-[calc(100vw-1rem)] shrink-0 flex-col gap-2 self-start overflow-y-auto pl-0.5">
      <section className="rounded-lg border border-mist/10 bg-soil/80 p-3 text-mist shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="font-display text-xs text-moss">
            {mat?.label ?? "Item"}
          </span>
          <button
            onClick={() => deselectAll()}
            aria-label="Done"
            title="Done — deselect"
            className="rounded-md px-2 py-0.5 text-xs text-stone/80 transition-colors hover:bg-mist/[0.08] hover:text-mist"
          >
            ✕
          </button>
        </div>

        <div className="mb-2 flex overflow-hidden rounded-md border border-mist/10">
          {MODES.map((m) => (
            <Btn
              key={m.id}
              active={transformMode === m.id}
              className="flex-1 !rounded-none"
              onClick={() => {
                setTransformMode(m.id);
                setTool("select"); // exit sculpt/brush so the gizmo + orbit return
              }}
            >
              {m.label}
            </Btn>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1">
          <Btn
            active={showCustomize}
            onClick={() => setShowCustomize((v) => !v)}
          >
            ✎ Customize
          </Btn>
          <Btn
            onClick={() =>
              updateHardscape(item.id, { seed: Math.floor(Math.random() * 1e9) })
            }
            title="Generate a new random shape"
          >
            ♻ Regenerate
          </Btn>
          <Btn onClick={() => duplicateHardscape(item.id)}>⧉ Duplicate</Btn>
          <Btn
            onClick={() => removeHardscape(item.id)}
            className="!bg-[#a8584a]/85 !text-mist hover:!bg-[#b8624f]"
          >
            Remove
          </Btn>
        </div>
      </section>

      {showCustomize && <HardscapeEditPanel />}
    </aside>
  );
}
