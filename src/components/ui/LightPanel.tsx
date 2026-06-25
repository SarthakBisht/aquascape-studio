"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { Panel, Btn } from "./primitives";
import type { FixtureType, LightFixture } from "@/lib/types";

const ADD: { type: FixtureType; label: string }[] = [
  { type: "flood", label: "Flood" },
  { type: "spot", label: "Spot" },
  { type: "rgb", label: "RGB" },
];

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  suffix,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  return (
    <label className="mt-1 flex items-center gap-2 text-[10px] text-stone">
      <span className="w-10 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-moss"
      />
      <span className="w-12 text-right tabular-nums text-mist/80">{suffix}</span>
    </label>
  );
}

function Row({ light }: { light: LightFixture }) {
  const update = useStudioStore((s) => s.updateLight);
  const remove = useStudioStore((s) => s.removeLight);
  const tank = useStudioStore((s) => s.tank);
  const xMax = Math.round(tank.width * 0.6);
  const zMax = Math.round(tank.depth * 0.6);
  return (
    <div className="rounded-md bg-mist/[0.05] p-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex-1 text-xs font-medium capitalize">{light.type}</span>
        <button
          onClick={() => update(light.id, { on: !light.on })}
          className={`rounded px-1.5 py-0.5 text-[10px] ${
            light.on ? "bg-moss text-sumi" : "bg-mist/10 text-stone"
          }`}
        >
          {light.on ? "On" : "Off"}
        </button>
        <button
          onClick={() => remove(light.id)}
          title="Remove fixture"
          className="rounded px-1.5 py-0.5 text-[10px] text-[#cc9988] hover:bg-mist/10"
        >
          ✕
        </button>
      </div>

      <Slider
        label="Power"
        min={0}
        max={3}
        step={0.05}
        value={light.intensity}
        onChange={(v) => update(light.id, { intensity: v })}
        suffix={light.intensity.toFixed(1)}
      />

      {light.type === "rgb" ? (
        <label className="mt-1 flex items-center gap-2 text-[10px] text-stone">
          <span className="w-10 shrink-0">Color</span>
          <input
            type="color"
            value={light.color}
            onChange={(e) => update(light.id, { color: e.target.value })}
            className="h-5 w-full cursor-pointer rounded bg-transparent"
          />
        </label>
      ) : (
        <Slider
          label="Warmth"
          min={3000}
          max={8000}
          step={100}
          value={light.kelvin}
          onChange={(v) => update(light.id, { kelvin: v })}
          suffix={`${Math.round(light.kelvin)}K`}
        />
      )}

      <Slider
        label="X"
        min={-xMax}
        max={xMax}
        step={1}
        value={light.x}
        onChange={(v) => update(light.id, { x: v })}
        suffix={`${light.x}`}
      />
      <Slider
        label="Z"
        min={-zMax}
        max={zMax}
        step={1}
        value={light.z}
        onChange={(v) => update(light.id, { z: v })}
        suffix={`${light.z}`}
      />
    </div>
  );
}

export function LightPanel() {
  const lights = useStudioStore((s) => s.lights);
  const addLight = useStudioStore((s) => s.addLight);
  return (
    <Panel title="Light">
      <div className="mb-2 flex gap-1.5">
        {ADD.map((a) => (
          <Btn key={a.type} onClick={() => addLight(a.type)}>
            + {a.label}
          </Btn>
        ))}
      </div>
      <div className="space-y-2">
        {lights.map((l) => (
          <Row key={l.id} light={l} />
        ))}
        {lights.length === 0 && (
          <p className="text-[10px] leading-snug text-stone/70">
            No fixtures — add one above. A soft ambient fill keeps the scape visible.
          </p>
        )}
      </div>
    </Panel>
  );
}
