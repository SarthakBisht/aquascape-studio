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
// foliage reads as real leaves from any orbit angle. Pick a species, click the
// substrate, and the patch fills with scaled, color-varied, gently swaying
// plants. Drop a real cutout PNG per species to upgrade (see plantTextures).

const QUALITY_DENSITY: Record<Quality, number> = { low: 0.4, medium: 0.7, high: 1 };

// Width-to-height ratio of the billboard card per plant form.
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

function Patch({ placement }: { placement: PlantPlacement }) {
  const grownIn = useStudioStore((s) => s.grownIn);
  const quality = useStudioStore((s) => s.quality);
  const mode = useStudioStore((s) => s.mode);
  const tankHeight = useStudioStore((s) => s.tank.height);
  const species = getSpecies(placement.speciesId);

  const texture = usePlantTexture(species?.form ?? "blade", species?.texture);
  const widthRatio = FORM_WIDTH[species?.form ?? "blade"];
  const userScale = placement.scale ?? 1;

  const count = Math.max(
    5,
    Math.round(placement.density * QUALITY_DENSITY[quality]),
  );

  const ref = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const blades = useMemo(() => {
    const rand = mulberry32(hashSeed(placement.id));
    const [minH, maxH] = species?.heightCm ?? [4, 8];
    const targetH = (grownIn ? maxH : minH + (maxH - minH) * 0.25) * userScale;
    // Keep foliage inside the glass — tall stems bend at the surface IRL.
    const cap = tankHeight * 0.96 - placement.position[1];
    return Array.from({ length: count }, () => {
      const ang = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * placement.radius;
      return {
        x: Math.cos(ang) * r,
        z: Math.sin(ang) * r,
        h: Math.min(targetH * (0.7 + rand() * 0.6), cap),
        yaw: rand() * Math.PI * 2,
        lean: (rand() - 0.5) * 0.25,
        tint: 0.82 + rand() * 0.32,
      };
    });
  }, [
    placement.id,
    placement.radius,
    placement.position,
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
      pos.set(b.x, 0, b.z);
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
