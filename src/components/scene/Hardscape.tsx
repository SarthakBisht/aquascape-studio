"use client";

import {
  createContext,
  memo,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Clone, Outlines, TransformControls, useGLTF } from "@react-three/drei";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SimplifyModifier } from "three/examples/jsm/modifiers/SimplifyModifier.js";
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
import type { HardscapeItem, HardscapeSurface, Vec3 } from "@/lib/types";

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

// Pull the boulder's geometry + baked material out of a loaded base .glb ONCE
// (cached per scene; drei's useGLTF shares the scene across all rock instances).
// Geometry is baked to world space then normalized to a unit footprint seated on
// y=0 — same scale as procedural rocks, so item.scale + triplanar texel size land
// identically. ponytail: takes the FIRST mesh (Poly Haven rocks are single-mesh);
// merge for multi-mesh glbs later.
const _baseCache = new WeakMap<
  THREE.Object3D,
  { geometry: THREE.BufferGeometry; material: THREE.Material }
>();

function extractBase(scene: THREE.Object3D) {
  const hit = _baseCache.get(scene);
  if (hit) return hit;
  scene.updateWorldMatrix(true, true);
  let src: THREE.Mesh | null = null;
  scene.traverse((o) => {
    if (!src && (o as THREE.Mesh).isMesh) src = o as THREE.Mesh;
  });
  const mesh = src as THREE.Mesh | null;
  if (!mesh) {
    const result = {
      geometry: new THREE.BufferGeometry(),
      material: new THREE.MeshStandardMaterial(),
    };
    _baseCache.set(scene, result);
    return result;
  }
  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  geometry.boundingBox!.getSize(size);
  geometry.boundingBox!.getCenter(center);
  const norm = 1 / (Math.max(size.x, size.y, size.z) || 1);
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(norm, norm, norm);
  geometry.computeBoundingBox();
  geometry.translate(0, -geometry.boundingBox!.min.y, 0);
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const result = { geometry, material };
  _baseCache.set(scene, result);
  return result;
}

// Clone a source material so per-piece tint/roughness/side can't bleed across the
// rocks that share a cached original; tint + dispose on change. Returns null when
// there's no source (the caller renders a fallback). Shared by static model rocks
// and sculpted-glb rocks.
function useTintedClone(
  src: THREE.Material | null | undefined,
  color: string,
  roughness: number,
  doubleSide = false,
): THREE.MeshStandardMaterial | null {
  const mat = useMemo(
    () => (src ? (src.clone() as THREE.MeshStandardMaterial) : null),
    [src],
  );
  useEffect(() => () => mat?.dispose(), [mat]);
  useEffect(() => {
    if (!mat) return;
    mat.color?.set(color);
    if ("roughness" in mat) mat.roughness = roughness;
    mat.side = doubleSide ? THREE.DoubleSide : THREE.FrontSide;
  }, [mat, color, roughness, doubleSide]);
  return mat;
}

// ---- glb hand-sculpt support ----
// A welded, simplified base built ONCE from the uploaded glb (cached per scene),
// shared read-only by every sculpted-glb rock; each rock clones `geoTemplate` for
// its own live geometry and keeps its own displacement. Mirrors the procedural
// sculpt base ({geo, basePos, adj, boundsR}) so the brush code is identical.
type SculptTemplate = {
  geoTemplate: THREE.BufferGeometry;
  basePos: Float32Array;
  adj: number[][];
  boundsR: number;
  /** The glb's baseColor texture, applied triplanar (world-space) so the sculpted
   *  surface keeps its look without UVs (which we drop to weld crack-free). */
  albedoMap: THREE.Texture | null;
};
const _sculptTplCache = new WeakMap<THREE.Object3D, SculptTemplate>();
const SCULPT_TARGET_VERTS = 6000; // brush perf + dense int16 displacement ≤ ~35 KB/rock

