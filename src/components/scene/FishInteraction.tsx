"use client";

import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useStudioStore } from "@/store/useStudioStore";
import {
  addFood,
  food,
  integrateFood,
  pointer,
  MAX_PELLETS,
} from "@/lib/fishInteraction";
import type { SubstrateConfig, TankDimensions } from "@/lib/types";

// Underwater cursor layer for the Feed / Follow fish interactions. An invisible
// box sized to the water volume catches the pointer (its near-face hit point is
// a natural in-tank target from any orbit angle) and writes the shared
// `pointer` / drops `food` pellets — both read imperatively by Fish in useFrame
// (no React re-render). A fixed pool of pellet meshes is toggled visible.

export function FishInteraction({
  dims,
  substrate,
}: {
  dims: TankDimensions;
  substrate: SubstrateConfig;
}) {
  const fishInteract = useStudioStore((s) => s.fishInteract);
  const { width: w, depth: d, height: h } = dims;
  const level = h * 0.96;
  const floorY = Math.max(substrate.depthFront, substrate.depthBack);
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  // Per-pellet flake look: small, randomly tilted, mixed food colours.
  const FLAKE_COLORS = ["#7a4a25", "#5e7a2e", "#9c5a2c", "#6b5230", "#86442a"];
  const flakes = useMemo(
    () =>
      Array.from({ length: MAX_PELLETS }, (_, i) => ({
        rot: [
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI,
        ] as [number, number, number],
        color: FLAKE_COLORS[i % FLAKE_COLORS.length],
        s: 0.8 + Math.random() * 0.5,
      })),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    pointer.x = e.point.x;
    pointer.y = e.point.y;
    pointer.z = e.point.z;
    pointer.active = true;
  };
  const onLeave = () => {
    pointer.active = false;
  };
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (useStudioStore.getState().fishInteract !== "feed") return;
    e.stopPropagation();
    addFood(e.point.x, e.point.y, e.point.z);
  };

  useFrame((_, delta) => {
    integrateFood(Math.min(delta, 0.05), floorY);
    for (let i = 0; i < MAX_PELLETS; i++) {
      const m = refs.current[i];
      if (!m) continue;
      const p = food[i];
      if (p) {
        m.visible = true;
        m.position.set(p.x, p.y, p.z);
      } else {
        m.visible = false;
      }
    }
  });

  return (
    <group>
      {/* pointer catcher — only while a fish interaction is armed */}
      {fishInteract !== "none" && (
        <mesh
          position={[0, level / 2, 0]}
          onPointerMove={onMove}
          onPointerOut={onLeave}
          onPointerDown={onDown}
        >
          <boxGeometry args={[w * 0.97, level, d * 0.97]} />
          {/* opacity-0 (not invisible) so the raycaster still hits it */}
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* food pellet pool — small tilted flakes (sinks on after toggling off) */}
      {flakes.map((f, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          rotation={f.rot}
          scale={f.s}
          visible={false}
        >
          <boxGeometry args={[0.42, 0.09, 0.32]} />
          <meshStandardMaterial color={f.color} roughness={0.9} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}
