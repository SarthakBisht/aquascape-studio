"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStudioStore } from "@/store/useStudioStore";
import type { Quality, SubstrateConfig, TankDimensions } from "@/lib/types";

// A few bubbles drifting up — small, near-transparent, with a gentle wobble.
const COUNT: Record<Quality, number> = { low: 8, medium: 16, high: 26 };

export function Bubbles({
  dims,
  substrate,
}: {
  dims: TankDimensions;
  substrate: SubstrateConfig;
}) {
  const quality = useStudioStore((s) => s.quality);
  const count = COUNT[quality];
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const floor = Math.max(substrate.depthFront, substrate.depthBack);
  const top = dims.height * 0.95;

  const data = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * dims.width * 0.9,
        z: (Math.random() - 0.5) * dims.depth * 0.9,
        y: floor + Math.random() * (top - floor),
        speed: 4 + Math.random() * 6,
        r: 0.14 + Math.random() * 0.34,
        phase: Math.random() * Math.PI * 2,
      })),
    [count, dims, floor, top],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    data.forEach((b, i) => {
      b.y += b.speed * dt;
      if (b.y > top) {
        b.y = floor + 1;
        b.x = (Math.random() - 0.5) * dims.width * 0.9;
        b.z = (Math.random() - 0.5) * dims.depth * 0.9;
      }
      const m = refs.current[i];
      if (m) m.position.set(b.x + Math.sin(t * 2 + b.phase) * 0.6, b.y, b.z);
    });
  });

  return (
    <group>
      {data.map((b, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <sphereGeometry args={[b.r, 8, 8]} />
          <meshStandardMaterial
            color="#dffafe"
            transparent
            opacity={0.26}
            roughness={0.1}
            metalness={0.1}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
