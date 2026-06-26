"use client";

import { useRef, useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { PLANT_SPECIES, PLANT_CATEGORIES } from "@/data/plants";
import { processPlantImage } from "@/lib/plantImage";
import { AddPlantModal } from "./AddPlantModal";
import { Panel, Btn, Swatch } from "./primitives";
import type { Difficulty, PlantCategory, PlantSpecies } from "@/lib/types";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const DIFF_COLOR: Record<Difficulty, string> = {
  easy: "text-emerald-300",
  medium: "text-amber-300",
  hard: "text-rose-300",
};

function BrushSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[10px] text-stone">
      <span className="w-14 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-moss"
      />
      <span className="w-10 shrink-0 text-right tabular-nums text-mist/80">
        {value}
        {suffix}
      </span>
    </label>
  );
}

function PlantRow({
  species,
  active,
  isCustom,
  onSelect,
  onEdit,
}: {
  species: PlantSpecies;
  active: boolean;
  isCustom: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const custom = useStudioStore((s) => s.customPlantTextures[species.id]);
  const setPlantTexture = useStudioStore((s) => s.setPlantTexture);
  const clearPlantTexture = useStudioStore((s) => s.clearPlantTexture);
  const removeCustomPlant = useStudioStore((s) => s.removeCustomPlant);

  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const thumb = custom ?? species.texture;
  const hasImage = !!thumb;

  async function handleFile(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    setBusy(true);
    setProgress(0);
    try {
      const url = await processPlantImage(file, setProgress);
      setPlantTexture(species.id, url);
    } catch (e) {
      alert(`Couldn't process that image: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onSelect}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files?.[0]);
      }}
      className={`relative flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
        active ? "bg-moss/20 ring-1 ring-moss" : "bg-mist/[0.05] hover:bg-mist/[0.1]"
      } ${dragOver ? "ring-1 ring-moss-bright" : ""}`}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          className="h-6 w-6 shrink-0 rounded object-cover ring-1 ring-mist/15"
        />
      ) : (
        <Swatch color={species.color} />
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{species.name}</div>
        <div className="truncate text-[10px] italic text-stone">
          {species.latin}
        </div>
      </div>

      <div
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        {isCustom ? (
          <>
            <button
              onClick={onEdit}
              title="Edit this plant"
              className="rounded px-1 text-[11px] text-stone hover:text-moss"
            >
              ✎
            </button>
            <button
              onClick={() => removeCustomPlant(species.id)}
              title="Delete this custom plant"
              className="rounded px-1 text-[11px] text-stone hover:text-rose-300"
            >
              🗑
            </button>
          </>
        ) : (
          <>
            {custom && (
              <button
                onClick={() => clearPlantTexture(species.id)}
                title="Remove custom image"
                className="rounded px-1 text-[11px] text-stone hover:text-rose-300"
              >
                ✕
              </button>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              title="Use your own plant photo (background removed automatically)"
              className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                hasImage
                  ? "text-stone hover:text-moss"
                  : "text-moss ring-1 ring-moss/40 hover:bg-moss/15"
              }`}
            >
              {hasImage ? "↺ img" : "＋ img"}
            </button>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {busy && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-md bg-soil/85 text-[10px] text-moss">
          <span className="h-3 w-3 animate-spin rounded-full border border-moss border-t-transparent" />
          removing background… {Math.round(progress * 100)}%
        </div>
      )}
    </div>
  );
}

export function PlantBrowser() {
  const activePlantId = useStudioStore((s) => s.activePlantId);
  const setActivePlant = useStudioStore((s) => s.setActivePlant);
  const tool = useStudioStore((s) => s.tool);
  const setTool = useStudioStore((s) => s.setTool);
  const plants = useStudioStore((s) => s.plants);
  const customPlants = useStudioStore((s) => s.customPlants);
  const brush = useStudioStore((s) => s.brush);
  const setBrush = useStudioStore((s) => s.setBrush);

  const [cat, setCat] = useState<PlantCategory | "all">("all");
  const [diff, setDiff] = useState<Difficulty | "all">("all");
  // modal: closed = null, new plant = { editId: null }, editing = { editId }
  const [editor, setEditor] = useState<{ editId: string | null } | null>(null);
  const customIds = new Set(customPlants.map((p) => p.id));

  const filtered = [...PLANT_SPECIES, ...customPlants].filter(
    (p) =>
      (cat === "all" || p.category === cat) &&
      (diff === "all" || p.difficulty === diff),
  );

  return (
    <Panel title="Plants" className="flex max-h-full flex-col">
      <div className="mb-2 flex flex-wrap gap-1">
        <Btn active={cat === "all"} onClick={() => setCat("all")}>
          All
        </Btn>
        {PLANT_CATEGORIES.map((c) => (
          <Btn key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
            {c.label}
          </Btn>
        ))}
      </div>
      <div className="mb-2 flex gap-1">
        <Btn active={diff === "all"} onClick={() => setDiff("all")}>
          Any
        </Btn>
        {DIFFICULTIES.map((d) => (
          <Btn key={d} active={diff === d} onClick={() => setDiff(d)}>
            <span className="capitalize">{d}</span>
          </Btn>
        ))}
      </div>

      <div
        className="-mr-1 flex-1 space-y-1.5 overflow-y-auto pr-1"
        onDragOver={(e) => e.preventDefault()}
      >
        {filtered.map((p) => (
          <PlantRow
            key={p.id}
            species={p}
            active={activePlantId === p.id}
            isCustom={customIds.has(p.id)}
            onSelect={() =>
              setActivePlant(activePlantId === p.id ? null : p.id)
            }
            onEdit={() => setEditor({ editId: p.id })}
          />
        ))}
      </div>

      <button
        onClick={() => setEditor({ editId: null })}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-moss/40 px-2 py-1.5 text-[11px] text-moss transition-colors hover:bg-moss/10"
      >
        ＋ Add custom plant
      </button>
      <AddPlantModal
        open={editor !== null}
        editId={editor?.editId ?? null}
        onClose={() => setEditor(null)}
      />

      <button
        onClick={() => setTool(tool === "trim" ? "select" : "trim")}
        title="Trim & shape planted foliage — drag the scissors over the canopy to cut it shorter"
        className={`mt-2 flex w-full items-center justify-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
          tool === "trim"
            ? "bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/50 hover:bg-amber-400/30"
            : "border border-dashed border-amber-300/30 text-amber-200/80 hover:bg-amber-400/10"
        }`}
      >
        {tool === "trim" ? "✂ Trimming — click to stop & orbit" : "✂ Trim & shape"}
      </button>

      <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-stone">
          Brush
        </div>
        <BrushSlider label="Area" value={brush.radius} min={2} max={20} step={1} suffix="cm" onChange={(v) => setBrush({ radius: v })} />
        <BrushSlider label="Density" value={brush.density} min={6} max={60} step={2} suffix="" onChange={(v) => setBrush({ density: v })} />
        <BrushSlider label="Size" value={brush.scale} min={0.5} max={2} step={0.1} suffix="×" onChange={(v) => setBrush({ scale: v })} />
      </div>

      <p className="mt-2 text-[10px] leading-snug text-stone">
        {activePlantId
          ? "🖌️ Click in the tank to fill an area with this plant."
          : "Select a plant, then paint it onto the substrate."}
        <span className="ml-1 text-stone/70">({plants.length} patches)</span>
      </p>
      <p className="mt-1 text-[10px] leading-snug text-stone/70">
        Tip: drag a photo onto a plant (or “＋ img”) to use your own — the
        background is removed automatically. Highlighted plants have no image yet.
      </p>
    </Panel>
  );
}
