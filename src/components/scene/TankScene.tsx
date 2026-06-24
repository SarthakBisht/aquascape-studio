"use client";

import { OrbitControls } from "@react-three/drei";
import { useStudioStore } from "@/store/useStudioStore";
import { tankCenter } from "@/lib/units";
import { Lighting } from "./Lighting";
import { Backdrop } from "./Backdrop";
import { GlassTank } from "./GlassTank";
import { Substrate } from "./Substrate";
import { Hardscape } from "./Hardscape";
import { Plants } from "./Plants";
import { Water } from "./Water";
import { Fish } from "./Fish";
import { CompositionGuides } from "./CompositionGuides";

export function TankScene() {
  const tank = useStudioStore((s) => s.tank);
  const substrate = useStudioStore((s) => s.substrate);
  const background = useStudioStore((s) => s.background);
  const mode = useStudioStore((s) => s.mode);
  const showGuides = useStudioStore((s) => s.showGuides);

  const underwater = mode === "underwater";
  const center = tankCenter(tank);

  return (
    <>
      {underwater && (
        <fog
          attach="fog"
          args={["#0f4a5e", tank.depth * 0.8, tank.depth * 4 + 80]}
        />
      )}
      <Backdrop background={background} underwater={underwater} />

      <Lighting mode={mode} />

      {/* Plant painting raycasts these surfaces directly, so plants always sit
          on the soil, a stone, or driftwood (deselect is handled by the
          Canvas onPointerMissed). */}
      <Substrate dims={tank} substrate={substrate} />
      <Hardscape />
      <Plants />
      {underwater && <Water dims={tank} />}
      {underwater && <Fish dims={tank} substrate={substrate} />}
      <GlassTank dims={tank} />
      {showGuides && mode === "design" && <CompositionGuides dims={tank} />}

      <OrbitControls
        makeDefault
        target={center}
        enableDamping
        maxPolarAngle={Math.PI / 2 + 0.2}
        minDistance={tank.width * 0.4}
        maxDistance={tank.width * 4 + 200}
      />
    </>
  );
}
