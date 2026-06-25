"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useStudioStore } from "@/store/useStudioStore";
import { getMaterial } from "@/data/hardscapeMaterials";
import { makeRockGeometry } from "@/lib/proceduralRock";
import type { Vec3 } from "@/lib/types";

const _down = new THREE.Vector3(0, -1, 0);
const _ray = new THREE.Raycaster();
const _origin = new THREE.Vector3();

function sceneRoot(o: THREE.Object3D): THREE.Object3D {
  let r = o;
  while (r.parent) r = r.parent;
  return r;
}

function paintableTargets(from: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  sceneRoot(from).traverse((o) => {
    const m = o as THREE.Mesh;
    let p: THREE.Object3D | null = o;
    let paint = false;
    while (p) {
      if (p.userData?.paintable) {
        paint = true;
        break;
      }
      p = p.parent;
    }
    if (m.isMesh && paint) out.push(m);
  });
  return out;
}

// A translucent rock that tracks the cursor while a rock type is armed, then
// commits on click. An invisible catcher plane covers the tank and beyond so the
// cursor is tracked even over empty space (place "outside" the tank).
export function PlacementGhost() {
  const tool = useStudioStore((s) => s.tool);
  const materialId = useStudioStore((s) => s.placingMaterialId);
  const seed = useStudioStore((s) => s.placingSeed);
  const addHardscape = useStudioStore((s) => s.addHardscape);
  const cancelPlacing = useStudioStore((s) => s.cancelPlacing);

  const material = materialId ? getMaterial(materialId) : undefined;
  const active = tool === "place" && !!material;
  const [hit, setHit] = useState<Vec3 | null>(null);

  const geometry = useMemo(() => {
    if (!material) return null;
    const isWood = material.kind === "wood";
    return makeRockGeometry(seed, {
      jaggedness: material.jaggedness ?? (isWood ? 0.22 : 0.45),
      detail: isWood ? 1 : 2,
      shape: material.shape,
      veinColor: material.veinColor,
      strata: material.strata,
    });
  }, [material, seed]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelPlacing();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, cancelPlacing]);

  if (!active || !geometry || !material) return null;

  const scale = material.kind === "wood" ? 14 : 10;

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const targets = paintableTargets(e.object);
    _origin.set(e.point.x, e.point.y + 60, e.point.z);
    _ray.set(_origin, _down);
    const surf = _ray.intersectObjects(targets, false)[0];
    const y = surf ? surf.point.y : 0;
    setHit([e.point.x, y, e.point.z]);
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const pos = (hit ?? [e.point.x, 0, e.point.z]) as Vec3;
    addHardscape(material.id, pos, seed);
  };

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onPointerMove={onMove}
        onClick={onClick}
      >
        <planeGeometry args={[4000, 4000]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {hit && (
        <group position={hit} scale={scale}>
          <mesh geometry={geometry}>
            <meshStandardMaterial
              color={material.color}
              vertexColors
              transparent
              opacity={0.45}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}
    </>
  );
}
