"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useStudioStore } from "@/store/useStudioStore";
import { beginStroke, onSurfaceMove, clearHover } from "@/lib/surfaceInteraction";
import { useSubstrateTextures } from "@/lib/substrateTextureGen";
import { sampleField } from "@/lib/terrain";
import type { GroundPatch, SubstrateConfig, TankDimensions } from "@/lib/types";

const RINGS = 5;
const SEG = 24;
const LIFT = 0.14; // sit just above the soil to avoid z-fighting

// A disc that DRAPES over the substrate height field (so painted sand follows
// hills/slopes instead of sitting as a flat sheet). Vertices sample the terrain
// at their world xz; mesh sits at the patch centre, world y baked per-vertex.
function buildPatchGeometry(
  cx: number,
  cz: number,
  radius: number,
  dims: TankDimensions,
  substrate: SubstrateConfig,
): THREE.BufferGeometry {
  const innerW = dims.width * 0.98;
  const innerD = dims.depth * 0.98;
  const field = substrate.field;
  const yAt = (wx: number, wz: number) => {
    const u = THREE.MathUtils.clamp(wx / innerW + 0.5, 0, 1);
    const v = THREE.MathUtils.clamp(0.5 - wz / innerD, 0, 1);
    return (
      (field
        ? sampleField(field, u, v)
        : THREE.MathUtils.lerp(substrate.depthFront, substrate.depthBack, v)) +
      LIFT
    );
  };

  const pos: number[] = [0, yAt(cx, cz), 0];
  const uv: number[] = [0.5, 0.5];
  for (let ring = 1; ring <= RINGS; ring++) {
    const rr = (radius * ring) / RINGS;
    for (let s = 0; s < SEG; s++) {
      const ang = (s / SEG) * Math.PI * 2;
      const lx = Math.cos(ang) * rr;
      const lz = Math.sin(ang) * rr;
      pos.push(lx, yAt(cx + lx, cz + lz), lz);
      uv.push(lx / (2 * radius) + 0.5, lz / (2 * radius) + 0.5);
    }
  }

  // Wound so the disc faces UP (+y normals) — view-from-above must not cull it.
  const idx: number[] = [];
  const ringStart = (r: number) => 1 + (r - 1) * SEG; // r>=1
  for (let s = 0; s < SEG; s++) {
    // centre fan → ring 1
    idx.push(0, ringStart(1) + ((s + 1) % SEG), ringStart(1) + s);
  }
  for (let ring = 1; ring < RINGS; ring++) {
    const a0 = ringStart(ring);
    const b0 = ringStart(ring + 1);
    for (let s = 0; s < SEG; s++) {
      const s1 = (s + 1) % SEG;
      idx.push(a0 + s, b0 + s1, b0 + s);
      idx.push(a0 + s, a0 + s1, b0 + s1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function GroundPatchMesh({
  p,
  dims,
  substrate,
}: {
  p: GroundPatch;
  dims: TankDimensions;
  substrate: SubstrateConfig;
}) {
  const tex = useSubstrateTextures(p, p.radius * 2, p.radius * 2);
  const geometry = useMemo(
    () => buildPatchGeometry(p.position[0], p.position[2], p.radius, dims, substrate),
    [p.position, p.radius, dims, substrate],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={[p.position[0], 0, p.position[2]]}
      userData={{ paintable: true }}
      onPointerDown={beginStroke}
      onPointerMove={onSurfaceMove}
      onPointerOut={clearHover}
    >
      <meshStandardMaterial
        map={tex.albedo}
        normalMap={tex.normal}
        roughnessMap={tex.roughness}
        roughness={1}
        metalness={0}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </mesh>
  );
}

export function GroundCover() {
  const ground = useStudioStore((s) => s.ground);
  const dims = useStudioStore((s) => s.tank);
  const substrate = useStudioStore((s) => s.substrate);
  return (
    <group>
      {ground.map((p) => (
        <GroundPatchMesh key={p.id} p={p} dims={dims} substrate={substrate} />
      ))}
    </group>
  );
}
