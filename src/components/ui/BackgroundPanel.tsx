"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { BACKGROUND_PRESETS, AMBIENCE_PRESETS } from "@/data/backgrounds";
import { Panel, Btn } from "./primitives";
import type { BackgroundStyle } from "@/lib/types";

const STYLES: { id: BackgroundStyle; label: string }[] = [
  { id: "none", label: "None" },
  { id: "solid", label: "Solid" },
  { id: "gradient", label: "Grad" },
  { id: "backlit", label: "Backlit" },
];

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[10px] text-stone">
      {label}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-10 cursor-pointer rounded border border-mist/10 bg-transparent"
      />
    </label>
  );
}

export function BackgroundPanel() {
  const bg = useStudioStore((s) => s.background);
  const setBackground = useStudioStore((s) => s.setBackground);
  const ambience = useStudioStore((s) => s.ambience);
  const setAmbience = useStudioStore((s) => s.setAmbience);

  const activePreset = BACKGROUND_PRESETS.find((p) => {
    if (p.config.style !== bg.style) return false;
    if (p.config.style === "none") return true;
    return p.config.colorTop === bg.colorTop && p.config.colorBottom === bg.colorBottom;
  })?.id;

  return (
    <Panel title="Background">
      {/* ── Scene ambience ──────────────────────────────── */}
      <div className="mb-1.5 text-[10px] uppercase tracking-wide text-stone">
        Scene ambience
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {AMBIENCE_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setAmbience(p.color)}
            title={p.label}
            className={`h-6 w-7 shrink-0 rounded border transition-all ${
              ambience === p.color
                ? "border-moss ring-1 ring-moss/50"
                : "border-mist/20 hover:border-mist/40"
            }`}
            style={{ background: p.color }}
          />
        ))}
        <input
          type="color"
          value={ambience}
          onChange={(e) => setAmbience(e.target.value)}
          title="Custom ambience"
          className="h-6 w-7 cursor-pointer rounded border border-mist/20 bg-transparent"
        />
      </div>

      {/* ── Tank backdrop ───────────────────────────────── */}
      <div className="mb-1.5 text-[10px] uppercase tracking-wide text-stone">
        Tank backdrop
      </div>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {BACKGROUND_PRESETS.map((p) => (
          <Btn
            key={p.id}
            active={activePreset === p.id}
            onClick={() => setBackground(p.config)}
            title={p.note}
          >
            {p.label}
          </Btn>
        ))}
      </div>

      <div className="mb-2 flex gap-1.5">
        {STYLES.map((s) => (
          <Btn
            key={s.id}
            active={bg.style === s.id}
            onClick={() => setBackground({ style: s.id })}
          >
            {s.label}
          </Btn>
        ))}
      </div>

      <div className="space-y-1.5">
        {bg.style === "solid" && (
          <ColorRow
            label="Color"
            value={bg.colorTop}
            onChange={(v) => setBackground({ colorTop: v, colorBottom: v })}
          />
        )}
        {bg.style === "gradient" && (
          <>
            <ColorRow
              label="Top"
              value={bg.colorTop}
              onChange={(v) => setBackground({ colorTop: v })}
            />
            <ColorRow
              label="Bottom"
              value={bg.colorBottom}
              onChange={(v) => setBackground({ colorBottom: v })}
            />
          </>
        )}
        {bg.style === "backlit" && (
          <>
            <ColorRow
              label="Glow"
              value={bg.colorTop}
              onChange={(v) => setBackground({ colorTop: v })}
            />
            <ColorRow
              label="Edge"
              value={bg.colorBottom}
              onChange={(v) => setBackground({ colorBottom: v })}
            />
            {(
              [
                { key: "glow", label: "Light", min: 0, max: 1, step: 0.05, def: 0.7 },
                { key: "glowX", label: "Horiz", min: 0, max: 1, step: 0.01, def: 0.5 },
                { key: "glowY", label: "Vert", min: 0, max: 1, step: 0.01, def: 0.45 },
              ] as const
            ).map(({ key, label, min, max, step, def }) => (
              <label key={key} className="flex items-center gap-2 text-[10px] text-stone">
                <span className="w-10 shrink-0">{label}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={(bg[key] as number | undefined) ?? def}
                  onChange={(e) => setBackground({ [key]: Number(e.target.value) })}
                  className="h-1 flex-1 accent-moss"
                />
              </label>
            ))}
          </>
        )}
      </div>
    </Panel>
  );
}
