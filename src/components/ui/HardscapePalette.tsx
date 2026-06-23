"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { HARDSCAPE_MATERIALS } from "@/data/hardscapeMaterials";
import { Panel, Btn, Swatch } from "./primitives";
import type { HardscapeKind } from "@/lib/types";

function Group({ kind, title }: { kind: HardscapeKind; title: string }) {
  const addHardscape = useStudioStore((s) => s.addHardscape);
  const items = HARDSCAPE_MATERIALS.filter((m) => m.kind === kind);
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">
        {title}
      </div>
      <div className="space-y-1.5">
        {items.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1.5"
          >
            <Swatch color={m.color} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{m.label}</div>
              <div className="truncate text-[10px] text-slate-400">{m.blurb}</div>
            </div>
            <Btn onClick={() => addHardscape(m.id)}>+ Add</Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HardscapePalette() {
  return (
    <Panel title="Hardscape">
      <Group kind="rock" title="Rocks" />
      <Group kind="wood" title="Driftwood" />
      <p className="mt-2 text-[10px] leading-snug text-slate-500">
        Each piece is procedurally generated — every &ldquo;Add&rdquo; is unique.
        Select it in the tank to move, rotate, scale, stack, or regenerate.
      </p>
    </Panel>
  );
}
