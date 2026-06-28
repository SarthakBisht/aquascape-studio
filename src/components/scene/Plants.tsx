"use client";

import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useStudioStore } from "@/store/useStudioStore";
import { getSpecies } from "@/data/plants";
import { usePlantTexture } from "@/lib/plantTextures";
import { plantHabit } from "@/lib/plantHabit";
import type { PlantForm, PlantHabit, PlantPlacement, Quality } from "@/lib/types";

// Plants as crossed photographic billboards (two perpendicular alpha cards), so
// foliage reads as real leaves from any orbit angle. Each blade is seated on the
// surface sampled under it at paint time (soil slope / stone / driftwood), so
// nothing floats over a slope. Pick a species, click a surface, and the patch
// fills with scaled, color-varied, gently swaying plants.

const QUALITY_DENSITY: Record<Quality, number> = { low: 0.4, medium: 0.7, high: 1 };

// Billboard textures (bright studio-lit cutouts) wash out under the strong light
// rig. Two knobs keep foliage "fresh vegetable" instead of blown-white or dull:
//   PLANT_ALBEDO  — multiply on the texture (dim = less white blowout). Neutral
//                   grey so reds (alternanthera) deepen too. Lower→darker.
//   PLANT_EMISSIVE— self-glow of the leaf's OWN colour (emissiveMap = texture),
//                   fills shadows with green so it reads lush, not flat. Higher→
//                   fresher/punchier (but too high looks neon).
const PLANT_ALBEDO = "#a6a6a6";
const PLANT_EMISSIVE = 0.14;
// Gentle wet-leaf sheen = "fresh". Lower roughness = glossier; below ~0.7 it
// blows white highlights on lit faces (don't). 0.82 reads fresh, not plastic.
const PLANT_ROUGHNESS = 0.82;

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
  w: number; // width in cm (decoupled from h so lily leaves stay put as the stem climbs)
  yaw: number;
  lean: number;
  tint: number;
}

// Neutral fallback when a species can't be resolved (deleted custom plant).
const DEFAULT_HABIT: PlantHabit = {
  anchor: "substrate",
  heightGain: 0.9,
  fullnessGain: 0.6,
  leafScalesWithHeight: true,
  leafGain: 0.1,
  rateScalar: 0.8,
};

