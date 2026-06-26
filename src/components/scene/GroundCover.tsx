"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { beginStroke, onSurfaceMove, clearHover } from "@/lib/surfaceInteraction";
import type { SubstrateType } from "@/lib/types";

// Drawn substrate-material patches (e.g. a sand path) — flat, level discs laid
// just above the soil at the painted height. Marked paintable so plants can be
// planted on them too.
const LOOK: Record<SubstrateType, { color: string; roughness: number }> = {
  aquasoil: { color: "#2b2420", roughness: 1.0 },
  sand: { color: "#d8c79f", roughness: 0.95 },
  gravel: { color: "#8c8478", roughness: 1.0 },
};

export function GroundCover() {
  const ground = useStudioStore((s) => s.ground);
  return (
    <group>
      {ground.map((p) => {
        const look = LOOK[p.type];
        return (
          <mesh
            key={p.id}
            position={[p.position[0], p.position[1] + 0.12, p.position[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
            userData={{ paintable: true }}
            onPointerDown={beginStroke}
            onPointerMove={onSurfaceMove}
            onPointerOut={clearHover}
          >
            <circleGeometry args={[p.radius, 28]} />
            <meshStandardMaterial
              color={look.color}
              roughness={look.roughness}
              metalness={0}
              polygonOffset
              polygonOffsetFactor={-1}
            />
          </mesh>
        );
      })}
    </group>
  );
}
