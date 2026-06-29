"use client";

import { useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { HARDSCAPE_MATERIALS } from "@/data/hardscapeMaterials";
import { DrawShapeModal } from "./DrawShapeModal";
import { PhotoTo3DModal } from "./PhotoTo3DModal";
import { Panel, Btn, Swatch } from "./primitives";
import type { PlacementSpec, RockForm } from "@/lib/types";

const ROCK_FORM_STAMPS: { form: RockForm; label: string }[] = [
  { form: "slab", label: "🧱 Slab" },
  { form: "spire", label: "🗼 Spire" },
  { form: "arch", label: "🌉 Arch" },
  { form: "bowl", label: "🥣 Bowl" },
];

function specEq(a: PlacementSpec | null, b: PlacementSpec): boolean {
  if (!a || a.type !== b.type) return false;
  if (a.type === "material" && b.type === "material") return a.materialId === b.materialId;
  if (a.type === "form" && b.type === "form") return a.form === b.form;
  return true; // drift / model — one of each
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[10px] uppercase tracking-wide text-stone">{children}</div>
  );
}

// Every palette entry is a uniform "stamp": click → arm the cursor → ghost-place
// it (same gesture for procedural rocks, forms, driftwood, and your .glb).
function Stamp({
  spec,
  label,
  color,
}: {
  spec: PlacementSpec;
  label: string;
  color?: string;
}) {
  const placing = useStudioStore((s) => s.placing);
  const beginPlacing = useStudioStore((s) => s.beginPlacing);
  const active = specEq(placing, spec);
  return (
    <button
      type="button"
      onClick={() => beginPlacing(spec)}
      title={`Place ${label}`}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors ${
        active
          ? "bg-moss/20 text-moss ring-1 ring-moss/50"
          : "bg-mist/[0.05] text-mist hover:bg-mist/[0.1]"
      }`}
    >
      {color ? <Swatch color={color} /> : null}
      <span className="min-w-0 flex-1 truncate">{active ? "Placing…" : label}</span>
    </button>
  );
}

export function HardscapePalette() {
  const tool = useStudioStore((s) => s.tool);
  const cancelPlacing = useStudioStore((s) => s.cancelPlacing);
  const baseRockModelUrl = useStudioStore((s) => s.baseRockModelUrl);
  const setModel = useStudioStore((s) => s.setBaseRockModel);
  const clearModel = useStudioStore((s) => s.clearBaseRockModel);
  const useAll = useStudioStore((s) => s.useModelForAllRocks);
  const setUseAll = useStudioStore((s) => s.setUseModelForAllRocks);
  const [drawOpen, setDrawOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  const rocks = HARDSCAPE_MATERIALS.filter((m) => m.kind === "rock");
  const woods = HARDSCAPE_MATERIALS.filter((m) => m.kind === "wood");

  return (
    <Panel title="Hardscape">
      <SectionLabel>Rocks</SectionLabel>
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {rocks.map((m) => (
          <Stamp key={m.id} spec={{ type: "material", materialId: m.id }} label={m.label} color={m.color} />
        ))}
        {ROCK_FORM_STAMPS.map((f) => (
          <Stamp key={f.form} spec={{ type: "form", form: f.form }} label={f.label} />
        ))}
      </div>

      <SectionLabel>Wood</SectionLabel>
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {woods.map((m) => (
          <Stamp key={m.id} spec={{ type: "material", materialId: m.id }} label={m.label} color={m.color} />
        ))}
        <Stamp spec={{ type: "drift" }} label="🌿 Driftwood" />
      </div>

      <SectionLabel>Yours</SectionLabel>
      <div className="mb-3 rounded-md border border-moss/25 bg-moss/[0.05] p-2">
        {baseRockModelUrl ? (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <Stamp spec={{ type: "model" }} label="🪨 My model" />
              <button
                onClick={() => clearModel()}
                className="rounded-md bg-mist/[0.05] px-2 py-1.5 text-[11px] text-stone hover:text-rose-300"
              >
                ✕ Remove
              </button>
            </div>
            <label className="mt-2 flex items-center gap-2 text-[10px] text-stone">
              <input
                type="checkbox"
                checked={useAll}
                onChange={(e) => setUseAll(e.target.checked)}
                className="accent-moss"
              />
              Use this model for <em className="not-italic text-mist/80">all</em> rocks
            </label>
          </>
        ) : (
          <label className="block cursor-pointer rounded border border-dashed border-mist/25 px-2 py-2 text-center text-[10px] text-stone hover:text-mist">
            ⬆ Upload a .glb rock — place it like any stamp
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

      <SectionLabel>Create</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <Btn onClick={() => setDrawOpen(true)}>✏️ Draw → 3D</Btn>
        <Btn onClick={() => setPhotoOpen(true)}>🖼 Photo → 3D</Btn>
      </div>

      <DrawShapeModal open={drawOpen} onClose={() => setDrawOpen(false)} />
      <PhotoTo3DModal open={photoOpen} onClose={() => setPhotoOpen(false)} />

      {tool === "place" ? (
        <button
          onClick={() => cancelPlacing()}
          className="mt-2 w-full rounded-md bg-moss/20 px-2 py-1.5 text-[11px] text-moss ring-1 ring-moss/40 transition-colors hover:bg-moss/30"
        >
          ✦ Click in the scene to place · click again for more · Esc to stop
        </button>
      ) : (
        <p className="mt-2 text-[10px] leading-snug text-stone/70">
          Pick a stamp, then click in the tank to drop it (inside or outside).
          Click again to drop more. Select a piece to move, scale & customize.
        </p>
      )}
    </Panel>
  );
}