function buildSculptTemplate(scene: THREE.Object3D): SculptTemplate {
  const hit = _sculptTplCache.get(scene);
  if (hit) return hit;
  const base = extractBase(scene); // normalized geometry (don't mutate — it's cached)
  // Weld by POSITION ONLY → a watertight base that can't crack. A glb splits
  // vertices at UV/normal seams; those coincident-but-separate verts tear apart
  // when sculpted (the "cracks"). Dropping uv/normal/tangent lets mergeVertices
  // fuse them into one surface; normals are recomputed below, and the texture is
  // applied triplanar (world-space) so nothing relies on the dropped seams.
  const stripped = base.geometry.clone();
  stripped.deleteAttribute("uv");
  stripped.deleteAttribute("uv1");
  stripped.deleteAttribute("normal");
  stripped.deleteAttribute("tangent");
  // Simplify to a sculpt-friendly resolution. SimplifyModifier welds internally,
  // is deterministic, and returns NON-indexed → re-weld for an adjacency index.
  const welded0 = mergeVertices(stripped);
  const wc = welded0.attributes.position.count;
  welded0.dispose();
  const remove = Math.max(0, wc - SCULPT_TARGET_VERTS);
  const simplified =
    remove > 0 ? new SimplifyModifier().modify(stripped, remove) : stripped.clone();
  stripped.dispose();
  const geoTemplate = mergeVertices(simplified); // weld by position → no cracks
  simplified.dispose();
  geoTemplate.computeVertexNormals();
  geoTemplate.computeBoundingSphere();
  // Neutral mottle so the no-surface fallback path isn't black.
  const count = geoTemplate.attributes.position.count;
  const colors = new Float32Array(count * 3).fill(0.82);
  geoTemplate.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const tpl: SculptTemplate = {
    geoTemplate,
    basePos: (geoTemplate.attributes.position.array as Float32Array).slice(),
    adj: buildAdjacency(geoTemplate.index!.array, count),
    boundsR: geoTemplate.boundingSphere?.radius ?? 1,
    albedoMap: (base.material as THREE.MeshStandardMaterial).map ?? null,
  };
  _sculptTplCache.set(scene, tpl);
  return tpl;
}

// Holds the shared sculpt template (null until a glb is loaded + built). Provided
// by Hardscape, read by every HardscapeMesh.
const BaseSculptContext = createContext<SculptTemplate | null>(null);

// Loads the glb once and builds the shared sculpt template (off the render path so
// it never suspends the non-model pieces). Mounted only when a sculpted-glb rock
// actually exists, so the (heavy, one-time) simplify is deferred until first use.
function BaseSculptLoader({
  url,
  onReady,
}: {
  url: string;
  onReady: (t: SculptTemplate | null) => void;
}) {
  const { scene } = useGLTF(url);
  const tpl = useMemo(() => buildSculptTemplate(scene), [scene]);
  useEffect(() => {
    onReady(tpl);
    return () => onReady(null);
  }, [tpl, onReady]);
  return null;
}

