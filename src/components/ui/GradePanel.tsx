"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { Panel, Btn } from "./primitives";
import type { ColorGrade } from "@/lib/types";

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
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
      <span className="w-9 shrink-0 text-right tabular-nums text-mist/80">{display}</span>
    </label>
  );
}

export function GradePanel() {
  const grade = useStudioStore((s) => s.grade);
  const setGrade = useStudioStore((s) => s.setGrade);
  const resetGrade = useStudioStore((s) => s.resetGrade);

  const neutral =
    grade.brightness === 0 && grade.contrast === 0 && grade.saturation === 0 && grade.hue === 0;

  const pct = (k: keyof ColorGrade) => `${Math.round(grade[k] * 100)}`;

  return (
    <Panel title="Color grade">
      <div className="space-y-1.5">
        <Slider label="Brightness" value={grade.brightness} min={-0.2} max={0.2} step={0.01} display={pct("brightness")} onChange={(v) => setGrade({ brightness: v })} />
        <Slider label="Contrast" value={grade.contrast} min={-0.3} max={0.3} step={0.01} display={pct("contrast")} onChange={(v) => setGrade({ contrast: v })} />
        <Slider label="Saturation" value={grade.saturation} min={-0.4} max={0.4} step={0.01} display={pct("saturation")} onChange={(v) => setGrade({ saturation: v })} />
        <Slider label="Tint" value={grade.hue} min={0} max={360} step={2} display={`${Math.round(grade.hue)}°`} onChange={(v) => setGrade({ hue: v })} />
      </div>
      <div className="mt-2.5 flex justify-end">
        <Btn onClick={resetGrade} disabled={neutral} title="Back to a neutral look">
          Reset
        </Btn>
      </div>
    </Panel>
  );
}
