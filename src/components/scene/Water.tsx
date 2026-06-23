"use client";

import type { TankDimensions } from "@/lib/types";

// Underwater volume: a translucent tinted box that fills the tank plus a faint
// surface plane. This is the cheap stand-in — caustics, god rays, refraction
// and a proper animated surface are the headline "underwater realism" follow-up
// (see CLAUDE.md milestone 5).
export function Water({ dims }: { dims: TankDimensions }) {
  const { width: w, depth: d, height: h } = dims;
  const level = h * 0.96;

  return (
    <group>
      {/* water body */}
      <mesh position={[0, level / 2, 0]}>
        <boxGeometry args={[w * 0.97, level, d * 0.97]} />
        <meshPhysicalMaterial
          color="#1b6f8c"
          transparent
          opacity={0.28}
          roughness={0.15}
          metalness={0}
          ior={1.33}
          depthWrite={false}
        />
      </mesh>
      {/* surface */}
      <mesh position={[0, level, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.97, d * 0.97]} />
        <meshStandardMaterial
          color="#7fd2e8"
          transparent
          opacity={0.35}
          roughness={0.1}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}
