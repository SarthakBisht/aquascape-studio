"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { Panel, Btn } from "./primitives";
import { SUBSTRATES } from "@/data/substrates";
import type { SubstrateType } from "@/lib/types";

const GROUPS: { type: SubstrateType; label: string }[] = [
  { type: "aquasoil", label: "Aqua soil" },
  { type: "sand", label: "Sand" },
  { type: "gravel", label: "Gravel" },
];

export function DrawPanel() {
  const activeGround = useStudioStore((s) => s.activeGround);
  const setActiveGround = useStudioStore((s) => s.setActiveGround);
  const tool = useStudioStore((s) => s.tool);
  const setTool = useStudioStore((s) => s.setTool);
  const brush = useStudioStore((s) => s.brush);
  const setBrush = useStudioStore((s) => s.setBrush);
  const sculptDir = useStudioStore((s) => s.sculptDir);
  const setSculptDir = useStudioStore((s) => s.setSculptDir);
  const substrate = useStudioStore((s) => s.substrate);
  const setSubstrate = useStudioStore((s) => s.setSubstrate);

  const startSculpt = (dir: 1 | -1) => {
    setActiveGround(null);
    setSculptDir(dir);
    setTool("sculpt");
  };

  return (
    <Panel title="Draw">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-stone">
        Sculpt slope
      </div>
      <div className="flex gap-1.5">
        <Btn
          active={tool === "sculpt" && sculptDir === 1}
          onClick={() => startSculpt(1)}
          title="Pile soil into hills / raise the slope"
        >
          ⛰ Raise
        </Btn>
        <Btn
          active={tool === "sculpt" && sculptDir === -1}
          onClick={() => startSculpt(-1)}
          title="Carve valleys / lower the slope"
        >
          ⛏ Carve
        </Btn>
        <Btn
          onClick={() =>
            setSubstrate({
              depthFront: substrate.depthFront,
              depthBack: substrate.depthBack,
            })
          }
          title="Flatten back to a clean front→back ramp"
        >
          Reset
        </Btn>
      </div>
      <p className="mb-3 mt-1.5 text-[10px] leading-snug text-stone/70">
        Drag on the bed to pile or carve. Soil holds its angle of repose, so
        steep piles slump like the real thing.
      </p>

      <div className="mb-1 text-[10px] uppercase tracking-wide text-stone">
        Substrate brush
      </div>
      {GROUPS.map((g) => (
        <div key={g.type} className="mb-2">
          <div className="mb-1 text-[9px] text-stone/70">{g.label}</div>
          <div className="grid grid-cols-3 gap-1.5">
            {SUBSTRATES.filter((s) => s.type === g.type).map((s) => {
              const active = activeGround === s.id;
              return (
                <button
                  key={s.id}
                  title={s.label}
                  onClick={() => setActiveGround(active ? null : s.id)}
                  className={`flex flex-col items-center gap-1 rounded-md border p-1 text-[8px] leading-tight transition ${
                    active
                      ? "border-aqua bg-aqua/10 text-mist"
                      : "border-mist/10 bg-mist/[0.04] text-stone hover:border-mist/25"
                  }`}
                >
                  <span
                    className="h-4 w-full rounded-sm"
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

      <label className="mt-2.5 flex items-center gap-2 text-[10px] text-stone">
        <span className="w-8 shrink-0">Size</span>
        <input
          type="range"
          min={2}
          max={20}
          step={1}
          value={brush.radius}
          onChange={(e) => setBrush({ radius: Number(e.target.value) })}
          className="h-1 flex-1 accent-moss"
        />
        <span className="w-9 text-right tabular-nums text-mist/80">
          {brush.radius}cm
        </span>
      </label>

      {/* Only the tools this panel owns light up the "Drawing" banner — not
          rocksculpt / trim / plant / place, which have their own controls. */}
      {tool === "sculpt" || tool === "ground" ? (
        <button
          onClick={() => setTool("select")}
          className="mt-2.5 w-full rounded-md bg-moss/20 px-2 py-1.5 text-[11px] text-moss ring-1 ring-moss/40 transition-colors hover:bg-moss/30"
        >
          ✦ Drawing — click to stop &amp; orbit
        </button>
      ) : (
        <p className="mt-2.5 text-[10px] leading-snug text-stone/70">
          Pick a material (or a plant), then drag on the tank to draw. Patches
          sit level on the surface; orbit returns when you stop.
        </p>
      )}
    </Panel>
  );
}
