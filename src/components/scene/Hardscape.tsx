"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Clone, Outlines, TransformControls, useGLTF } from "@react-three/drei";
import { useStudioStore } from "@/store/useStudioStore";
import { getMaterial } from "@/data/hardscapeMaterials";
import { getSurface } from "@/data/hardscapeTextures";
import { getRockForm } from "@/data/rockForms";
import { makeRockGeometry } from "@/lib/proceduralRock";
import { makeDriftwoodGeometry, DEFAULT_DRIFT } from "@/lib/driftwood";
import { meshFromHeightfield, loadHeightField } from "@/lib/heightfieldMesh";
import { beginStroke, moveStroke } from "@/lib/surfaceInteraction";
import { TriplanarMaterial } from "./TriplanarMaterial";
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
  const beginTxn = useStudioStore((s) => s.beginTxn);
  const endTxn = useStudioStore((s) => s.endTxn);

  const material = getMaterial(item.materialId);
  const editable = mode === "design";
  const isSelected = editable && selectedId === item.id;

  // Per-piece sculpt overrides win, then the material default, then a kind default.
  // (mesh source → built async below from a stored height field.)
  const procGeometry = useMemo(() => {
    if (item.source === "mesh") return null;
    if (item.source === "drift") {
      return makeDriftwoodGeometry(item.seed, item.drift ?? DEFAULT_DRIFT);
    }
    const isWood = item.kind === "wood";
    const def = getRockForm(item.form ?? material?.form);
    return makeRockGeometry(item.seed, {
      primitive: def.primitive,
      jaggedness: item.jaggedness ?? material?.jaggedness ?? (isWood ? 0.22 : def.jaggedness),
      detail: item.detail ?? (isWood ? 1 : def.detail),
      shape: item.shape ?? material?.shape ?? def.shape,
      taper: item.taper ?? def.taper,
      flat: item.flat ?? def.flat,
      tilt: item.tilt ?? 0,
      veinColor: item.veinColor ?? material?.veinColor,
      strata: item.strata ?? material?.strata ?? def.strata,
    });
  }, [
    item.source,
    item.seed,
    item.kind,
    item.drift,
    item.form,
    item.jaggedness,
    item.detail,
    item.shape,
    item.taper,
    item.flat,
    item.tilt,
    item.veinColor,
    item.strata,
    material?.form,
    material?.shape,
    material?.jaggedness,
    material?.veinColor,
    material?.strata,
  ]);

  // Geometries live in GPU memory until disposed.
  useEffect(() => () => procGeometry?.dispose(), [procGeometry]);

  // Generated (drawn / depth-photo) pieces rebuild geometry from a stored height
  // PNG. Subscribe to just this piece's mesh entry.
  const customHeight = useStudioStore((s) =>
    item.source === "mesh" && item.meshId
      ? s.customMeshes[item.meshId]?.height
      : undefined,
  );
  const [meshGeo, setMeshGeo] = useState<THREE.BufferGeometry | null>(null);
  useEffect(() => {
    if (!customHeight) {
      setMeshGeo(null);
      return;
    }
    let alive = true;
    let g: THREE.BufferGeometry | null = null;
    loadHeightField(customHeight).then(({ height, w, h }) => {
      if (!alive) return;
      g = meshFromHeightfield(height, w, h);
      setMeshGeo(g);
    });
    return () => {
      alive = false;
      g?.dispose();
    };
  }, [customHeight]);

  const geometry = item.source === "mesh" ? meshGeo : procGeometry;

  const surface = getSurface(item.textureId ?? material?.textureId ?? "");
  // With a PBR surface the texture carries the stone's colour, so the per-piece
  // tint defaults to white (a multiply) — set a color in Customize to recolour.
  const color =
    item.color ?? (surface ? "#ffffff" : material?.color ?? "#7a7a7a");
  const roughness = item.roughness ?? material?.roughness ?? 0.9;

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
        onPointerDown={beginStroke}
        onPointerMove={moveStroke}
        onClick={(e) => {
          if (!editable) return;
          if (useStudioStore.getState().tool !== "select") return; // brush active → drawing
          e.stopPropagation();
          selectItem(item.id);
        }}
      >
        {material?.model ? (
          <Suspense fallback={null}>
            <HardscapeModel url={material.model} />
          </Suspense>
        ) : geometry ? (
          <mesh geometry={geometry} castShadow receiveShadow>
            {surface ? (
              <TriplanarMaterial
                surface={surface}
                color={color}
                roughness={roughness}
                seed={item.seed}
              />
            ) : (
              <meshStandardMaterial
                color={color}
                roughness={roughness}
                metalness={material?.metalness ?? 0}
                vertexColors
                flatShading
              />
            )}
            {isSelected && <Outlines thickness={3} color="#b8cf90" />}
          </mesh>
        ) : null}
      </group>
      {isSelected && obj && (
        <TransformControls
          object={obj}
          mode={transformMode}
          onMouseDown={() => beginTxn()}
          onMouseUp={() => endTxn()}
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
