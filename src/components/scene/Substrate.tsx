"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useStudioStore } from "@/store/useStudioStore";
import { paintIfActive } from "@/lib/surfaceInteraction";
import type { SubstrateConfig, TankDimensions } from "@/lib/types";

const SUBSTRATE_LOOK: Record<
  SubstrateConfig["type"],
  { color: string; roughness: number }
> = {
  aquasoil: { color: "#2b2420", roughness: 1.0 }, // dark nutrient soil
  sand: { color: "#d8c79f", roughness: 0.95 },
  gravel: { color: "#8c8478", roughness: 1.0 },
};

// A solid slab whose top face slopes up toward the back (the classic
// front-to-back slope that fakes depth). Bottom sits flush on the glass floor.
export function Substrate({
  dims,
  substrate,
}: {
  dims: TankDimensions;
  substrate: SubstrateConfig;
}) {
  const { width: w, depth: d } = dims;
  const innerW = w * 0.98;
  const innerD = d * 0.98;

  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(innerW, 1, innerD, 1, 1, 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0) {
        // top face — height interpolates front (+z) → back (-z)
        const z = pos.getZ(i);
        const backness = THREE.MathUtils.clamp(-z / innerD + 0.5, 0, 1);
        const depth = THREE.MathUtils.lerp(
          substrate.depthFront,
          substrate.depthBack,
          backness,
        );
        pos.setY(i, depth);
      } else {
        pos.setY(i, 0); // bottom flush on floor
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, [innerW, innerD, substrate.depthFront, substrate.depthBack]);

  const look = SUBSTRATE_LOOK[substrate.type];

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (paintIfActive(e)) return;
    // a plain click on the bed clears the current selection
    e.stopPropagation();
    useStudioStore.getState().selectItem(null);
  };

  return (
    <mesh
      geometry={geometry}
      receiveShadow
      onClick={onClick}
      userData={{ paintable: true }}
    >
      <meshStandardMaterial
        color={look.color}
        roughness={look.roughness}
        metalness={0}
      />
    </mesh>
  );
}
