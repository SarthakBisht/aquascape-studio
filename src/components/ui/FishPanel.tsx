"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { FISH_MODELS } from "@/data/fishModels";
import { fishCountLimit } from "@/lib/units";
import { Panel, Btn, Swatch } from "./primitives";
import type { FishPalette, FishPattern } from "@/lib/types";

const PATTERNS: { id: FishPattern; label: string; note: string }[] = [
  { id: "school", label: "School", note: "Move together as a shoal" },
  { id: "calm", label: "Calm", note: "Slow, gentle drifting" },
  { id: "dart", label: "Dart", note: "Quick darts and bursts" },
  { id: "scatter", label: "Scatter", note: "Spread out, independent" },
];

const PALETTES: { id: FishPalette; label: string; colors: string[] }[] = [
  { id: "tropical", label: "Tropical", colors: ["#e8743b", "#5b8def", "#d94f70"] },
  { id: "neon", label: "Neon", colors: ["#46ff8f", "#ff2db3", "#19e0ff"] },
  { id: "natural", label: "Natural", colors: ["#9a8c6e", "#bcb4a2", "#c2b280"] },
  { id: "mono", label: "Mono", colors: ["#cdd6da", "#b3bcc0", "#e2e8ea"] },
];

function Slider({
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
      <span className="w-12 shrink-0">{label}</span>
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

export function FishPanel() {
  const fish = useStudioStore((s) => s.fish);
  const setFish = useStudioStore((s) => s.setFish);
  const tank = useStudioStore((s) => s.tank);
  const interact = useStudioStore((s) => s.fishInteract);
  const setInteract = useStudioStore((s) => s.setFishInteract);
  const maxCount = fishCountLimit(tank);

  return (
    <Panel title="Fish">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-stone">
        Interact
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Btn
          active={interact === "feed"}
          onClick={() => setInteract(interact === "feed" ? "none" : "feed")}
          title="Drop food where you click — most of the fish swarm to eat it"
        >
          🍤 Feed
        </Btn>
        <Btn
          active={interact === "follow"}
          onClick={() => setInteract(interact === "follow" ? "none" : "follow")}
          title="Move the cursor over the tank — most of the fish trail it"
        >
          👆 Follow
        </Btn>
      </div>
      {interact !== "none" && (
        <p className="mt-1 text-[10px] leading-tight text-stone">
          {interact === "feed"
            ? "Click in the tank to drop food. Orbit is paused — toggle off to move the camera."
            : "Fish follow your cursor. Orbit is paused — toggle off to move the camera."}
        </p>
      )}

      <div className="mt-3 mb-1 text-[10px] uppercase tracking-wide text-stone">
        Shoal
      </div>
      <div className="space-y-1.5">
        <Slider label="Count" value={Math.min(fish.count, maxCount)} min={0} max={maxCount} step={1} suffix="" onChange={(v) => setFish({ count: v })} />
        <Slider label="Size" value={fish.size} min={0.4} max={2.5} step={0.1} suffix="×" onChange={(v) => setFish({ size: v })} />
        <Slider label="Speed" value={fish.speed} min={0.2} max={2.5} step={0.1} suffix="×" onChange={(v) => setFish({ speed: v })} />
      </div>

      {FISH_MODELS.length > 0 && (
        <>
          <div className="mb-1 mt-3 text-[10px] uppercase tracking-wide text-stone">
            Species
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Btn active={!fish.modelId} onClick={() => setFish({ modelId: undefined })}>
              Stylized
            </Btn>
            {FISH_MODELS.map((m) => (
              <Btn key={m.id} active={fish.modelId === m.id} onClick={() => setFish({ modelId: m.id })}>
                {m.label}
              </Btn>
            ))}
          </div>
        </>
      )}

      <div className="mb-1 mt-3 text-[10px] uppercase tracking-wide text-stone">
        Swimming
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {PATTERNS.map((p) => (
          <Btn
            key={p.id}
            active={fish.pattern === p.id}
            onClick={() => setFish({ pattern: p.id })}
            title={p.note}
          >
            {p.label}
          </Btn>
        ))}
      </div>

      <div className="mb-1 mt-3 text-[10px] uppercase tracking-wide text-stone">
        Colors
      </div>
      <div className="space-y-1">
        {PALETTES.map((p) => (
          <button
            key={p.id}
            onClick={() => setFish({ palette: p.id })}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
              fish.palette === p.id
                ? "bg-moss/20 ring-1 ring-moss"
                : "bg-mist/[0.05] hover:bg-mist/[0.1]"
            }`}
          >
            <span className="flex gap-1">
              {p.colors.map((c) => (
                <Swatch key={c} color={c} />
              ))}
            </span>
            <span className="text-xs text-mist">{p.label}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}
