"use client";

import { useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { HARDSCAPE_MATERIALS } from "@/data/hardscapeMaterials";
import { DEFAULT_DRIFT } from "@/lib/driftwood";
import { DrawShapeModal } from "./DrawShapeModal";
import { PhotoTo3DModal } from "./PhotoTo3DModal";
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

// Upload one .glb → every rock renders that shape (varied per-piece). Clear to
// return to the procedural rock library.
function BaseRockModelRow() {
  const url = useStudioStore((s) => s.baseRockModelUrl);
  const setModel = useStudioStore((s) => s.setBaseRockModel);
  const clearModel = useStudioStore((s) => s.clearBaseRockModel);
  return (
    <div className="mb-2 rounded-md border border-moss/30 bg-moss/[0.06] px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-medium text-moss">
          Base rock model (.glb)
        </span>
        {url && (
          <button
            onClick={() => clearModel()}
            className="text-[10px] text-stone hover:text-rose-300"
          >
            ✕ Clear
          </button>
        )}
      </div>
      {url ? (
        <p className="text-[10px] leading-snug text-stone">
          All rocks use your model — each placed rock varies in size & rotation.
        </p>
      ) : (
        <label className="block cursor-pointer rounded border border-dashed border-mist/25 px-2 py-1.5 text-center text-[10px] text-stone hover:text-mist">
          Upload a .glb — every rock will use its shape
          <input
            type="file"
            accept=".glb,model/gltf-binary"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setModel(f);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}

export function HardscapePalette() {
  const tool = useStudioStore((s) => s.tool);
  const cancelPlacing = useStudioStore((s) => s.cancelPlacing);
  const addGenerated = useStudioStore((s) => s.addGeneratedHardscape);
  const [drawOpen, setDrawOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  return (
    <Panel title="Hardscape">
      <BaseRockModelRow />
      <Group kind="rock" title="Rocks" />
      <Group kind="wood" title="Driftwood" />

      <div className="mb-1 mt-2 text-[10px] uppercase tracking-wide text-stone">
        Create your own
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Btn
          onClick={() =>
            addGenerated({
              kind: "wood",
              source: "drift",
              materialId: "spiderwood",
              textureId: "driftbark",
              drift: { ...DEFAULT_DRIFT },
            })
          }
        >
          🌿 Driftwood
        </Btn>
        <Btn onClick={() => setDrawOpen(true)}>✏️ Draw → 3D</Btn>
        <Btn onClick={() => setPhotoOpen(true)} className="col-span-2">
          🖼 Photo → 3D
        </Btn>
      </div>

      <div className="mb-1 mt-2 text-[10px] uppercase tracking-wide text-stone">
        Rock forms
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {(
          [
            ["slab", "🧱 Slab"],
            ["spire", "🗼 Spire"],
            ["arch", "🌉 Arch"],
            ["bowl", "🥣 Bowl"],
          ] as const
        ).map(([form, label]) => (
          <Btn
            key={form}
            onClick={() =>
              addGenerated({
                kind: "rock",
                source: "procedural",
                form,
                textureId: "granite",
              })
            }
          >
            {label}
          </Btn>
        ))}
      </div>

      <DrawShapeModal open={drawOpen} onClose={() => setDrawOpen(false)} />
      <PhotoTo3DModal open={photoOpen} onClose={() => setPhotoOpen(false)} />
      <p className="mt-1.5 text-[10px] leading-snug text-stone/70">
        Generates a unique branchy piece — select it to tune branches, gnarl &
        surface, then Regenerate for a new one.
      </p>

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
