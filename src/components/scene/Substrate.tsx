"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useStudioStore } from "@/store/useStudioStore";
import { beginStroke, moveStroke } from "@/lib/surfaceInteraction";
import { fieldGrid, sampleField } from "@/lib/terrain";
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
  const field = substrate.field;

  const geometry = useMemo(() => {
    // Subdivide the top so a sculpted height field renders as real terrain;
    // the side/bottom skirt keeps it a closed, orbitable slab.
    const { nx, nz } = fieldGrid(w, d);
    const geo = new THREE.BoxGeometry(innerW, 1, innerD, nx - 1, 1, nz - 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0) {
        // top half (top face + the upper edge of the side walls)
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const u = THREE.MathUtils.clamp(x / innerW + 0.5, 0, 1);
        const v = THREE.MathUtils.clamp(0.5 - z / innerD, 0, 1); // 0 front → 1 back
        const depth = field
          ? sampleField(field, u, v)
          : THREE.MathUtils.lerp(substrate.depthFront, substrate.depthBack, v);
        pos.setY(i, depth);
      } else {
        pos.setY(i, 0); // bottom flush on floor
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, [w, d, innerW, innerD, substrate.depthFront, substrate.depthBack, field]);

  // GPU geometry is rebuilt each sculpt — release the previous one.
  useEffect(() => () => geometry.dispose(), [geometry]);

  const look = SUBSTRATE_LOOK[substrate.type];

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    // a plain click on the bed clears the current selection (paint is handled
    // by the stroke engine on pointer down/move)
    if (useStudioStore.getState().tool !== "select") return;
    e.stopPropagation();
    useStudioStore.getState().selectItem(null);
  };

  return (
    <mesh
      geometry={geometry}
      receiveShadow
      userData={{ paintable: true }}
      onPointerDown={beginStroke}
      onPointerMove={moveStroke}
      onClick={onClick}
    >
      <meshStandardMaterial
        color={look.color}
        roughness={look.roughness}
        metalness={0}
      />
    </mesh>
  );
}
