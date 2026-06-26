"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { TANK_PRESETS, TANK_LIMITS } from "@/data/tankPresets";
import { STYLE_PRESETS, getStyle } from "@/data/stylePresets";
import { Panel, Btn } from "./primitives";
import { SUBSTRATES, resolveSubstrate } from "@/data/substrates";
import type { SubstrateType, TankDimensions } from "@/lib/types";

const SUBSTRATE_GROUPS: { type: SubstrateType; label: string }[] = [
  { type: "aquasoil", label: "Aqua soil" },
  { type: "sand", label: "Sand" },
  { type: "gravel", label: "Gravel" },
];

function clamp(v: number, [min, max]: readonly [number, number]) {
  return Math.min(max, Math.max(min, v || min));
}

function DimInput({
  label,
  axis,
}: {
  label: string;
  axis: keyof TankDimensions;
}) {
  const tank = useStudioStore((s) => s.tank);
  const setTank = useStudioStore((s) => s.setTank);
  return (
    <label className="flex flex-1 flex-col gap-1 text-[10px] text-stone">
      {label}
      <input
        type="number"
        value={tank[axis]}
        onChange={(e) =>
          setTank({
            ...tank,
            [axis]: clamp(Number(e.target.value), TANK_LIMITS[axis]),
          })
        }
        className="w-full rounded-md border border-mist/10 bg-mist/[0.06] px-1.5 py-1 text-xs text-mist"
      />
    </label>
  );
}

export function TankPanel() {
  const setTank = useStudioStore((s) => s.setTank);
  const substrate = useStudioStore((s) => s.substrate);
  const setSubstrate = useStudioStore((s) => s.setSubstrate);
  const style = useStudioStore((s) => s.style);
  const setStyle = useStudioStore((s) => s.setStyle);
  const activeStyle = style ? getStyle(style) : undefined;

  return (
    <Panel title="Tank">
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {TANK_PRESETS.map((p) => (
          <Btn key={p.id} onClick={() => setTank(p.dims)} title={p.note}>
            {p.label}
          </Btn>
        ))}
      </div>

      <div className="mb-3 flex gap-1.5">
        <DimInput label="W (cm)" axis="width" />
        <DimInput label="D (cm)" axis="depth" />
        <DimInput label="H (cm)" axis="height" />
      </div>

      <div className="mb-2 text-[10px] uppercase tracking-wide text-stone">
        Substrate
      </div>
      {SUBSTRATE_GROUPS.map((g) => (
        <div key={g.type} className="mb-2">
          <div className="mb-1 text-[9px] text-stone/70">{g.label}</div>
          <div className="grid grid-cols-3 gap-1.5">
            {SUBSTRATES.filter((s) => s.type === g.type).map((s) => {
              const active = resolveSubstrate(substrate).id === s.id;
              return (
                <button
                  key={s.id}
                  title={s.label}
                  onClick={() => setSubstrate({ variant: s.id, type: s.type })}
                  className={`flex flex-col items-center gap-1 rounded-md border p-1 text-[8px] leading-tight transition ${
                    active
                      ? "border-aqua bg-aqua/10 text-mist"
                      : "border-mist/10 bg-mist/[0.04] text-stone hover:border-mist/25"
                  }`}
                >
                  <span
                    className="h-5 w-full rounded-sm"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, ${s.accent}, ${s.color})`,
                    }}
                  />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="mb-3 flex gap-1.5">
        <label className="flex flex-1 flex-col gap-1 text-[10px] text-stone">
          Front (cm)
          <input
            type="number"
            value={substrate.depthFront}
            onChange={(e) =>
              setSubstrate({ depthFront: clamp(Number(e.target.value), [0, 30]) })
            }
            className="rounded-md border border-mist/10 bg-mist/[0.06] px-1.5 py-1 text-xs"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[10px] text-stone">
          Back (cm)
          <input
            type="number"
            value={substrate.depthBack}
            onChange={(e) =>
              setSubstrate({ depthBack: clamp(Number(e.target.value), [0, 30]) })
            }
            className="rounded-md border border-mist/10 bg-mist/[0.06] px-1.5 py-1 text-xs"
          />
        </label>
      </div>

      <div className="mb-2 text-[10px] uppercase tracking-wide text-stone">
        Style
      </div>
      <div className="flex gap-1.5">
        {STYLE_PRESETS.map((s) => (
          <Btn
            key={s.id}
            active={style === s.id}
            onClick={() => setStyle(style === s.id ? null : s.id)}
            title={s.blurb}
          >
            {s.label}
          </Btn>
        ))}
      </div>
      {activeStyle && (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[10px] leading-snug text-stone">
          {activeStyle.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
