"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { getMaterial } from "@/data/hardscapeMaterials";
import { HARDSCAPE_SURFACES } from "@/data/hardscapeTextures";
import { ROCK_FORM_IDS, ROCK_FORMS, getRockForm } from "@/data/rockForms";
import { DEFAULT_DRIFT } from "@/lib/driftwood";
import { loadSurfaceImage } from "@/lib/surfaceImage";
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

// Slider for transient (non-scene) values like the sculpt brush size — no undo
// bracketing, since these don't change the saved scape.
function PlainSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[10px] text-stone">
      <span className="w-16 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-moss"
      />
      <span className="w-9 shrink-0 text-right tabular-nums text-mist/80">
        {value.toFixed(2)}
      </span>
    </label>
  );
}

const SCULPT_BRUSHES = [
  { id: "draw", label: "Push/Pull" },
  { id: "smooth", label: "Smooth" },
  { id: "grab", label: "Grab" },
  { id: "flatten", label: "Flatten" },
  { id: "pinch", label: "Pinch" },
] as const;

export function HardscapeEditPanel() {
  const mode = useStudioStore((s) => s.mode);
  const selectedId = useStudioStore((s) => s.selectedId);
  const hardscape = useStudioStore((s) => s.hardscape);
  const update = useStudioStore((s) => s.updateHardscape);
  const convertToSculpt = useStudioStore((s) => s.convertToSculpt);
  const tool = useStudioStore((s) => s.tool);
  const setTool = useStudioStore((s) => s.setTool);
  const sculptBrush = useStudioStore((s) => s.sculptBrush);
  const setSculptBrush = useStudioStore((s) => s.setSculptBrush);
  const sculptDir = useStudioStore((s) => s.sculptDir);
  const setSculptDir = useStudioStore((s) => s.setSculptDir);
  const sculptRadius = useStudioStore((s) => s.sculptRadius);
  const setSculptRadius = useStudioStore((s) => s.setSculptRadius);
  const sculptStrength = useStudioStore((s) => s.sculptStrength);
  const setSculptStrength = useStudioStore((s) => s.setSculptStrength);
  const setCustomSurface = useStudioStore((s) => s.setCustomSurface);

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
  const pitting = item.pitting ?? def.pitting ?? 0;
  const pitScale = item.pitScale ?? def.pitScale ?? 5;
  const veinColor = item.veinColor ?? mat?.veinColor;
  const drift = item.drift ?? DEFAULT_DRIFT;

  const set = (patch: Partial<HardscapeItem>) => update(item.id, patch);
  const onUploadTexture = async (file: File | null | undefined) => {
    if (!file) return;
    const url = await loadSurfaceImage(file);
    const id =
      "custom:" + (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
    setCustomSurface(id, url);
    set({ textureId: id, textureScaleCm: item.textureScaleCm ?? 20 });
  };
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
      pitting: d.pitting ?? 0,
      pitScale: d.pitScale ?? 5,
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
        {item.textureId?.startsWith("custom:") && (
          <Btn active onClick={() => {}}>
            Photo ✓
          </Btn>
        )}
        <label className="cursor-pointer rounded border border-mist/15 px-2 py-0.5 text-[10px] text-stone hover:text-mist">
          ＋ Upload
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onUploadTexture(e.target.files?.[0])}
          />
        </label>
      </div>
      {item.textureId?.startsWith("custom:") && (
        <div className="mb-3">
          <EditSlider
            label="Tex scale"
            value={item.textureScaleCm ?? 20}
            min={4}
            max={60}
            step={1}
            suffix="cm"
            onChange={(v) => set({ textureScaleCm: v })}
          />
        </div>
      )}

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
          <button
            onClick={() => convertToSculpt(item.id)}
            title="Switch to free 3D sculpting (the sliders give way to a brush)"
            className="mt-2 w-full rounded border border-moss/40 bg-moss/10 py-1 text-[10px] text-moss hover:bg-moss/20"
          >
            ✋ Sculpt this shape (free 3D)
          </button>
        </div>
      )}

      {source === "sculpt" && (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-stone">
              Sculpt
            </span>
            <button
              onClick={() => set({ sculptD: undefined, sculptN: undefined })}
              title="Clear all sculpting (back to the base shape)"
              className="text-[10px] text-moss hover:text-rose-300"
            >
              Reset
            </button>
          </div>
          <button
            onClick={() => setTool(tool === "rocksculpt" ? "select" : "rocksculpt")}
            className={`mb-2 w-full rounded py-1 text-[10px] ${
              tool === "rocksculpt"
                ? "bg-moss text-ink"
                : "border border-moss/40 bg-moss/10 text-moss hover:bg-moss/20"
            }`}
          >
            {tool === "rocksculpt" ? "● Sculpting — click to stop" : "✋ Start sculpting"}
          </button>
          <div className="flex flex-wrap gap-1">
            {SCULPT_BRUSHES.map((b) => (
              <Btn
                key={b.id}
                active={sculptBrush === b.id}
                onClick={() => {
                  setSculptBrush(b.id);
                  setTool("rocksculpt");
                }}
              >
                {b.label}
              </Btn>
            ))}
          </div>
          {sculptBrush === "draw" && (
            <div className="mt-1 flex gap-1">
              <Btn active={sculptDir === 1} onClick={() => setSculptDir(1)}>
                Push out
              </Btn>
              <Btn active={sculptDir === -1} onClick={() => setSculptDir(-1)}>
                Carve in
              </Btn>
            </div>
          )}
          <div className="mt-2 space-y-1.5">
            <PlainSlider
              label="Size"
              value={sculptRadius}
              min={0.05}
              max={1}
              step={0.05}
              onChange={setSculptRadius}
            />
            <PlainSlider
              label="Strength"
              value={sculptStrength}
              min={0.05}
              max={1}
              step={0.05}
              onChange={setSculptStrength}
            />
          </div>
          <p className="mt-1 text-[10px] leading-snug text-stone/70">
            Drag on the rock to reshape it from any angle. Orbit resumes when you stop.
          </p>
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
            <EditSlider label="Pitting" value={pitting} min={0} max={1} step={0.05} onChange={(v) => set({ pitting: v })} />
            {pitting > 0 && (
              <EditSlider label="Pit density" value={pitScale} min={2} max={10} step={0.5} onChange={(v) => set({ pitScale: v })} />
            )}
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
