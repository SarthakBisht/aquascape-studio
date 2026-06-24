"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SubstrateConfig, TankDimensions } from "@/lib/types";

// Dancing light caustics on the substrate — a procedurally drawn caustic
// network that drifts and breathes. Additive, so it just adds light. A flat
// overlay (close enough over the gentle slope); a true projected/shader version
// is a high-tier upgrade.
function makeCaustics(): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const v =
        Math.sin(x * 0.06 + y * 0.03) +
        Math.sin(x * 0.03 - y * 0.05) +
        Math.sin((x + y) * 0.04 + 1.3);
      const veins = Math.pow(Math.abs(Math.sin(v * 1.4)), 8);
      const idx = (y * S + x) * 4;
      img.data[idx] = 235;
      img.data[idx + 1] = 250;
      img.data[idx + 2] = 255;
      img.data[idx + 3] = Math.min(255, veins * 255 * 1.6);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.center.set(0.5, 0.5);
  return tex;
}

export function Caustics({
  dims,
  substrate,
}: {
  dims: TankDimensions;
  substrate: SubstrateConfig;
}) {
  const texture = useMemo(makeCaustics, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const ref = useRef<THREE.Mesh>(null);
  const y = (substrate.depthFront + substrate.depthBack) / 2 + 0.3;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    texture.offset.x = t * 0.015;
    texture.offset.y = Math.sin(t * 0.2) * 0.06;
    texture.rotation = Math.sin(t * 0.05) * 0.12;
    const m = ref.current?.material as THREE.MeshBasicMaterial | undefined;
    if (m) m.opacity = 0.16 + Math.sin(t * 0.8) * 0.06;
  });

  return (
    <mesh ref={ref} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[dims.width * 0.96, dims.depth * 0.96]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.18}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
