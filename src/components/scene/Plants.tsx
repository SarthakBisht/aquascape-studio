"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useStudioStore } from "@/store/useStudioStore";
import { getSpecies } from "@/data/plants";
import { usePlantTexture } from "@/lib/plantTextures";
import type { PlantForm, PlantPlacement, Quality } from "@/lib/types";

// Plants as crossed photographic billboards (two perpendicular alpha cards), so
// foliage reads as real leaves from any orbit angle. Each blade is seated on the
// surface sampled under it at paint time (soil slope / stone / driftwood), so
// nothing floats over a slope. Pick a species, click a surface, and the patch
// fills with scaled, color-varied, gently swaying plants.

const QUALITY_DENSITY: Record<Quality, number> = { low: 0.4, medium: 0.7, high: 1 };

const FORM_WIDTH: Record<PlantForm, number> = {
  blade: 0.4,
  stem: 0.5,
  rosette: 0.85,
  broadleaf: 0.95,
  moss: 1.2,
  floating: 1.0,
};

// One shared crossed-quad geometry (base at y=0), reused by every patch.
const CROSS_GEO: THREE.BufferGeometry = (() => {
  const a = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const b = a.clone().rotateY(Math.PI / 2);
  return mergeGeometries([a, b]) ?? a;
})();

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
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RenderBlade {
  x: number;
  z: number;
  baseY: number; // local y (relative to patch center) the blade sits on
  h: number;
  yaw: number;
  lean: number;
  tint: number;
}

function Patch({ placement }: { placement: PlantPlacement }) {
  const grownIn = useStudioStore((s) => s.grownIn);
  const quality = useStudioStore((s) => s.quality);
  const mode = useStudioStore((s) => s.mode);
  const tankHeight = useStudioStore((s) => s.tank.height);
  const species = getSpecies(placement.speciesId);

  const texture = usePlantTexture(species?.form ?? "blade", species?.texture);
  const widthRatio = FORM_WIDTH[species?.form ?? "blade"];
  const userScale = placement.scale ?? 1;
  const baseWorldY = placement.position[1];

  const count = Math.max(
    5,
    Math.round(placement.density * QUALITY_DENSITY[quality]),
  );

  const ref = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const blades = useMemo<RenderBlade[]>(() => {
    const [minH, maxH] = species?.heightCm ?? [4, 8];
    const targetH = (grownIn ? maxH : minH + (maxH - minH) * 0.25) * userScale;
    const capAt = (surfaceWorldY: number) =>
      Math.max(2, tankHeight * 0.96 - surfaceWorldY);

    // Preferred path: blades pre-sampled onto the real surface at paint time.
    if (placement.blades && placement.blades.length) {
      const n = Math.min(count, placement.blades.length);
      return placement.blades.slice(0, n).map((b) => ({
        x: b.x,
        z: b.z,
        baseY: b.y - baseWorldY,
        h: Math.min(targetH * b.hMul, capAt(b.y)),
        yaw: b.yaw,
        lean: b.lean,
        tint: 0.82 + Math.abs(Math.sin(b.x * 12.9 + b.z * 4.7)) * 0.3,
      }));
    }

    // Fallback for legacy patches: flat scatter at the patch plane.
    const rand = mulberry32(hashSeed(placement.id));
    const cap = capAt(baseWorldY);
    return Array.from({ length: count }, () => {
      const ang = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * placement.radius;
      return {
        x: Math.cos(ang) * r,
        z: Math.sin(ang) * r,
        baseY: 0,
        h: Math.min(targetH * (0.7 + rand() * 0.6), cap),
        yaw: rand() * Math.PI * 2,
        lean: (rand() - 0.5) * 0.25,
        tint: 0.82 + rand() * 0.32,
      };
    });
  }, [
    placement.blades,
    placement.id,
    placement.radius,
    baseWorldY,
    count,
    species?.heightCm,
    grownIn,
    userScale,
    tankHeight,
  ]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();
    blades.forEach((b, i) => {
      e.set(b.lean, b.yaw, b.lean * 0.5);
      q.setFromEuler(e);
      pos.set(b.x, b.baseY, b.z);
      scl.set(b.h * widthRatio, b.h, b.h * widthRatio);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, col.setScalar(b.tint));
    });
    mesh.count = blades.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [blades, widthRatio]);

  // Gentle whole-patch sway underwater (cheap stand-in for per-blade shader sway).
  useFrame((state) => {
    if (mode !== "underwater" || !groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.z =
      Math.sin(t * 0.8 + placement.position[0] * 0.1) * 0.05;
  });

  return (
    <group ref={groupRef} position={placement.position}>
      <instancedMesh key={count} ref={ref} args={[CROSS_GEO, undefined, count]}>
        <meshStandardMaterial
          map={texture}
          color={species?.color ?? "#4f9a3f"}
          side={THREE.DoubleSide}
          alphaTest={0.5}
          roughness={0.75}
          metalness={0}
        />
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
