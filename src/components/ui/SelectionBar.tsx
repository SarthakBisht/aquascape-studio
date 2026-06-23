"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { getMaterial } from "@/data/hardscapeMaterials";
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
  const updateHardscape = useStudioStore((s) => s.updateHardscape);
  const duplicateHardscape = useStudioStore((s) => s.duplicateHardscape);
  const removeHardscape = useStudioStore((s) => s.removeHardscape);
  const selectItem = useStudioStore((s) => s.selectItem);

  if (mode !== "design" || !selectedId) return null;
  const item = hardscape.find((h) => h.id === selectedId);
  if (!item) return null;
  const mat = getMaterial(item.materialId);

  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-slate-100 shadow-xl backdrop-blur-md">
      <span className="mr-1 text-xs font-medium text-cyan-300">
        {mat?.label ?? "Item"}
      </span>
      <div className="flex overflow-hidden rounded-md border border-white/10">
        {MODES.map((m) => (
          <Btn
            key={m.id}
            active={transformMode === m.id}
            onClick={() => setTransformMode(m.id)}
          >
            {m.label}
          </Btn>
        ))}
      </div>
      <span className="mx-1 h-5 w-px bg-white/10" />
      <Btn
        onClick={() =>
          updateHardscape(item.id, { seed: Math.floor(Math.random() * 1e9) })
        }
        title="Generate a new random shape"
      >
        ♻ Regenerate
      </Btn>
      <Btn onClick={() => duplicateHardscape(item.id)}>⧉ Duplicate</Btn>
      <Btn onClick={() => removeHardscape(item.id)} className="!bg-rose-500/80 !text-white hover:!bg-rose-500">
        🗑 Delete
      </Btn>
      <Btn onClick={() => selectItem(null)}>Done</Btn>
    </div>
  );
}