// Memoized so a paint stroke (which replaces only the touched patch) re-renders
// just that patch, not every patch in the tank.
const Patch = memo(function Patch({ placement }: { placement: PlantPlacement }) {
  const growth = useStudioStore((s) => s.growth);
  const quality = useStudioStore((s) => s.quality);
  const mode = useStudioStore((s) => s.mode);
  const tankHeight = useStudioStore((s) => s.tank.height);
  const tankWidth = useStudioStore((s) => s.tank.width);
  const tankDepth = useStudioStore((s) => s.tank.depth);
  const customPlants = useStudioStore((s) => s.customPlants);
  const species =
    getSpecies(placement.speciesId) ??
    customPlants.find((p) => p.id === placement.speciesId);

  const customTex = useStudioStore((s) =>
    species ? s.customPlantTextures[species.id] : undefined,
  );
  const url = customTex ?? species?.texture;
  const texture = usePlantTexture(species?.form ?? "blade", url);
  const hasImage = !!url;
  // A real photo is sized to the image aspect (so it isn't stretched); the
  // procedural silhouette uses the per-form ratio.
  const img = texture.image as { width?: number; height?: number } | undefined;
  const aspect =
    hasImage && img?.width && img?.height ? img.width / img.height : null;
  const widthRatio = aspect ?? FORM_WIDTH[species?.form ?? "blade"];
  const userScale = placement.scale ?? 1;
  const baseWorldY = placement.position[1];
  // Botanical character: how this species grows + where it sits (Part F).
  const habit = useMemo(
    () => (species ? plantHabit(species) : DEFAULT_HABIT),
    [species],
  );

  const count = Math.max(
    5,
    Math.round(placement.density * QUALITY_DENSITY[quality]),
  );

  const ref = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  // GPU clip planes — hard-clip geometry at the tank walls so tall billboards
  // near the glass can't poke through, regardless of where their base sits.
  const clipPlanes = useMemo(
    () => [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), tankWidth / 2),
      new THREE.Plane(new THREE.Vector3(1, 0, 0), tankWidth / 2),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), tankDepth / 2),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), tankDepth / 2),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), tankHeight),
    ],
    [tankWidth, tankDepth, tankHeight],
  );

  const blades = useMemo<RenderBlade[]>(() => {
    const [minH, maxH] = species?.heightCm ?? [4, 8];
    const youngH = minH * 0.55;
    // Per-species growth: heightGain compresses the range (carpets stay low,
    // stems shoot up); rateScalar slows slow-growers; never exceed natural max.
    const g = growth * habit.rateScalar;
    const targetH = Math.min(
      (youngH + (maxH - youngH) * habit.heightGain * g) * userScale,
      maxH * userScale,
    );
    // Fullness: how much the patch fills in as it grows (carpet/moss fill,
    // epiphytes stay sparse).
    const visible = Math.max(
      5,
      Math.round(count * (0.5 + 0.5 * growth * habit.fullnessGain)),
    );
    const waterline = tankHeight * 0.96;
    const surface = habit.anchor === "surface";
    const capAt = (surfaceWorldY: number) =>
      Math.max(2, waterline - surfaceWorldY);
    // Leaf/sprig card SIZE (cm scale; widthRatio applied at compose). Decoupled
    // from height via habit.leafGain: height is driven by heightGain, so a tall
    // stem no longer balloons its leaf, and a low-height/high-leafGain plant
    // grows bushier (bigger leaf) instead of taller. leafGain 0 = leaf frozen.
    // ponytail: single-billboard proxy — a card taller than its leaf reads as a
    // rising stem; swap for stem+pad geometry if you want a true lily.
    const leafYoung = Math.max(youngH, minH) * userScale;
    const leaf = leafYoung * (1 + habit.leafGain * g);
    // A real photo card must keep its image aspect (width tracks height) or it
    // stretches vertically as the plant gains height. The procedural silhouette
    // keeps the decoupled leaf size so stems lengthen without ballooning.
    const widthOf = hasImage ? (h: number) => h : (_h: number) => leaf;

    // Preferred path: blades pre-sampled onto the real surface at paint time.
    if (placement.blades && placement.blades.length) {
      const n = Math.min(visible, placement.blades.length);
      return placement.blades.slice(0, n).map((b) => {
        const h = Math.min(targetH * b.hMul, capAt(surface ? waterline : b.y));
        return {
          x: b.x,
          z: b.z,
          baseY: (surface ? waterline : b.y) - baseWorldY,
          h,
          w: widthOf(h),
          yaw: b.yaw,
          lean: b.lean,
          tint: 0.58 + Math.abs(Math.sin(b.x * 12.9 + b.z * 4.7)) * 0.17,
        };
      });
    }

    // Fallback for legacy patches: flat scatter at the patch plane.
    const rand = mulberry32(hashSeed(placement.id));
    const cap = capAt(surface ? waterline : baseWorldY);
    return Array.from({ length: visible }, () => {
      const ang = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * placement.radius;
      const h = Math.min(targetH * (0.5 + rand() * 1.1), cap);
      return {
        x: Math.cos(ang) * r,
        z: Math.sin(ang) * r,
        baseY: surface ? waterline - baseWorldY : 0,
        h,
        w: widthOf(h),
        yaw: rand() * Math.PI * 2,
        lean: (rand() - 0.5) * 0.55,
        tint: 0.58 + rand() * 0.17,
      };
    });
  }, [
    placement.blades,
    placement.id,
    placement.radius,
    baseWorldY,
    count,
    species?.heightCm,
    habit,
    growth,
    userScale,
    tankHeight,
    hasImage,
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
      scl.set(b.w * widthRatio, b.h, b.w * widthRatio);
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
          color={hasImage ? PLANT_ALBEDO : (species?.color ?? "#4f9a3f")}
          emissiveMap={hasImage ? texture : undefined}
          emissive={hasImage ? "#ffffff" : "#000000"}
          emissiveIntensity={hasImage ? PLANT_EMISSIVE : 0}
          side={THREE.DoubleSide}
          alphaTest={0.5}
          roughness={hasImage ? PLANT_ROUGHNESS : 0.95}
          metalness={0}
          clippingPlanes={clipPlanes}
        />
      </instancedMesh>
    </group>
  );
});

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
