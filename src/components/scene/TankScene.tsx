"use client";

import { OrbitControls } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useStudioStore } from "@/store/useStudioStore";
import { tankCenter } from "@/lib/units";
import { Lighting } from "./Lighting";
import { GlassTank } from "./GlassTank";
import { Substrate } from "./Substrate";
import { Hardscape } from "./Hardscape";
import { Plants } from "./Plants";
import { Water } from "./Water";
import { Fish } from "./Fish";
import { CompositionGuides } from "./CompositionGuides";
import type { Vec3 } from "@/lib/types";

export function TankScene() {
  const tank = useStudioStore((s) => s.tank);
  const substrate = useStudioStore((s) => s.substrate);
  const mode = useStudioStore((s) => s.mode);
  const showGuides = useStudioStore((s) => s.showGuides);
  const tool = useStudioStore((s) => s.tool);
  const activePlantId = useStudioStore((s) => s.activePlantId);
  const addPlantPatch = useStudioStore((s) => s.addPlantPatch);
  const selectItem = useStudioStore((s) => s.selectItem);

  const underwater = mode === "underwater";
  const center = tankCenter(tank);
  const catchY = (substrate.depthFront + substrate.depthBack) / 2;

  const handleGround = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (mode !== "design") return;
    if (tool === "paint" && activePlantId) {
      const p: Vec3 = [e.point.x, e.point.y, e.point.z];
      addPlantPatch(activePlantId, p);
    } else {
      selectItem(null);
    }
  };

  return (
    <>
      {underwater && (
        <fog
          attach="fog"
          args={["#0f4a5e", tank.depth * 0.8, tank.depth * 4 + 80]}
        />
      )}
      <color attach="background" args={[underwater ? "#0a3445" : "#0c1116"]} />

      <Lighting mode={mode} />

      <Substrate dims={tank} substrate={substrate} />
      <Hardscape />
      <Plants />
      {underwater && <Water dims={tank} />}
      {underwater && <Fish dims={tank} substrate={substrate} />}
      <GlassTank dims={tank} />
      {showGuides && mode === "design" && <CompositionGuides dims={tank} />}

      {/* invisible click-catcher for deselect / plant painting */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, catchY, 0]}
        onClick={handleGround}
      >
        <planeGeometry args={[tank.width, tank.depth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

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
