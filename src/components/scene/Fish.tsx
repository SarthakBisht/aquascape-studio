"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStudioStore } from "@/store/useStudioStore";
import type { Quality, SubstrateConfig, TankDimensions } from "@/lib/types";

// Fish built from primitives but proportioned to read as fish (tapered body,
// caudal + dorsal fins, eyes) with a tail swish. Heading-based steering curves
// them smoothly away from the glass — they never stop or stick in corners.
// TODO: swap in rigged .glb fish for true realism.

const FISH_COUNT: Record<Quality, number> = { low: 6, medium: 12, high: 22 };
const FISH_COLORS = ["#e8743b", "#f2c14e", "#5b8def", "#e6e6e6", "#d94f70", "#6ec5b8"];
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(1, 0, 0); // the model faces +x

interface Boid {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  phase: number;
  size: number;
  color: string;
}

function Fish3D({
  color,
  tailRef,
}: {
  color: string;
  tailRef: (el: THREE.Group | null) => void;
}) {
  return (
    <group>
      {/* body */}
      <mesh scale={[2.3, 0.95, 0.62]}>
        <sphereGeometry args={[0.9, 16, 12]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.1} />
      </mesh>
      {/* dorsal fin */}
      <mesh position={[0.1, 0.78, 0]} rotation={[0, 0, -0.2]} scale={[1.1, 1, 0.12]}>
        <coneGeometry args={[0.5, 1.0, 3]} />
        <meshStandardMaterial color={color} roughness={0.6} transparent opacity={0.9} />
      </mesh>
      {/* eyes */}
      {[0.35, -0.35].map((z) => (
        <mesh key={z} position={[1.45, 0.2, z]}>
          <sphereGeometry args={[0.16, 8, 8]} />
          <meshStandardMaterial color="#10130f" roughness={0.3} />
        </mesh>
      ))}
      {/* caudal fin — only this swishes */}
      <group ref={tailRef} position={[-1.9, 0, 0]}>
        <mesh position={[-0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.16]}>
          <coneGeometry args={[1.1, 1.7, 4]} />
          <meshStandardMaterial color={color} roughness={0.6} transparent opacity={0.92} />
        </mesh>
      </group>
    </group>
  );
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
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const tailRefs = useRef<(THREE.Group | null)[]>([]);

  const bounds = useMemo(() => {
    const m = 4;
    const floor = Math.max(substrate.depthFront, substrate.depthBack) + m;
    return {
      min: new THREE.Vector3(-dims.width / 2 + m, floor, -dims.depth / 2 + m),
      max: new THREE.Vector3(dims.width / 2 - m, dims.height * 0.9, dims.depth / 2 - m),
    };
  }, [dims, substrate]);

  const boids = useMemo<Boid[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      pos: new THREE.Vector3(
        THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, Math.random()),
        THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, Math.random()),
        THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, Math.random()),
      ),
      dir: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
      speed: 8 + Math.random() * 7,
      phase: Math.random() * Math.PI * 2,
      size: 0.7 + Math.random() * 0.5,
      color: FISH_COLORS[i % FISH_COLORS.length],
    }));
  }, [count, bounds]);

  const _avoid = useMemo(() => new THREE.Vector3(), []);
  const margin = 7;

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const { min, max } = bounds;
    boids.forEach((b, i) => {
      // gentle wander
      b.dir.applyAxisAngle(UP, (Math.random() - 0.5) * 1.4 * dt);
      b.dir.y += (Math.random() - 0.5) * 0.5 * dt;

      // smooth wall avoidance — curve away before reaching the glass
      _avoid.set(0, 0, 0);
      if (b.pos.x < min.x + margin) _avoid.x += 1;
      if (b.pos.x > max.x - margin) _avoid.x -= 1;
      if (b.pos.y < min.y + margin) _avoid.y += 1;
      if (b.pos.y > max.y - margin) _avoid.y -= 1;
      if (b.pos.z < min.z + margin) _avoid.z += 1;
      if (b.pos.z > max.z - margin) _avoid.z -= 1;
      if (_avoid.lengthSq() > 0) b.dir.addScaledVector(_avoid.normalize(), 3.2 * dt);

      b.dir.y = THREE.MathUtils.clamp(b.dir.y, -0.35, 0.35);
      b.dir.normalize();
      b.pos.addScaledVector(b.dir, b.speed * dt);
      b.pos.clamp(min, max); // safety net; steering should keep them off it

      const g = groupRefs.current[i];
      if (g) {
        g.position.copy(b.pos);
        g.quaternion.setFromUnitVectors(FORWARD, b.dir);
      }
      const tail = tailRefs.current[i];
      if (tail) tail.rotation.y = Math.sin(t * 9 + b.phase) * 0.5;
    });
  });

  return (
    <group>
      {boids.map((b, i) => (
        <group
          key={i}
          ref={(el) => {
            groupRefs.current[i] = el;
          }}
          scale={b.size}
        >
          <Fish3D
            color={b.color}
            tailRef={(el) => {
              tailRefs.current[i] = el;
            }}
          />
        </group>
      ))}
    </group>
  );
}
