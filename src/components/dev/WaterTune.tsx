"use client";

// ⚠️ TEMP — live water-scene tuning panel. Throwaway: delete this file and the
// three `WaterTune` imports (Water.tsx, Caustics.tsx, Studio.tsx) when done.
// Grep "TEMP WaterTune" to find every wire-in.

import { create } from "zustand";

export interface WaterTuneState {
  waterOpacity: number; // water body transparency
  waterTint: number; // body colour lean toward the light rig (0..1)
  shaftMax: number; // god-ray shaft max opacity
  shaftWidth: number; // god-ray shaft width multiplier
  surfaceGlow: number; // surface emissive glare max
  surfaceOpacity: number; // surface plane opacity
  causticsMax: number; // floor caustics max opacity
  haze: number; // depth fog: 0 = off (clear), 1 = murky
  set: (p: Partial<WaterTuneState>) => void;
}

// Defaults == the current shipped values, so nothing changes until you drag.
export const useWaterTune = create<WaterTuneState>((set) => ({
  waterOpacity: 0.065,
  waterTint: 0.16,
  shaftMax: 0.055,
  shaftWidth: 0.65,
  surfaceGlow: 0.09,
  surfaceOpacity: 0.1,
  causticsMax: 0.07,
  haze: 0,
  set: (p) => set(p),
}));

const ROWS: { key: keyof WaterTuneState; label: string; min: number; max: number; step: number }[] = [
  { key: "waterOpacity", label: "Water opacity", min: 0, max: 0.35, step: 0.005 },
  { key: "waterTint", label: "Water tint→light", min: 0, max: 1, step: 0.02 },
  { key: "shaftMax", label: "God-ray strength", min: 0, max: 0.4, step: 0.005 },
  { key: "shaftWidth", label: "God-ray width", min: 0.4, max: 1.8, step: 0.05 },
  { key: "surfaceGlow", label: "Surface glow", min: 0, max: 0.6, step: 0.01 },
  { key: "surfaceOpacity", label: "Surface opacity", min: 0, max: 0.4, step: 0.01 },
  { key: "causticsMax", label: "Caustics", min: 0, max: 0.5, step: 0.01 },
  { key: "haze", label: "Depth haze", min: 0, max: 1, step: 0.02 },
];

export function WaterTunePanel() {
  const s = useWaterTune();

  const dump = () => {
    const { set: _omit, ...vals } = s;
    void _omit;
    const text = JSON.stringify(vals, null, 2);
    console.log("WaterTune values:\n" + text);
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <div className="pointer-events-auto fixed right-3 top-16 z-50 w-60 rounded-lg border border-amber-400/40 bg-black/80 p-3 text-mist backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
          Water tune · temp
        </span>
        <button
          onClick={dump}
          className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] text-amber-200 hover:bg-amber-400/30"
          title="Log + copy current values"
        >
          copy
        </button>
      </div>
      <div className="space-y-1.5">
        {ROWS.map((r) => (
          <label key={r.key} className="flex items-center gap-2 text-[10px] text-stone">
            <span className="w-24 shrink-0">{r.label}</span>
            <input
              type="range"
              min={r.min}
              max={r.max}
              step={r.step}
              value={s[r.key] as number}
              onChange={(e) => s.set({ [r.key]: Number(e.target.value) } as Partial<WaterTuneState>)}
              className="h-1 flex-1 accent-amber-400"
            />
            <span className="w-9 shrink-0 text-right tabular-nums text-mist/80">
              {(s[r.key] as number).toFixed(2)}
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-[9px] leading-tight text-stone">
        Tweak, hit <b>copy</b>, paste me the numbers — I&apos;ll bake them in &amp; remove this.
      </p>
    </div>
  );
}
