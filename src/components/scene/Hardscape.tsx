"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Clone, Outlines, TransformControls, useGLTF } from "@react-three/drei";
import { useStudioStore } from "@/store/useStudioStore";
import { getMaterial } from "@/data/hardscapeMaterials";
import { makeRockGeometry } from "@/lib/proceduralRock";
import { paintIfActive } from "@/lib/surfaceInteraction";
import type { HardscapeItem, Vec3 } from "@/lib/types";

// Real scanned .glb hardscape, normalized to a unit footprint and seated on the
// ground so it drops in at the same scale as the procedural rocks.
function HardscapeModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const { norm, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const n = 1 / (Math.max(size.x, size.y, size.z) || 1);
    return {
      norm: n,
      offset: [-center.x * n, -box.min.y * n, -center.z * n] as Vec3,
    };
  }, [scene]);
  return (
    <group position={offset}>
      <group scale={norm}>
        <Clone object={scene} />
      </group>
    </group>
  );
}

function HardscapeMesh({ item }: { item: HardscapeItem }) {
  // Hold the Object3D in state (via a stable callback ref) so TransformControls
  // always receives a non-null object, even when a freshly added piece is
  // auto-selected on its first render.
  const [obj, setObj] = useState<THREE.Group | null>(null);
  const setRef = useCallback((g: THREE.Group | null) => setObj(g), []);
  const mode = useStudioStore((s) => s.mode);
  const selectedId = useStudioStore((s) => s.selectedId);
  const transformMode = useStudioStore((s) => s.transformMode);
  const selectItem = useStudioStore((s) => s.selectItem);
  const updateHardscape = useStudioStore((s) => s.updateHardscape);

  const material = getMaterial(item.materialId);
  const editable = mode === "design";
  const isSelected = editable && selectedId === item.id;

  const geometry = useMemo(() => {
    const isWood = item.kind === "wood";
    return makeRockGeometry(item.seed, {
      jaggedness: isWood ? 0.22 : 0.45,
      detail: isWood ? 1 : 2,
      shape: material?.shape ?? [1, 1, 1],
    });
  }, [item.seed, item.kind, material?.shape]);

  // Geometries live in GPU memory until disposed.
  useEffect(() => () => geometry.dispose(), [geometry]);

  const writeBack = () => {
    if (!obj) return;
    updateHardscape(item.id, {
      position: obj.position.toArray() as Vec3,
      rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scale: obj.scale.x,
    });
  };

  return (
    <>
      <group
        ref={setRef}
        position={item.position}
        rotation={item.rotation}
        scale={item.scale}
        userData={{ paintable: true }}
        onClick={(e) => {
          if (!editable) return;
          if (paintIfActive(e)) return; // plant onto this rock/wood surface
          e.stopPropagation();
          selectItem(item.id);
        }}
      >
        {material?.model ? (
          <Suspense fallback={null}>
            <HardscapeModel url={material.model} />
          </Suspense>
        ) : (
          <mesh geometry={geometry} castShadow receiveShadow>
            <meshStandardMaterial
              color={material?.color ?? "#7a7a7a"}
              roughness={material?.roughness ?? 0.9}
              metalness={material?.metalness ?? 0}
              flatShading
            />
            {isSelected && <Outlines thickness={3} color="#b8cf90" />}
          </mesh>
        )}
      </group>
      {isSelected && obj && (
        <TransformControls
          object={obj}
          mode={transformMode}
          onObjectChange={writeBack}
        />
      )}
    </>
  );
}

export function Hardscape() {
  const hardscape = useStudioStore((s) => s.hardscape);
  return (
    <group>
      {hardscape.map((item) => (
        <HardscapeMesh key={item.id} item={item} />
      ))}
    </group>
  );
}