// A rock rendered from the uploaded base .glb. Reuses the SAME material branch as
// procedural rocks (uploaded photo / library surface / fallback), so per-piece
// customization works on the boulder; the fallback here is the glb's own baked
// material (cloned + tinted) instead of flat vertex colors. dispose={null} keeps
// the shared cached geometry alive when one instance unmounts.
function ModelRock({
  url,
  shape,
  color,
  roughness,
  seed,
  isSelected,
  customTex,
  surface,
  textureScaleCm,
}: {
  url: string;
  /** Per-axis squash/stretch applied to the inner mesh (the group keeps a uniform
   *  scale so the transform gizmo stays uniform). */
  shape: Vec3;
  color: string;
  roughness: number;
  seed: number;
  isSelected: boolean;
  customTex: THREE.Texture | null;
  surface: HardscapeSurface | undefined;
  textureScaleCm: number | undefined;
}) {
  const { scene } = useGLTF(url);
  const base = useMemo(() => extractBase(scene), [scene]);
  // glb's own baked material (cloned + tinted) is the default look.
  const ownMat = useTintedClone(base.material, color, roughness);

  return (
    <mesh geometry={base.geometry} scale={shape} castShadow receiveShadow dispose={null}>
      {customTex ? (
        <TriplanarMaterial
          albedo={customTex}
          tileCm={textureScaleCm ?? 20}
          color={color}
          roughness={roughness}
          seed={seed}
        />
      ) : surface ? (
        <TriplanarMaterial
          surface={surface}
          color={color}
          roughness={roughness}
          seed={seed}
        />
      ) : ownMat ? (
        <primitive object={ownMat} attach="material" />
      ) : null}
      {isSelected && <Outlines thickness={3} color="#b8cf90" />}
    </mesh>
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
  const baseRockModelUrl = useStudioStore((s) => s.baseRockModelUrl);
  const sculptRadius = useStudioStore((s) => s.sculptRadius);
  const selectItem = useStudioStore((s) => s.selectItem);
  const updateHardscape = useStudioStore((s) => s.updateHardscape);
  const beginTxn = useStudioStore((s) => s.beginTxn);
  const endTxn = useStudioStore((s) => s.endTxn);
  const baseSculpt = useContext(BaseSculptContext);
  const { camera, gl } = useThree();

  const material = getMaterial(item.materialId);
  const editable = mode === "design";
  const isSelected = editable && selectedId === item.id;

  // A user-uploaded base .glb replaces ALL plain rocks' shape (one base for all).
  // Wood + user-made shapes (mesh/sculpt/drift) keep their own geometry.
  // ponytail: base-model rocks use the glb's own materials; per-piece surface/
  // color override on models is deferred.
  const useModel =
    !!baseRockModelUrl &&
    item.kind === "rock" &&
    (item.source === "procedural" || item.source == null);

  // Per-piece sculpt overrides win, then the material default, then a kind default.
  // (mesh source → built async below from a stored height field.)
  const procGeometry = useMemo(() => {
    if (useModel) return null;
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
    useModel,
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
    // Sculpt the uploaded glb instead of a procedural rock: clone the shared
    // simplified+welded template for this piece's live geometry; basePos/adj/
    // boundsR are shared read-only (identical brush code downstream).
    if (item.sculptBase === "model") {
      if (!baseSculpt) return null; // template not built yet (loads async)
      return {
        geo: baseSculpt.geoTemplate.clone(),
        basePos: baseSculpt.basePos,
        adj: baseSculpt.adj,
        boundsR: baseSculpt.boundsR,
      };
    }
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
    item.source, item.sculptBase, baseSculpt,
    item.seed, item.kind, item.form, item.jaggedness, item.detail,
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
  // image from the store, loaded as a tiled triplanar albedo. Model rocks ignore
  // the material's *default* textureId so a fresh one keeps the glb's own baked
  // texture (only an explicit per-piece textureId overrides it).
  const textureId = useModel ? item.textureId : item.textureId ?? material?.textureId;
  const isCustomTex = !!textureId && textureId.startsWith("custom:");
  const customUrl = useStudioStore((s) =>
    isCustomTex ? s.customSurfaces[textureId!] : undefined,
  );
  const customTex = useSurfaceTexture(customUrl);
  const surface = isCustomTex ? undefined : getSurface(textureId ?? "");
  const hasTex = isCustomTex ? !!customTex : !!surface;
  // With a textured surface the texture carries the stone's colour, so the
  // per-piece tint defaults to white (a multiply) — set a color to recolour. A
  // model rock's fallback is the glb's own baked texture → also default white.
  const color = useModel || (item.source === "sculpt" && item.sculptBase === "model")
    ? item.color ?? "#ffffff"
    : item.color ?? (hasTex ? "#ffffff" : material?.color ?? "#7a7a7a");
  const roughness = item.roughness ?? material?.roughness ?? 0.9;

  // A sculpted glb rock keeps the boulder's texture by default, sampled triplanar
  // (world-space) since the watertight weld dropped UVs; null for every other
  // piece, which falls through to surface / vertex-colour.
  const isModelSculpt = item.source === "sculpt" && item.sculptBase === "model";
  const sculptAlbedo = isModelSculpt ? baseSculpt?.albedoMap ?? null : null;

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
        {useModel && baseRockModelUrl ? (
          <Suspense fallback={null}>
            <ModelRock
              url={baseRockModelUrl}
              shape={item.shape ?? [1, 1, 1]}
              color={color}
              roughness={roughness}
              seed={item.seed}
              isSelected={isSelected}
              customTex={isCustomTex ? customTex : null}
              surface={surface}
              textureScaleCm={item.textureScaleCm}
            />
          </Suspense>
        ) : material?.model ? (
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
            ) : sculptAlbedo ? (
              <TriplanarMaterial
                albedo={sculptAlbedo}
                tileCm={item.textureScaleCm ?? 20}
                color={color}
                roughness={roughness}
                seed={item.seed}
                doubleSide
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
  const baseRockModelUrl = useStudioStore((s) => s.baseRockModelUrl);
  const [tpl, setTpl] = useState<SculptTemplate | null>(null);
  const onReady = useCallback((t: SculptTemplate | null) => setTpl(t), []);
  // Build the (one-time, heavy) sculpt template only once a glb rock is actually
  // being sculpted — not on every base-model upload.
  const needsSculptTpl =
    !!baseRockModelUrl && hardscape.some((h) => h.sculptBase === "model");

  return (
    <group>
      {needsSculptTpl && baseRockModelUrl && (
        <Suspense fallback={null}>
          <BaseSculptLoader url={baseRockModelUrl} onReady={onReady} />
        </Suspense>
      )}
      <BaseSculptContext.Provider value={needsSculptTpl ? tpl : null}>
        {hardscape.map((item) => (
          <HardscapeMesh key={item.id} item={item} />
        ))}
      </BaseSculptContext.Provider>
    </group>
  );
}
