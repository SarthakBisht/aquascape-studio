"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { Panel, Btn, Swatch } from "./primitives";
import type { SubstrateType } from "@/lib/types";

const MATERIALS: { id: SubstrateType; label: string; color: string }[] = [
  { id: "sand", label: "Sand", color: "#d8c79f" },
  { id: "gravel", label: "Gravel", color: "#8c8478" },
  { id: "aquasoil", label: "Soil", color: "#2b2420" },
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
      <div className="flex gap-1.5">
        {MATERIALS.map((m) => (
          <Btn
            key={m.id}
            active={activeGround === m.id}
            onClick={() => setActiveGround(activeGround === m.id ? null : m.id)}
          >
            <span className="inline-flex items-center gap-1.5">
              <Swatch color={m.color} />
              {m.label}
            </span>
          </Btn>
        ))}
      </div>

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

      {tool !== "select" ? (
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
