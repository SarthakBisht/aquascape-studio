"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStudioStore } from "@/store/useStudioStore";
import type { Quality, SubstrateConfig, TankDimensions } from "@/lib/types";

// Lightweight wandering fish with boundary avoidance — enough to bring the tank
// to life. TODO: upgrade to full GPU/instanced boids (separation, alignment,
// cohesion) plus hardscape avoidance for milestone 6.

const FISH_COUNT: Record<Quality, number> = { low: 6, medium: 12, high: 22 };
const FISH_COLORS = ["#e8743b", "#f2c14e", "#5b8def", "#e6e6e6", "#d94f70"];

interface Boid {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: string;
}

export function Fish({
  dims,
  substrate,
}: {
  dims: TankDimensions;
  substrate: SubstrateConfig;
}) {
  const quality = useStudioStore((s) => s.quality);
  const count = FISH_COUNT[quality];
  const refs = useRef<(THREE.Group | null)[]>([]);

  const bounds = useMemo(() => {
    const m = 3;
    const floor = Math.max(substrate.depthFront, substrate.depthBack) + m;
    return {
      min: new THREE.Vector3(-dims.width / 2 + m, floor, -dims.depth / 2 + m),
      max: new THREE.Vector3(
        dims.width / 2 - m,
        dims.height * 0.92,
        dims.depth / 2 - m,
      ),
    };
  }, [dims, substrate]);

  const boids = useMemo<Boid[]>(() => {
    return Array.from({ length: count }, (_, i) => {
      const pos = new THREE.Vector3(
        THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, Math.random()),
        THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, Math.random()),
        THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, Math.random()),
      );
      const vel = new THREE.Vector3(
        Math.random() - 0.5,
        (Math.random() - 0.5) * 0.3,
        Math.random() - 0.5,
      )
        .normalize()
        .multiplyScalar(12);
      return { pos, vel, color: FISH_COLORS[i % FISH_COLORS.length] };
    });
  }, [count, bounds]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    boids.forEach((b, i) => {
      // random wander
      b.vel.x += (Math.random() - 0.5) * 6 * dt;
      b.vel.y += (Math.random() - 0.5) * 2 * dt;
      b.vel.z += (Math.random() - 0.5) * 6 * dt;

      // steer away from bounds
      (["x", "y", "z"] as const).forEach((ax) => {
        if (b.pos[ax] < bounds.min[ax]) b.vel[ax] += 20 * dt;
        if (b.pos[ax] > bounds.max[ax]) b.vel[ax] -= 20 * dt;
      });

      // clamp speed
      const speed = b.vel.length();
      const max = 18;
      const min = 6;
      if (speed > max) b.vel.multiplyScalar(max / speed);
      if (speed < min) b.vel.multiplyScalar(min / Math.max(speed, 0.001));

      b.pos.addScaledVector(b.vel, dt);
      b.pos.clamp(bounds.min, bounds.max);

      const g = refs.current[i];
      if (g) {
        g.position.copy(b.pos);
        const look = b.pos.clone().add(b.vel);
        g.lookAt(look);
      }
    });
  });

  return (
    <group>
      {boids.map((b, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          {/* body */}
          <mesh scale={[1.6, 0.7, 0.5]}>
            <sphereGeometry args={[1.6, 10, 8]} />
            <meshStandardMaterial color={b.color} roughness={0.5} />
          </mesh>
          {/* tail */}
          <mesh position={[-2.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.9, 1.6, 8]} />
            <meshStandardMaterial color={b.color} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
