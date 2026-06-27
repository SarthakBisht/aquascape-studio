"use client";

import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Clone, Outlines, TransformControls, useGLTF } from "@react-three/drei";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useStudioStore } from "@/store/useStudioStore";
import { getMaterial } from "@/data/hardscapeMaterials";
import { getSurface } from "@/data/hardscapeTextures";
import { getRockForm } from "@/data/rockForms";
import { makeRockGeometry } from "@/lib/proceduralRock";
import { makeDriftwoodGeometry, DEFAULT_DRIFT } from "@/lib/driftwood";
import { meshFromHeightfield, loadHeightField } from "@/lib/heightfieldMesh";
import {
  beginStroke,
  onSurfaceMove,
  clearHover,
  trackHover,
  hover,
} from "@/lib/surfaceInteraction";
import {
  affected,
  decodeDisp,
  encodeDisp,
  buildAdjacency,
  clampLen,
  regionNormal,
  grab,
  smooth,
  flatten,
  pinch,
} from "@/lib/rockSculpt";
import { useSurfaceTexture } from "@/lib/surfaceImage";
import { TriplanarMaterial } from "./TriplanarMaterial";
import type { HardscapeItem, Vec3 } from "@/lib/types";

// Translucent wireframe sphere showing the rock-sculpt brush footprint. Follows
// the shared `hover` point imperatively (no React renders), non-raycastable so it
// never blocks the stroke beneath it (mirrors PlantTools).
function SculptCursor({ worldRadius }: { worldRadius: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    m.visible = hover.active;
    if (hover.active) m.position.set(hover.x, hover.y, hover.z);
  });
  return (
    <mesh ref={ref} raycast={() => null} scale={Math.max(0.01, worldRadius)} visible={false}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial
        color="#b8cf90"
        wireframe
        transparent
        opacity={0.35}
        depthTest={false}
      />
    </mesh>
  );
}

// Reused scratch for sculpt math (avoid per-event allocation).
const _scratch = new THREE.Vector3();

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

