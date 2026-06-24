"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { BACKGROUND_PRESETS } from "@/data/backgrounds";
import { Panel, Btn } from "./primitives";
import type { BackgroundStyle } from "@/lib/types";

const STYLES: { id: BackgroundStyle; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "gradient", label: "Gradient" },
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

  const activePreset = BACKGROUND_PRESETS.find(
    (p) =>
      p.config.style === bg.style &&
      p.config.colorTop === bg.colorTop &&
      p.config.colorBottom === bg.colorBottom,
  )?.id;

  return (
    <Panel title="Background">
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

      <div className="mb-2 text-[10px] uppercase tracking-wide text-stone">Style</div>
      <div className="mb-3 flex gap-1.5">
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
            <label className="flex items-center gap-2 text-[10px] text-stone">
              <span className="w-10 shrink-0">Light</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={bg.glow}
                onChange={(e) => setBackground({ glow: Number(e.target.value) })}
                className="h-1 flex-1 accent-moss"
              />
            </label>
          </>
        )}
      </div>

      <p className="mt-2 text-[10px] leading-snug text-stone/70">
        Backlit frosted white is the contest go-to for depth. White suits most
        scapes; black makes colors pop.
      </p>
    </Panel>
  );
}
