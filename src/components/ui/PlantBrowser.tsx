"use client";

import { useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { PLANT_SPECIES, PLANT_CATEGORIES } from "@/data/plants";
import { Panel, Btn, Swatch } from "./primitives";
import type { Difficulty, PlantCategory } from "@/lib/types";

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
    <label className="flex items-center gap-2 text-[10px] text-slate-400">
      <span className="w-14 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-cyan-400"
      />
      <span className="w-10 shrink-0 text-right tabular-nums text-slate-300">
        {value}
        {suffix}
      </span>
    </label>
  );
}

export function PlantBrowser() {
  const activePlantId = useStudioStore((s) => s.activePlantId);
  const setActivePlant = useStudioStore((s) => s.setActivePlant);
  const plants = useStudioStore((s) => s.plants);
  const brush = useStudioStore((s) => s.brush);
  const setBrush = useStudioStore((s) => s.setBrush);

  const [cat, setCat] = useState<PlantCategory | "all">("all");
  const [diff, setDiff] = useState<Difficulty | "all">("all");

  const filtered = PLANT_SPECIES.filter(
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

      <div className="-mr-1 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {filtered.map((p) => {
          const active = activePlantId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setActivePlant(active ? null : p.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                active ? "bg-cyan-400/20 ring-1 ring-cyan-400" : "bg-white/5 hover:bg-white/10"
              }`}
            >
              <Swatch color={p.color} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{p.name}</div>
                <div className="truncate text-[10px] italic text-slate-400">
                  {p.latin}
                </div>
              </div>
              <div className="text-right text-[9px] leading-tight text-slate-400">
                <div className={`font-semibold capitalize ${DIFF_COLOR[p.difficulty]}`}>
                  {p.difficulty}
                </div>
                <div>
                  {p.light} light{p.co2 ? " · CO₂" : ""}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">
          Brush
        </div>
        <BrushSlider
          label="Area"
          value={brush.radius}
          min={2}
          max={20}
          step={1}
          suffix="cm"
          onChange={(v) => setBrush({ radius: v })}
        />
        <BrushSlider
          label="Density"
          value={brush.density}
          min={6}
          max={60}
          step={2}
          suffix=""
          onChange={(v) => setBrush({ density: v })}
        />
        <BrushSlider
          label="Size"
          value={brush.scale}
          min={0.5}
          max={2}
          step={0.1}
          suffix="×"
          onChange={(v) => setBrush({ scale: v })}
        />
      </div>

      <p className="mt-2 text-[10px] leading-snug text-slate-400">
        {activePlantId
          ? "🖌️ Click in the tank to fill an area with this plant."
          : "Select a plant, then paint it onto the substrate."}
        <span className="ml-1 text-slate-500">({plants.length} patches)</span>
      </p>
    </Panel>
  );
}
