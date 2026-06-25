"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useStudioStore } from "@/store/useStudioStore";
import { kelvinToRgb } from "@/lib/lightColor";
import type { LightFixture } from "@/lib/types";

// Simple visible hardware above the tank so the user can see which lights exist
// and where they point. The dark housing varies by type; the emissive underside
// is tinted to the light's color and brightens with intensity when it's on.
function Fixture({ light, rimY }: { light: LightFixture; rimY: number }) {
  const color = useMemo(
    () =>
      light.type === "rgb" ? new THREE.Color(light.color) : kelvinToRgb(light.kelvin),
    [light.type, light.color, light.kelvin],
  );
  const y = rimY + light.height;
  const glow = light.on ? Math.min(1, light.intensity / 2) : 0;
  const panel: [number, number] = light.type === "flood" ? [20, 6] : [6, 6];
  return (
    <group position={[light.x, y, light.z]}>
      <mesh rotation={light.type === "spot" ? [Math.PI, 0, 0] : [0, 0, 0]}>
        {light.type === "spot" ? (
          <coneGeometry args={[3, 5, 16]} />
        ) : light.type === "rgb" ? (
          <boxGeometry args={[8, 3, 8]} />
        ) : (
          <boxGeometry args={[22, 3, 8]} />
        )}
        <meshStandardMaterial color="#1c1a18" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, -1.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={panel} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2 + 0.7 * glow}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export function LightFixtures() {
  const lights = useStudioStore((s) => s.lights);
  const rimY = useStudioStore((s) => s.tank.height);
  return (
    <group>
      {lights.map((l) => (
        <Fixture key={l.id} light={l} rimY={rimY} />
      ))}
    </group>
  );
}
