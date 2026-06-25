"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useStudioStore } from "@/store/useStudioStore";
import { kelvinToRgb } from "@/lib/lightColor";
import type { FixtureType, LightFixture, TankDimensions, ViewMode } from "@/lib/types";

// Per-type spotlight shape + base intensity. Each fixture is hung above the tank
// and aimed straight down at the substrate below it.
const TYPE_PARAMS: Record<
  FixtureType,
  { angle: number; penumbra: number; base: number }
> = {
  flood: { angle: 0.9, penumbra: 0.7, base: 1.6 }, // broad even wash
  spot: { angle: 0.35, penumbra: 0.2, base: 2.2 }, // hard pool of light
  rgb: { angle: 0.6, penumbra: 0.6, base: 1.4 }, // colored accent
};

function FixtureLight({
  light,
  rimY,
  uw,
}: {
  light: LightFixture;
  rimY: number;
  uw: number;
}) {
  const color = useMemo(
    () =>
      light.type === "rgb" ? new THREE.Color(light.color) : kelvinToRgb(light.kelvin),
    [light.type, light.color, light.kelvin],
  );
  const target = useMemo(() => new THREE.Object3D(), []);
  target.position.set(light.x, 0, light.z);

  const p = TYPE_PARAMS[light.type];
  return (
    <>
      <primitive object={target} />
      <spotLight
        position={[light.x, rimY + light.height, light.z]}
        target={target}
        angle={p.angle}
        penumbra={p.penumbra}
        decay={0}
        intensity={p.base * light.intensity * uw}
        color={color}
      />
    </>
  );
}

// User-built light rig + a small baked fill (ambient + hemisphere) so the scape
// is never fully dark even with every fixture off.
export function Lighting({ mode, dims }: { mode: ViewMode; dims: TankDimensions }) {
  const lights = useStudioStore((s) => s.lights);
  const underwater = mode === "underwater";
  const uw = underwater ? 0.7 : 1;
  return (
    <>
      <ambientLight intensity={underwater ? 0.25 : 0.3} />
      <hemisphereLight
        intensity={underwater ? 0.3 : 0.38}
        color={underwater ? "#cfeffb" : "#ffffff"}
        groundColor={underwater ? "#15303a" : "#cdbfae"}
      />
      {lights
        .filter((l) => l.on)
        .map((l) => (
          <FixtureLight key={l.id} light={l} rimY={dims.height} uw={uw} />
        ))}
    </>
  );
}
