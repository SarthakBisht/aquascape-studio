"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStudioStore } from "@/store/useStudioStore";
import { fixtureColor, attenuateForDepth, summarizeRig } from "@/lib/lightRig";
import type { LightFixture, TankDimensions } from "@/lib/types";
import { useWaterTune } from "@/components/dev/WaterTune"; // TEMP WaterTune

// Only the tank fills with water, kept subtle so the scape stays crisp. The
// look is driven by the actual light rig: each fixture casts a god-ray shaft
// from its real position (shaped by type, colored by its color, fading cooler
// with depth), and the water body + surface glare tint toward the combined
// light. Spot = tight bright beam, flood = broad soft wash, rgb = colored shaft.

// Beam half-width as a fraction of tank width, per fixture type.
const TYPE_SPREAD: Record<LightFixture["type"], number> = {
  spot: 0.08,
  flood: 0.2,
  rgb: 0.12,
};

function Shaft({
  light,
  dims,
  level,
  shaftMax, // TEMP WaterTune
  shaftWidth, // TEMP WaterTune
}: {
  light: LightFixture;
  dims: TankDimensions;
  level: number;
  shaftMax: number;
  shaftWidth: number;
}) {
  const geo = useMemo(() => {
    const radius = dims.width * TYPE_SPREAD[light.type] * shaftWidth;
    // Open cone, apex up near the surface, widening down toward the floor.
    const g = new THREE.ConeGeometry(radius, level, 18, 1, true);
    const top = fixtureColor(light);
    const bottom = attenuateForDepth(top, 0.75);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = THREE.MathUtils.clamp((level / 2 - y) / level, 0, 1); // 0 top → 1 floor
      c.copy(top).lerp(bottom, t);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [light.type, light.color, light.kelvin, dims.width, level, shaftWidth]);

  useEffect(() => () => geo.dispose(), [geo]);

  const opacity = Math.min(shaftMax, 0.03 + light.intensity * 0.045);
  return (
    <mesh geometry={geo} position={[light.x, level / 2, light.z]}>
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

// TEMP WaterTune — depth-haze fog driven by the tune slider (0 = off/clear).
function HazeFog({ dims }: { dims: TankDimensions }) {
  const haze = useWaterTune((s) => s.haze);
  const { scene, camera } = useThree();
  const fog = useMemo(() => new THREE.Fog(0x1d5d68, 1, 1000), []);
  const center = useMemo(() => new THREE.Vector3(0, dims.height / 2, 0), [dims.height]);
  useEffect(() => () => {
    if (scene.fog === fog) scene.fog = null;
  }, [scene, fog]);
  useFrame(() => {
    if (haze <= 0) {
      if (scene.fog === fog) scene.fog = null;
      return;
    }
    if (scene.fog !== fog) scene.fog = fog;
    const dist = camera.position.distanceTo(center);
    fog.near = Math.max(1, dist - dims.depth * 0.2);
    fog.far = dist + dims.depth * (3.0 - haze * 2.4); // haze 0→clear, 1→murky
  });
  return null;
}

export function Water({ dims }: { dims: TankDimensions }) {
  const lights = useStudioStore((s) => s.lights);
  const { width: w, depth: d, height: h } = dims;
  const level = h * 0.96;
  const rig = useMemo(() => summarizeRig(lights), [lights]);

  const tune = useWaterTune(); // TEMP WaterTune

  // Water body keeps a cool aquatic base but leans toward the rig color; the
  // surface glare leans harder and brightens with total intensity.
  const waterTint = useMemo(
    () => new THREE.Color("#9ad8e6").lerp(rig.color, tune.waterTint),
    [rig.color, tune.waterTint],
  );
  const surfaceTint = useMemo(
    () => new THREE.Color("#cdeef5").lerp(rig.color, 0.4),
    [rig.color],
  );
  const glow = Math.min(tune.surfaceGlow, 0.06 + rig.intensity * 0.055);

  const surfaceRef = useRef<THREE.Mesh>(null);
  const surfaceMat = useRef<THREE.MeshStandardMaterial>(null);
  // Animate the surface so the top isn't a static sheet: a gentle bob + a soft
  // glare shimmer that breathes with the light.
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (surfaceRef.current)
      surfaceRef.current.position.y = level + Math.sin(t * 0.8) * 0.35;
    if (surfaceMat.current)
      surfaceMat.current.emissiveIntensity = glow * (0.85 + Math.sin(t * 1.3) * 0.2);
  });

  return (
    <group>
      <HazeFog dims={dims} /> {/* TEMP WaterTune */}

      {/* near-transparent water body, tinted by the rig */}
      <mesh position={[0, level / 2, 0]}>
        <boxGeometry args={[w * 0.97, level, d * 0.97]} />
        <meshPhysicalMaterial
          color={waterTint}
          transparent
          opacity={tune.waterOpacity}
          roughness={0.12}
          metalness={0}
          ior={1.33}
          depthWrite={false}
        />
      </mesh>

      {/* surface — catches the combined light as a soft, shimmering glare */}
      <mesh
        ref={surfaceRef}
        position={[0, level, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[w * 0.97, d * 0.97]} />
        <meshStandardMaterial
          ref={surfaceMat}
          color={surfaceTint}
          transparent
          opacity={tune.surfaceOpacity}
          roughness={0.05}
          metalness={0.35}
          emissive={surfaceTint}
          emissiveIntensity={glow}
          depthWrite={false}
        />
      </mesh>

      {/* one god-ray shaft per active fixture, from its real position */}
      {rig.active.map((l) => (
        <Shaft
          key={l.id}
          light={l}
          dims={dims}
          level={level}
          shaftMax={tune.shaftMax}
          shaftWidth={tune.shaftWidth}
        />
      ))}
    </group>
  );
}
