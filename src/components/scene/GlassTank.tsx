"use client";

import { useMemo } from "react";
import type { TankDimensions } from "@/lib/types";

// Open-top glass tank rendered as five thin tinted panels. Kept as cheap
// transparent panels (not full refractive transmission) so it stays performant;
// upgrading the front pane to physically refractive glass is a "high" quality
// enhancement. TODO: add an optional back-glass color/background image.
const GLASS = 0.4; // pane thickness (cm)

export function GlassTank({ dims }: { dims: TankDimensions }) {
  const { width: w, depth: d, height: h } = dims;

  const { frontBack, sides } = useMemo(
    () => ({
      frontBack: [
        { args: [w + GLASS, h, GLASS] as const, pos: [0, h / 2, -d / 2] as const }, // back
        { args: [w + GLASS, h, GLASS] as const, pos: [0, h / 2, d / 2] as const }, // front
      ],
      sides: [
        { args: [GLASS, h, d] as const, pos: [-w / 2, h / 2, 0] as const }, // left
        { args: [GLASS, h, d] as const, pos: [w / 2, h / 2, 0] as const }, // right
      ],
    }),
    [w, d, h],
  );

  return (
    <group>
      {/* floor pane (top sits at y=0, substrate rests on it) */}
      <mesh position={[0, -GLASS / 2, 0]} receiveShadow>
        <boxGeometry args={[w + GLASS, GLASS, d + GLASS]} />
        <meshPhysicalMaterial
          color="#dff2f5"
          transparent
          opacity={0.25}
          roughness={0.05}
          metalness={0}
        />
      </mesh>
      {frontBack.map((p, i) => (
        <mesh key={i} position={p.pos}>
          <boxGeometry args={p.args} />
          <meshPhysicalMaterial
            color="#cfe9ef"
            transparent
            opacity={0.14}
            roughness={0.02}
            metalness={0}
            ior={1.5}
            side={2 /* THREE.DoubleSide */}
            envMapIntensity={0.8}
          />
        </mesh>
      ))}
      {/* Side panes — higher envMapIntensity for visible glass reflections. */}
      {sides.map((p, i) => (
        <mesh key={i} position={p.pos}>
          <boxGeometry args={p.args} />
          <meshPhysicalMaterial
            color="#d8eef2"
            transparent
            opacity={0.22}
            roughness={0.0}
            metalness={0}
            ior={1.52}
            side={2 /* THREE.DoubleSide */}
            envMapIntensity={2.5}
            reflectivity={1.0}
          />
        </mesh>
      ))}
    </group>
  );
}
