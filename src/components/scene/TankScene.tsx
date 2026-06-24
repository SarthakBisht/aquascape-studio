"use client";

import { OrbitControls } from "@react-three/drei";
import { useStudioStore } from "@/store/useStudioStore";
import { tankCenter } from "@/lib/units";
import { Lighting } from "./Lighting";
import { Backdrop } from "./Backdrop";
import { GlassTank } from "./GlassTank";
import { Substrate } from "./Substrate";
import { GroundCover } from "./GroundCover";
import { Hardscape } from "./Hardscape";
import { Plants } from "./Plants";
import { Water } from "./Water";
import { Caustics } from "./Caustics";
import { Bubbles } from "./Bubbles";
import { Fish } from "./Fish";
import { CompositionGuides } from "./CompositionGuides";

export function TankScene() {
  const tank = useStudioStore((s) => s.tank);
  const substrate = useStudioStore((s) => s.substrate);
  const background = useStudioStore((s) => s.background);
  const mode = useStudioStore((s) => s.mode);
  const showGuides = useStudioStore((s) => s.showGuides);
  const tool = useStudioStore((s) => s.tool);

  const underwater = mode === "underwater";
  const center = tankCenter(tank);

  return (
    <>
      <Backdrop background={background} />

      <Lighting mode={mode} dims={tank} />

      {/* Plant painting raycasts these surfaces directly, so plants always sit
          on the soil, a stone, or driftwood (deselect is handled by the
          Canvas onPointerMissed). */}
      <Substrate dims={tank} substrate={substrate} />
      <GroundCover />
      <Hardscape />
      <Plants />
      {underwater && <Caustics dims={tank} substrate={substrate} />}
      {underwater && <Water dims={tank} />}
      {underwater && <Bubbles dims={tank} substrate={substrate} />}
      {underwater && <Fish dims={tank} substrate={substrate} />}
      <GlassTank dims={tank} />
      {showGuides && mode === "design" && <CompositionGuides dims={tank} />}

      {/* Disable orbit while a brush is active so dragging draws, not rotates. */}
      <OrbitControls
        makeDefault
        enabled={tool === "select"}
        target={center}
        enableDamping
        maxPolarAngle={Math.PI / 2 + 0.2}
        minDistance={tank.width * 0.4}
        maxDistance={tank.width * 4 + 200}
      />
    </>
  );
}
