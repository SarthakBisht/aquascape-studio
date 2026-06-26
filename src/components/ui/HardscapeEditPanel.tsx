"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { getMaterial } from "@/data/hardscapeMaterials";
import { HARDSCAPE_SURFACES } from "@/data/hardscapeTextures";
import { ROCK_FORM_IDS, ROCK_FORMS, getRockForm } from "@/data/rockForms";
import { DEFAULT_DRIFT } from "@/lib/driftwood";
import { Panel, Btn } from "./primitives";
import type { HardscapeItem, RockForm, Vec3 } from "@/lib/types";

// Range input that collapses a whole drag into one undo step via the store's
// transaction bracketing (updateHardscape's pushHistory is suppressed while a
// txn is open; endTxn commits a single snapshot).
function EditSlider({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  const beginTxn = useStudioStore((s) => s.beginTxn);
  const endTxn = useStudioStore((s) => s.endTxn);
  return (
    <label className="flex items-center gap-2 text-[10px] text-stone">
      <span className="w-16 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={() => beginTxn()}
        onPointerUp={() => endTxn()}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-moss"
      />
      <span className="w-9 shrink-0 text-right tabular-nums text-mist/80">
        {step < 1 ? value.toFixed(2) : value}
        {suffix}
      </span>
    </label>
  );
}

export function HardscapeEditPanel() {
  const mode = useStudioStore((s) => s.mode);
  const selectedId = useStudioStore((s) => s.selectedId);
  const hardscape = useStudioStore((s) => s.hardscape);
  const update = useStudioStore((s) => s.updateHardscape);

  if (mode !== "design" || !selectedId) return null;
  const item = hardscape.find((h) => h.id === selectedId);
  if (!item) return null;

  const mat = getMaterial(item.materialId);
  const isWood = item.kind === "wood";
  const source = item.source ?? "procedural";

  // Effective values (override → material → form default → kind default).
  const form: RockForm = item.form ?? mat?.form ?? "boulder";
  const def = getRockForm(form);
  const color = item.color ?? mat?.color ?? (isWood ? "#6b4f34" : "#7a7a7a");
  const roughness = item.roughness ?? mat?.roughness ?? 0.9;
  const shape: Vec3 = item.shape ?? mat?.shape ?? def.shape;
  const jaggedness =
    item.jaggedness ?? mat?.jaggedness ?? (isWood ? 0.22 : def.jaggedness);
  const detail = item.detail ?? (isWood ? 1 : def.detail);
  const strata = item.strata ?? mat?.strata ?? def.strata;
  const taper = item.taper ?? def.taper;
  const flat = item.flat ?? def.flat;
  const tilt = item.tilt ?? 0;
  const veinColor = item.veinColor ?? mat?.veinColor;
  const drift = item.drift ?? DEFAULT_DRIFT;

  const set = (patch: Partial<HardscapeItem>) => update(item.id, patch);
  const setShape = (axis: 0 | 1 | 2, v: number) => {
    const next: Vec3 = [...shape];
    next[axis] = v;
    set({ shape: next });
  };
  const setDrift = (patch: Partial<typeof drift>) =>
    set({ drift: { ...drift, ...patch } });

  // Apply a form preset: set the form + its starting params as overrides, so the
  // preset is a launch point the sliders then fine-tune.
  const applyForm = (f: RockForm) => {
    const d = ROCK_FORMS[f];
    set({
      form: f,
      shape: d.shape,
      jaggedness: d.jaggedness,
      detail: d.detail,
      strata: d.strata,
      taper: d.taper,
      flat: d.flat,
    });
  };
  const reroll = () => set({ seed: Math.floor(Math.random() * 1e9) });

  const surfaces = HARDSCAPE_SURFACES.filter((s) => s.kind === item.kind);

  return (
    <Panel title="Customize">
      {/* Color tint */}
      <div className="mb-3 flex items-center gap-2">
        <span className="w-16 shrink-0 text-[10px] text-stone">Color</span>
        <input
          type="color"
          value={color}
          onChange={(e) => set({ color: e.target.value })}
          className="h-6 w-9 cursor-pointer rounded border border-mist/15 bg-transparent"
        />
        {item.color && (
          <button
            onClick={() => set({ color: undefined })}
            title="Reset to material color"
            className="text-[10px] text-stone hover:text-rose-300"
          >
            reset
          </button>
        )}
      </div>

      {/* Surface (triplanar PBR) */}
      <div className="mb-1 text-[10px] uppercase tracking-wide text-stone">
        Surface
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        <Btn
          active={!item.textureId}
          onClick={() => set({ textureId: undefined })}
        >
          None
        </Btn>
        {surfaces.map((s) => (
          <Btn
            key={s.id}
            active={item.textureId === s.id}
            onClick={() => set({ textureId: s.id })}
          >
            {s.label}
          </Btn>
        ))}
      </div>

      {source === "procedural" && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-stone">
              Form
            </span>
            <button
              onClick={reroll}
              title="Roll a new random shape (same form)"
              className="text-[10px] text-moss hover:text-moss-bright"
            >
              ♻ New shape
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {ROCK_FORM_IDS.map((f) => (
              <Btn key={f} active={form === f} onClick={() => applyForm(f)}>
                {ROCK_FORMS[f].label}
              </Btn>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5 border-t border-white/10 pt-2">
        <EditSlider
          label="Roughness"
          value={roughness}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => set({ roughness: v })}
        />

        {source === "procedural" && (
          <>
            <EditSlider label="Width" value={shape[0]} min={0.2} max={3} step={0.05} onChange={(v) => setShape(0, v)} />
            <EditSlider label="Height" value={shape[1]} min={0.2} max={3} step={0.05} onChange={(v) => setShape(1, v)} />
            <EditSlider label="Depth" value={shape[2]} min={0.2} max={3} step={0.05} onChange={(v) => setShape(2, v)} />
            <EditSlider label="Taper" value={taper} min={-1} max={1} step={0.05} onChange={(v) => set({ taper: v })} />
            <EditSlider label="Flatten" value={flat} min={0} max={1} step={0.05} onChange={(v) => set({ flat: v })} />
            <EditSlider label="Tilt" value={tilt} min={0} max={1} step={0.05} onChange={(v) => set({ tilt: v })} />
            <EditSlider label="Jagged" value={jaggedness} min={0.05} max={0.9} step={0.05} onChange={(v) => set({ jaggedness: v })} />
            <EditSlider label="Detail" value={detail} min={0} max={3} step={1} onChange={(v) => set({ detail: v })} />
            <div className="flex items-center gap-2 pt-1">
              <Btn active={strata} onClick={() => set({ strata: !strata })}>
                Layers
              </Btn>
              <label className="ml-auto flex items-center gap-1 text-[10px] text-stone">
                Veins
                <input
                  type="color"
                  value={veinColor ?? "#cccccc"}
                  onChange={(e) => set({ veinColor: e.target.value })}
                  className="h-5 w-7 cursor-pointer rounded border border-mist/15 bg-transparent"
                />
                {veinColor && (
                  <button
                    onClick={() => set({ veinColor: undefined })}
                    className="text-stone hover:text-rose-300"
                  >
                    ✕
                  </button>
                )}
              </label>
            </div>
          </>
        )}

        {source === "drift" && (
          <>
            <EditSlider label="Branches" value={drift.branches} min={2} max={7} step={1} onChange={(v) => setDrift({ branches: v })} />
            <EditSlider label="Length" value={drift.length} min={0.6} max={1.8} step={0.05} onChange={(v) => setDrift({ length: v })} />
            <EditSlider label="Gnarl" value={drift.gnarl} min={0} max={1} step={0.05} onChange={(v) => setDrift({ gnarl: v })} />
            <EditSlider label="Taper" value={drift.taper} min={0.3} max={0.9} step={0.05} onChange={(v) => setDrift({ taper: v })} />
            <EditSlider label="Splits" value={drift.splits} min={0} max={3} step={1} onChange={(v) => setDrift({ splits: v })} />
            <EditSlider label="Thickness" value={drift.thickness} min={0.4} max={1.6} step={0.05} onChange={(v) => setDrift({ thickness: v })} />
          </>
        )}
      </div>

      {source === "mesh" && (
        <p className="mt-2 text-[10px] leading-snug text-stone/70">
          Shape came from your photo / drawing. Tune color & surface above; use
          the bar below to move, scale, duplicate or remove.
        </p>
      )}
    </Panel>
  );
}
