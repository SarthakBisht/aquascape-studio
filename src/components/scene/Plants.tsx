"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStudioStore } from "@/store/useStudioStore";
import { getSpecies } from "@/data/plants";
import type { PlantPlacement, Quality } from "@/lib/types";

// Plant patches rendered as scattered instanced "blades". This is the
// paint-to-fill preview: pick a species, click the substrate, and the area
// fills with correctly-scaled, correctly-colored foliage. Real alpha-textured
// billboard foliage is a follow-up — see CLAUDE.md.

const QUALITY_DENSITY: Record<Quality, number> = { low: 0.4, medium: 0.7, high: 1 };

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Patch({ placement }: { placement: PlantPlacement }) {
  const grownIn = useStudioStore((s) => s.grownIn);
  const quality = useStudioStore((s) => s.quality);
  const mode = useStudioStore((s) => s.mode);
  const species = getSpecies(placement.speciesId);

  const count = Math.max(
    6,
    Math.round(placement.density * QUALITY_DENSITY[quality]),
  );

  const ref = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const blades = useMemo(() => {
    const rand = mulberry32(hashSeed(placement.id));
    const [minH, maxH] = species?.heightCm ?? [4, 8];
    const targetH = grownIn ? maxH : minH + (maxH - minH) * 0.25;
    const arr: { x: number; z: number; h: number; rot: number; tilt: number }[] = [];
    for (let i = 0; i < count; i++) {
      const ang = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * placement.radius;
      arr.push({
        x: Math.cos(ang) * r,
        z: Math.sin(ang) * r,
        h: targetH * (0.7 + rand() * 0.6),
        rot: rand() * Math.PI * 2,
        tilt: (rand() - 0.5) * 0.3,
      });
    }
    return arr;
  }, [placement.id, placement.radius, count, species?.heightCm, grownIn]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    blades.forEach((b, i) => {
      e.set(b.tilt, b.rot, b.tilt);
      q.setFromEuler(e);
      pos.set(b.x, b.h * 0.5, b.z); // lift so the blade base sits at y=0
      scl.set(b.h * 0.5, b.h, b.h * 0.5);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
    });
    mesh.count = blades.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [blades]);

  // Gentle whole-patch sway underwater (cheap stand-in for per-blade shader sway).
  useFrame((state) => {
    if (mode !== "underwater" || !groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.z =
      Math.sin(t * 0.8 + placement.position[0] * 0.1) * 0.04;
  });

  return (
    <group ref={groupRef} position={placement.position}>
      <instancedMesh
        key={count}
        ref={ref}
        args={[undefined, undefined, count]}
        castShadow
      >
        <coneGeometry args={[0.35, 1, 5]} />
        <meshStandardMaterial color={species?.color ?? "#4f9a3f"} roughness={0.8} />
      </instancedMesh>
    </group>
  );
}

export function Plants() {
  const plants = useStudioStore((s) => s.plants);
  return (
    <group>
      {plants.map((p) => (
        <Patch key={p.id} placement={p} />
      ))}
    </group>
  );
}
