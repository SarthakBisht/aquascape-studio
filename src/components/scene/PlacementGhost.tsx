"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useStudioStore } from "@/store/useStudioStore";
import { getMaterial } from "@/data/hardscapeMaterials";
import { getRockForm } from "@/data/rockForms";
import { makeRockGeometry } from "@/lib/proceduralRock";
import { makeDriftwoodGeometry, DEFAULT_DRIFT } from "@/lib/driftwood";
import { extractBase } from "./Hardscape";
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

// Translucent preview of the uploaded base .glb while the "model" stamp is armed.
function ModelGhost({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const base = useMemo(() => extractBase(scene), [scene]);
  return (
    <mesh geometry={base.geometry} dispose={null}>
      <meshStandardMaterial color="#9aa0a6" transparent opacity={0.45} depthWrite={false} />
    </mesh>
  );
}

// A translucent piece that tracks the cursor while a stamp is armed, then commits
// on click (and STAYS armed so you can drop more — Esc cancels). One invisible
// catcher plane covers the tank + beyond so the cursor is tracked over empty space
// (place "outside" the tank). Preview geometry is built per placement spec.
export function PlacementGhost() {
  const tool = useStudioStore((s) => s.tool);
  const placing = useStudioStore((s) => s.placing);
  const seed = useStudioStore((s) => s.placingSeed);
  const baseRockModelUrl = useStudioStore((s) => s.baseRockModelUrl);
  const commitPlacement = useStudioStore((s) => s.commitPlacement);
  const cancelPlacing = useStudioStore((s) => s.cancelPlacing);

  const active = tool === "place" && !!placing;
  const [hit, setHit] = useState<Vec3 | null>(null);

  // Procedural / driftwood preview (model is previewed by <ModelGhost/>).
  const geometry = useMemo(() => {
    if (!placing) return null;
    if (placing.type === "material") {
      const m = getMaterial(placing.materialId);
      if (!m) return null;
      const isWood = m.kind === "wood";
      return makeRockGeometry(seed, {
        jaggedness: m.jaggedness ?? (isWood ? 0.22 : 0.45),
        detail: isWood ? 1 : 2,
        shape: m.shape,
        veinColor: m.veinColor,
        strata: m.strata,
      });
    }
    if (placing.type === "form") {
      const def = getRockForm(placing.form);
      return makeRockGeometry(seed, {
        primitive: def.primitive,
        jaggedness: def.jaggedness,
        detail: 2,
        shape: def.shape,
        taper: def.taper,
        flat: def.flat,
        strata: def.strata,
        pitting: def.pitting,
        pitScale: def.pitScale,
      });
    }
    if (placing.type === "drift") return makeDriftwoodGeometry(seed, DEFAULT_DRIFT);
    return null; // model
  }, [placing, seed]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelPlacing();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, cancelPlacing]);

  if (!active || !placing) return null;

  const isWoodMat =
    placing.type === "material" && getMaterial(placing.materialId)?.kind === "wood";
  const scale = placing.type === "drift" || isWoodMat ? 14 : 10;
  const previewColor =
    placing.type === "material"
      ? getMaterial(placing.materialId)?.color ?? "#888"
      : placing.type === "drift"
        ? "#7a5a3a"
        : "#8a8a8a";

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
    commitPlacement((hit ?? [e.point.x, 0, e.point.z]) as Vec3);
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
          {placing.type === "model" && baseRockModelUrl ? (
            <Suspense fallback={null}>
              <ModelGhost url={baseRockModelUrl} />
            </Suspense>
          ) : geometry ? (
            <mesh geometry={geometry}>
              <meshStandardMaterial
                color={previewColor}
                vertexColors
                transparent
                opacity={0.45}
                depthWrite={false}
              />
            </mesh>
          ) : null}
        </group>
      )}
    </>
  );
}