// Memoized so a transform drag (which replaces only the moved item) re-renders
// just that piece, not every rock/wood in the tank.
const HardscapeMesh = memo(function HardscapeMesh({ item }: { item: HardscapeItem }) {
  // Hold the Object3D in state (via a stable callback ref) so TransformControls
  // always receives a non-null object, even when a freshly added piece is
  // auto-selected on its first render.
  const [obj, setObj] = useState<THREE.Group | null>(null);
  const setRef = useCallback((g: THREE.Group | null) => setObj(g), []);
  const mode = useStudioStore((s) => s.mode);
  const selectedId = useStudioStore((s) => s.selectedId);
  const transformMode = useStudioStore((s) => s.transformMode);
  const tool = useStudioStore((s) => s.tool);
  const sculptRadius = useStudioStore((s) => s.sculptRadius);
  const selectItem = useStudioStore((s) => s.selectItem);
  const updateHardscape = useStudioStore((s) => s.updateHardscape);
  const beginTxn = useStudioStore((s) => s.beginTxn);
  const endTxn = useStudioStore((s) => s.endTxn);
  const { camera, gl } = useThree();

  const material = getMaterial(item.materialId);
  const editable = mode === "design";
  const isSelected = editable && selectedId === item.id;

  // Per-piece sculpt overrides win, then the material default, then a kind default.
  // (mesh source → built async below from a stored height field.)
  const procGeometry = useMemo(() => {
    if (item.source === "mesh" || item.source === "sculpt") return null;
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
      pitting: item.pitting ?? def.pitting,
      pitScale: item.pitScale ?? def.pitScale,
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
    item.pitting,
    item.pitScale,
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

  // ---- free-sculpt (source === "sculpt") ----
  // Welded indexed base (shared verts + smooth normals → no cracks while
  // brushing), rebuilt deterministically from the locked params, plus immutable
  // base position/normal snapshots so final = base + displacement is recomputable.
  const sculpt = useMemo(() => {
    if (item.source !== "sculpt") return null;
    const isWood = item.kind === "wood";
    const def = getRockForm(item.form ?? material?.form);
    const raw = makeRockGeometry(item.seed, {
      primitive: def.primitive,
      jaggedness:
        item.jaggedness ?? material?.jaggedness ?? (isWood ? 0.22 : def.jaggedness),
      detail: item.detail ?? 4,
      shape: item.shape ?? material?.shape ?? def.shape,
      taper: item.taper ?? def.taper,
      flat: item.flat ?? def.flat,
      tilt: item.tilt ?? 0,
      veinColor: item.veinColor ?? material?.veinColor,
      strata: item.strata ?? material?.strata ?? def.strata,
      pitting: item.pitting ?? def.pitting,
      pitScale: item.pitScale ?? def.pitScale,
    });
    const geo = mergeVertices(raw);
    raw.dispose();
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const vcount = geo.attributes.position.count;
    return {
      geo,
      basePos: (geo.attributes.position.array as Float32Array).slice(),
      adj: buildAdjacency(geo.index!.array, vcount),
      boundsR: geo.boundingSphere?.radius ?? 1,
    };
  }, [
    item.source, item.seed, item.kind, item.form, item.jaggedness, item.detail,
    item.shape, item.taper, item.flat, item.tilt, item.veinColor, item.strata,
    item.pitting, item.pitScale,
    material?.form, material?.shape, material?.jaggedness, material?.veinColor,
    material?.strata,
  ]);
  useEffect(() => () => sculpt?.geo.dispose(), [sculpt]);

  const dispRef = useRef<Float32Array | null>(null);
  const stroking = useRef(false);
  const grabPlane = useRef(new THREE.Plane());
  const grabAff = useRef<ReturnType<typeof affected> | null>(null);
  const grabLastLocal = useRef(new THREE.Vector3());
  const lastDabLocal = useRef(new THREE.Vector3());
  const ndc = useRef(new THREE.Vector2());
  const ray = useRef(new THREE.Raycaster());

  // Apply the stored displacement to the live geometry (load / undo / fresh weld).
  // Skipped mid-stroke so it can't clobber an in-flight edit.
  useEffect(() => {
    if (!sculpt || stroking.current) return;
    const n = sculpt.basePos.length / 3;
    const disp = item.sculptD ? decodeDisp(item.sculptD, n) : new Float32Array(n * 3);
    dispRef.current = disp;
    const pos = sculpt.geo.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i++) pos[i] = sculpt.basePos[i] + disp[i];
    sculpt.geo.attributes.position.needsUpdate = true;
    sculpt.geo.computeVertexNormals();
  }, [sculpt, item.sculptD]);

  const sculptActive =
    editable && tool === "rocksculpt" && isSelected && item.source === "sculpt" && !!sculpt;

  // One dab of a surface brush (draw/smooth/flatten/pinch) at a world point.
  const sculptDab = (worldPoint: THREE.Vector3) => {
    if (!sculpt || !obj || !dispRef.current) return;
    const s = useStudioStore.getState();
    const local = obj.worldToLocal(worldPoint.clone());
    const r = s.sculptRadius * sculpt.boundsR;
    const pos = sculpt.geo.attributes.position.array as Float32Array;
    const nrm = sculpt.geo.attributes.normal.array as Float32Array;
    const aff = affected(pos, local.x, local.y, local.z, r);
    if (!aff.idx.length) return;
    const disp = dispRef.current;
    const adj = sculpt.adj;
    const maxLen = sculpt.boundsR * 0.35; // keep edits shallow → no punch-through
    if (s.sculptBrush === "draw") {
      // Push/pull the WHOLE region along one averaged normal (coherent, like
      // grab) — not each vertex's own normal, which tears the surface.
      const n = regionNormal(nrm, aff);
      const amt = s.sculptStrength * sculpt.boundsR * 0.06 * s.sculptDir;
      grab(disp, pos, aff, n.x * amt, n.y * amt, n.z * amt);
      smooth(disp, pos, adj, aff, 0.15);
      clampLen(disp, pos, sculpt.basePos, aff, maxLen);
    } else if (s.sculptBrush === "smooth") {
      smooth(disp, pos, adj, aff, s.sculptStrength * 0.7);
    } else if (s.sculptBrush === "flatten") {
      flatten(disp, pos, nrm, aff, s.sculptStrength * 0.3);
      smooth(disp, pos, adj, aff, 0.2);
      clampLen(disp, pos, sculpt.basePos, aff, maxLen);
    } else if (s.sculptBrush === "pinch") {
      pinch(disp, pos, aff, local.x, local.y, local.z, s.sculptStrength * 0.15);
      smooth(disp, pos, adj, aff, 0.25);
      clampLen(disp, pos, sculpt.basePos, aff, maxLen);
    }
    sculpt.geo.attributes.position.needsUpdate = true;
    // Recompute normals each dab so shading is right live AND the next dab pushes
    // along the *current* surface normal (not the original) — key to smoothness.
    sculpt.geo.computeVertexNormals();
  };

  const endSculpt = () => {
    if (!stroking.current) return;
    stroking.current = false;
    if (sculpt) {
      sculpt.geo.computeVertexNormals();
      if (dispRef.current)
        updateHardscape(item.id, {
          sculptD: encodeDisp(dispRef.current),
          sculptN: sculpt.basePos.length / 3,
        });
    }
    endTxn();
  };

  const startSculpt = (e: ThreeEvent<PointerEvent>) => {
    if (!sculpt || !obj || !dispRef.current) return;
    e.stopPropagation();
    stroking.current = true;
    beginTxn();
    trackHover(e);
    const s = useStudioStore.getState();
    if (s.sculptBrush === "grab") {
      camera.getWorldDirection(_scratch);
      grabPlane.current.setFromNormalAndCoplanarPoint(_scratch, e.point);
      grabLastLocal.current.copy(obj.worldToLocal(e.point.clone()));
      const pos = sculpt.geo.attributes.position.array as Float32Array;
      const l = grabLastLocal.current;
      grabAff.current = affected(pos, l.x, l.y, l.z, s.sculptRadius * sculpt.boundsR);
    } else {
      sculptDab(e.point);
      lastDabLocal.current.copy(obj.worldToLocal(e.point.clone()));
    }
  };

  const moveSculpt = (e: ThreeEvent<PointerEvent>) => {
    if (!stroking.current || !sculpt || !obj) return;
    trackHover(e);
    const s = useStudioStore.getState();
    if (s.sculptBrush === "grab") return; // grab rides the window listener
    const local = obj.worldToLocal(e.point.clone());
    if (local.distanceTo(lastDabLocal.current) < s.sculptRadius * sculpt.boundsR * 0.35) return;
    sculptDab(e.point);
    lastDabLocal.current.copy(local);
  };

  // Grab keeps tracking off-silhouette (re-rays against the grab plane); a window
  // pointerup always ends the stroke (a mouseup off the mesh never reaches R3F).
  useEffect(() => {
    if (!sculpt) return;
    const onMove = (ev: PointerEvent) => {
      if (!stroking.current || !obj || !dispRef.current || !grabAff.current) return;
      if (useStudioStore.getState().sculptBrush !== "grab") return;
      const rect = gl.domElement.getBoundingClientRect();
      ndc.current.set(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.current.setFromCamera(ndc.current, camera);
      const hit = ray.current.ray.intersectPlane(grabPlane.current, _scratch);
      if (!hit) return;
      const cur = obj.worldToLocal(hit.clone());
      const d = cur.sub(grabLastLocal.current);
      const posArr = sculpt.geo.attributes.position.array as Float32Array;
      grab(dispRef.current, posArr, grabAff.current, d.x, d.y, d.z);
      clampLen(dispRef.current, posArr, sculpt.basePos, grabAff.current, sculpt.boundsR * 0.6);
      grabLastLocal.current.add(d);
      sculpt.geo.attributes.position.needsUpdate = true;
    };
    const onUp = () => endSculpt();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sculpt, obj, camera, gl]);

  const geometry =
    item.source === "mesh"
      ? meshGeo
      : item.source === "sculpt"
        ? sculpt?.geo ?? null
        : procGeometry;

  // Surface: a procedural HARDSCAPE_SURFACES id, or a "custom:" id → an uploaded
  // image from the store, loaded as a tiled triplanar albedo.
  const textureId = item.textureId ?? material?.textureId;
  const isCustomTex = !!textureId && textureId.startsWith("custom:");
  const customUrl = useStudioStore((s) =>
    isCustomTex ? s.customSurfaces[textureId!] : undefined,
  );
  const customTex = useSurfaceTexture(customUrl);
  const surface = isCustomTex ? undefined : getSurface(textureId ?? "");
  const hasTex = isCustomTex ? !!customTex : !!surface;
  // With a textured surface the texture carries the stone's colour, so the
  // per-piece tint defaults to white (a multiply) — set a color to recolour.
  const color = item.color ?? (hasTex ? "#ffffff" : material?.color ?? "#7a7a7a");
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
        onPointerDown={(e) => (sculptActive ? startSculpt(e) : beginStroke(e))}
        onPointerMove={(e) => {
          if (sculptActive && stroking.current) moveSculpt(e);
          else onSurfaceMove(e);
        }}
        onPointerUp={() => {
          if (stroking.current) endSculpt();
        }}
        onPointerOut={clearHover}
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
            {isCustomTex && customTex ? (
              <TriplanarMaterial
                albedo={customTex}
                tileCm={item.textureScaleCm ?? 20}
                color={color}
                roughness={roughness}
                seed={item.seed}
                doubleSide={item.source === "sculpt"}
              />
            ) : surface ? (
              <TriplanarMaterial
                surface={surface}
                color={color}
                roughness={roughness}
                seed={item.seed}
                doubleSide={item.source === "sculpt"}
              />
            ) : (
              <meshStandardMaterial
                color={color}
                roughness={roughness}
                metalness={material?.metalness ?? 0}
                vertexColors
                flatShading
                side={item.source === "sculpt" ? THREE.DoubleSide : THREE.FrontSide}
              />
            )}
            {isSelected && <Outlines thickness={3} color="#b8cf90" />}
          </mesh>
        ) : null}
      </group>
      {/* Gizmo is hidden while sculpting so it doesn't intercept brush drags. */}
      {isSelected && obj && !sculptActive && (
        <TransformControls
          object={obj}
          mode={transformMode}
          onMouseDown={() => beginTxn()}
          onMouseUp={() => endTxn()}
          onObjectChange={writeBack}
        />
      )}
      {sculptActive && sculpt && (
        <SculptCursor worldRadius={sculptRadius * sculpt.boundsR * item.scale} />
      )}
    </>
  );
});

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
