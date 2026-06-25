"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { HARDSCAPE_MATERIALS } from "@/data/hardscapeMaterials";
import { Panel, Btn, Swatch } from "./primitives";
import type { HardscapeKind } from "@/lib/types";

function Group({ kind, title }: { kind: HardscapeKind; title: string }) {
  const beginPlacing = useStudioStore((s) => s.beginPlacing);
  const placingId = useStudioStore((s) => s.placingMaterialId);
  const items = HARDSCAPE_MATERIALS.filter((m) => m.kind === kind);
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-stone">
        {title}
      </div>
      <div className="space-y-1.5">
        {items.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-2 rounded-md bg-mist/[0.05] px-2 py-1.5"
          >
            <Swatch color={m.color} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{m.label}</div>
              <div className="truncate text-[10px] text-stone">{m.blurb}</div>
            </div>
            <Btn active={placingId === m.id} onClick={() => beginPlacing(m.id)}>
              {placingId === m.id ? "Placing…" : "Place"}
            </Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HardscapePalette() {
  const tool = useStudioStore((s) => s.tool);
  const cancelPlacing = useStudioStore((s) => s.cancelPlacing);
  return (
    <Panel title="Hardscape">
      <Group kind="rock" title="Rocks" />
      <Group kind="wood" title="Driftwood" />
      {tool === "place" ? (
        <button
          onClick={() => cancelPlacing()}
          className="mt-2 w-full rounded-md bg-moss/20 px-2 py-1.5 text-[11px] text-moss ring-1 ring-moss/40 transition-colors hover:bg-moss/30"
        >
          ✦ Click in the scene to place · Esc / here to cancel
        </button>
      ) : (
        <p className="mt-2 text-[10px] leading-snug text-stone/70">
          Pick a stone, then click in the scene to place it — inside the tank or
          outside. Select it to move, rotate, scale, stack, or regenerate.
        </p>
      )}
    </Panel>
  );
}
