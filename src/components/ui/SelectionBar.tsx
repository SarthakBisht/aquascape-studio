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
  // Customize is selection-scoped, so it lives here (above this bar) rather than
  // in the left rail. Toggle stays open across selecting different pieces.
  const [showCustomize, setShowCustomize] = useState(false);

  if (mode !== "design" || !selectedId) return null;
  const item = hardscape.find((h) => h.id === selectedId);
  if (!item) return null;
  const mat = getMaterial(item.materialId);

  return (
    <div className="pointer-events-auto relative flex max-w-[calc(100vw-1rem)] flex-wrap items-center justify-center gap-2 rounded-lg border border-mist/10 bg-soil/80 px-3 py-2 text-mist shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md">
      {showCustomize && (
        <div className="calm-scroll absolute bottom-full left-1/2 mb-2 max-h-[60vh] w-72 max-w-[calc(100vw-1rem)] -translate-x-1/2 overflow-y-auto">
          <HardscapeEditPanel />
        </div>
      )}
      <span className="mr-1 font-display text-xs text-moss">
        {mat?.label ?? "Item"}
      </span>
      <div className="flex overflow-hidden rounded-md border border-mist/10">
        {MODES.map((m) => (
          <Btn
            key={m.id}
            active={transformMode === m.id}
            onClick={() => {
              setTransformMode(m.id);
              setTool("select"); // exit sculpt/brush so the gizmo + orbit return
            }}
          >
            {m.label}
          </Btn>
        ))}
      </div>
      <span className="mx-1 h-5 w-px bg-mist/10" />
      <Btn active={showCustomize} onClick={() => setShowCustomize((v) => !v)}>
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
      <Btn onClick={() => deselectAll()}>Done</Btn>
    </div>
  );
}
