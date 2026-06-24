"use client";

import * as THREE from "three";
import type { TankDimensions } from "@/lib/types";

// Only the tank fills with water, kept very subtle (near-transparent) so the
// scape stays crisp. A brighter surface + a faint downward shaft read as glare
// from the overhead light. TODO: real caustics / refraction for the high tier.
export function Water({ dims }: { dims: TankDimensions }) {
  const { width: w, depth: d, height: h } = dims;
  const level = h * 0.96;

  return (
    <group>
      {/* near-transparent water body */}
      <mesh position={[0, level / 2, 0]}>
        <boxGeometry args={[w * 0.97, level, d * 0.97]} />
        <meshPhysicalMaterial
          color="#9ad8e6"
          transparent
          opacity={0.08}
          roughness={0.12}
          metalness={0}
          ior={1.33}
          depthWrite={false}
        />
      </mesh>

      {/* surface — catches the overhead light as a soft glare */}
      <mesh position={[0, level, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.97, d * 0.97]} />
        <meshStandardMaterial
          color="#cdeef5"
          transparent
          opacity={0.16}
          roughness={0.05}
          metalness={0.35}
          emissive="#bfe9f2"
          emissiveIntensity={0.2}
          depthWrite={false}
        />
      </mesh>

      {/* faint volumetric shaft from above (additive; no fixture drawn) */}
      <mesh position={[0, level * 0.5, 0]}>
        <coneGeometry args={[w * 0.22, level, 5, 1, true]} />
        <meshBasicMaterial
          color="#eaf7ff"
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
