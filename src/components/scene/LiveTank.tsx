"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GlassTank } from "./GlassTank";
import { Fish } from "./Fish";
import { BackdropPanel } from "./Backdrop";
import { TriplanarMaterial } from "./TriplanarMaterial";
import { getMaterial } from "@/data/hardscapeMaterials";
import { getSurface } from "@/data/hardscapeTextures";
import { getRockForm } from "@/data/rockForms";
import { getSpecies } from "@/data/plants";
import { plantHabit } from "@/lib/plantHabit";
import { makeRockGeometry } from "@/lib/proceduralRock";
import { makeDriftwoodGeometry, DEFAULT_DRIFT } from "@/lib/driftwood";
import { meshFromHeightfield, loadHeightField } from "@/lib/heightfieldMesh";
import { decodeDisp } from "@/lib/rockSculpt";
import { useSurfaceTexture } from "@/lib/surfaceImage";
import { usePlantTexture } from "@/lib/plantTextures";
import { fieldGrid, sampleField } from "@/lib/terrain";
import { useSubstrateTextures } from "@/lib/substrateTextureGen";
import { kelvinToRgb } from "@/lib/lightColor";
import { defaultCameraPosition, tankCenter } from "@/lib/units";
import type {
  CustomMesh,
  FishConfig,
  HardscapeItem,
  Layout,
  LightFixture,
  PlantForm,
  PlantPlacement,
  PlantSpecies,
  SubstrateConfig,
  TankDimensions,
} from "@/lib/types";

// A live, read-only 3D render of a *saved* scape (a Layout), for the gallery.
// Deliberately self-contained — it re-renders from layout props using the same
// pure geometry/material/texture helpers as the editor, but touches NONE of the
// editor store, so showing a preview can never mutate the working scape. Only
// mounted while the tile is on-screen (see LiveTank) so the browser never runs
// out of WebGL contexts.

const FORM_WIDTH: Record<PlantForm, number> = {
  blade: 0.4,
  stem: 0.5,
  rosette: 0.85,
  broadleaf: 0.95,
  moss: 1.2,
  floating: 1.0,
};

const CROSS_GEO: THREE.BufferGeometry = (() => {
  const a = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const b = a.clone().rotateY(Math.PI / 2);
  return mergeGeometries([a, b]) ?? a;
})();

/* ---- substrate (terrain height field or linear ramp) ---- */
function PreviewSubstrate({
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
    const { nx, nz } = fieldGrid(w, d);
    const geo = new THREE.BoxGeometry(innerW, 1, innerD, nx - 1, 1, nz - 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const u = THREE.MathUtils.clamp(x / innerW + 0.5, 0, 1);
        const v = THREE.MathUtils.clamp(0.5 - z / innerD, 0, 1);
        pos.setY(
          i,
          field
            ? sampleField(field, u, v)
            : THREE.MathUtils.lerp(
                substrate.depthFront,
                substrate.depthBack,
                v,
              ),
        );
      } else pos.setY(i, 0);
    }
    geo.computeVertexNormals();
    return geo;
  }, [w, d, innerW, innerD, substrate.depthFront, substrate.depthBack, field]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const tex = useSubstrateTextures(substrate, w, d);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        map={tex.albedo}
        normalMap={tex.normal}
        roughnessMap={tex.roughness}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

/* ---- one hardscape piece (read-only port of HardscapeMesh) ---- */
function PreviewPiece({
  item,
  customMeshes,
  customSurfaces,
}: {
  item: HardscapeItem;
  customMeshes: Record<string, CustomMesh>;
  customSurfaces: Record<string, string>;
}) {
  const material = getMaterial(item.materialId);

  const procGeometry = useMemo(() => {
    if (item.source === "mesh") return null;
    if (item.source === "drift")
      return makeDriftwoodGeometry(item.seed, item.drift ?? DEFAULT_DRIFT);
    const isWood = item.kind === "wood";
    const def = getRockForm(item.form ?? material?.form);
    const raw = makeRockGeometry(item.seed, {
      primitive: def.primitive,
      jaggedness:
        item.jaggedness ?? material?.jaggedness ?? (isWood ? 0.22 : def.jaggedness),
      detail:
        item.source === "sculpt" ? item.detail ?? 4 : item.detail ?? (isWood ? 1 : def.detail),
      shape: item.shape ?? material?.shape ?? def.shape,
      taper: item.taper ?? def.taper,
      flat: item.flat ?? def.flat,
      tilt: item.tilt ?? 0,
      veinColor: item.veinColor ?? material?.veinColor,
      strata: item.strata ?? material?.strata ?? def.strata,
      pitting: item.pitting ?? def.pitting,
      pitScale: item.pitScale ?? def.pitScale,
    });
    // Sculpted piece: weld to the same base the editor uses, then add the stored
    // displacement → the saved shape renders faithfully in the gallery.
    if (item.source === "sculpt") {
      const geo = mergeVertices(raw);
      raw.dispose();
      geo.computeVertexNormals();
      if (item.sculptD) {
        const pos = geo.attributes.position.array as Float32Array;
        const base = pos.slice();
        const disp = decodeDisp(item.sculptD, base.length / 3);
        for (let i = 0; i < pos.length; i++) pos[i] = base[i] + disp[i];
        geo.attributes.position.needsUpdate = true;
        geo.computeVertexNormals();
      }
      return geo;
    }
    return raw;
  }, [item, material]);
  useEffect(() => () => procGeometry?.dispose(), [procGeometry]);

  // mesh source → rebuild from the layout's stored height PNG
  const customHeight =
    item.source === "mesh" && item.meshId
      ? customMeshes[item.meshId]?.height
      : undefined;
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

  const textureId = item.textureId ?? material?.textureId;
  const isCustomTex = !!textureId && textureId.startsWith("custom:");
  const customTex = useSurfaceTexture(
    isCustomTex ? customSurfaces[textureId!] : undefined,
  );
  const surface = isCustomTex ? undefined : getSurface(textureId ?? "");
  const hasTex = isCustomTex ? !!customTex : !!surface;
  const color = item.color ?? (hasTex ? "#ffffff" : material?.color ?? "#7a7a7a");
  const roughness = item.roughness ?? material?.roughness ?? 0.9;

  if (!geometry) return null;

  return (
    <group position={item.position} rotation={item.rotation} scale={item.scale}>
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
            vertexColors
            flatShading
            side={item.source === "sculpt" ? THREE.DoubleSide : THREE.FrontSide}
          />
        )}
      </mesh>
    </group>
  );
}

/* ---- one plant patch (read-only port of Patch) ---- */
function PreviewPatch({
  placement,
  dims,
  growth,
  underwater,
  customTex,
  customSpecies,
  worldOffset,
}: {
  placement: PlantPlacement;
  dims: TankDimensions;
  growth: number;
  underwater: boolean;
  customTex?: string;
  customSpecies?: PlantSpecies;
  /** world-space [x,y,z] the scape group is translated to (showroom cabinets) so
   *  the world-space glass clip planes track the tank instead of the origin. */
  worldOffset: [number, number, number];
}) {
  const species = getSpecies(placement.speciesId) ?? customSpecies;
  const url = customTex ?? species?.texture;
  const texture = usePlantTexture(species?.form ?? "blade", url);
  const hasImage = !!url;
  const img = texture.image as { width?: number; height?: number } | undefined;
  const aspect = hasImage && img?.width && img?.height ? img.width / img.height : null;
  const widthRatio = aspect ?? FORM_WIDTH[species?.form ?? "blade"];
  const userScale = placement.scale ?? 1;
  const baseWorldY = placement.position[1];
  const ref = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const [ox, oy, oz] = worldOffset;
  const clipPlanes = useMemo(
    () => [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), dims.width / 2 + ox),
      new THREE.Plane(new THREE.Vector3(1, 0, 0), dims.width / 2 - ox),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), dims.depth / 2 + oz),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), dims.depth / 2 - oz),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), dims.height + oy),
    ],
    [dims.width, dims.depth, dims.height, ox, oy, oz],
  );

  const blades = useMemo(() => {
    // Mirror the editor's botanical character (Part F) so previews grow like
    // the real scape: see Plants.tsx / lib/plantHabit.ts.
    const [minH, maxH] = species?.heightCm ?? [4, 8];
    const youngH = minH * 0.55;
    const h = species
      ? plantHabit(species)
      : { anchor: "substrate" as const, heightGain: 0.9, fullnessGain: 0.6, leafScalesWithHeight: true, leafGain: 0.1, rateScalar: 0.8 };
    const g = growth * h.rateScalar;
    const targetH = Math.min(
      (youngH + (maxH - youngH) * h.heightGain * g) * userScale,
      maxH * userScale,
    );
    const waterline = dims.height * 0.96;
    const surface = h.anchor === "surface";
    const capAt = (y: number) => Math.max(2, waterline - y);
    // Leaf size decoupled from height (mirror Plants.tsx / lib/plantHabit.ts).
    const leafYoung = Math.max(youngH, minH) * userScale;
    const leaf = leafYoung * (1 + h.leafGain * g);
    const widthOf = (_hh: number) => leaf;
    const src = placement.blades ?? [];
    const visible = Math.max(
      5,
      Math.round((src.length || 12) * (0.5 + 0.5 * growth * h.fullnessGain)),
    );
    if (src.length)
      return src.slice(0, visible).map((b) => {
        const hh = Math.min(targetH * b.hMul, capAt(surface ? waterline : b.y));
        return {
          x: b.x,
          z: b.z,
          baseY: (surface ? waterline : b.y) - baseWorldY,
          h: hh,
          w: widthOf(hh),
          yaw: b.yaw,
          lean: b.lean,
          tint: 0.58 + Math.abs(Math.sin(b.x * 12.9 + b.z * 4.7)) * 0.17,
        };
      });
    // legacy flat scatter
    return Array.from({ length: 12 }, (_, i) => {
      const hh = Math.min(targetH, capAt(surface ? waterline : baseWorldY));
      return {
        x: Math.cos(i) * placement.radius * 0.5,
        z: Math.sin(i * 1.7) * placement.radius * 0.5,
        baseY: surface ? waterline - baseWorldY : 0,
        h: hh,
        w: widthOf(hh),
        yaw: i,
        lean: 0,
        tint: 0.7,
      };
    });
  }, [placement, species, growth, userScale, baseWorldY, dims.height]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();
    blades.forEach((b, i) => {
      e.set(b.lean, b.yaw, b.lean * 0.5);
      q.setFromEuler(e);
      pos.set(b.x, b.baseY, b.z);
      scl.set(b.w * widthRatio, b.h, b.w * widthRatio);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, col.setScalar(b.tint));
    });
    mesh.count = blades.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [blades, widthRatio]);

  useFrame((state) => {
    if (!underwater || !groupRef.current) return;
    groupRef.current.rotation.z =
      Math.sin(state.clock.elapsedTime * 0.8 + placement.position[0] * 0.1) * 0.05;
  });

  return (
    <group ref={groupRef} position={placement.position}>
      <instancedMesh key={blades.length} ref={ref} args={[CROSS_GEO, undefined, Math.max(1, blades.length)]}>
        <meshStandardMaterial
          map={texture}
          color={hasImage ? "#a6a6a6" : species?.color ?? "#4f9a3f"}
          emissiveMap={hasImage ? texture : undefined}
          emissive={hasImage ? "#ffffff" : "#000000"}
          emissiveIntensity={hasImage ? 0.14 : 0}
          side={THREE.DoubleSide}
          alphaTest={0.5}
          roughness={hasImage ? 0.82 : 0.95}
          metalness={0}
          clippingPlanes={clipPlanes}
        />
      </instancedMesh>
    </group>
  );
}

/* ---- lights from the saved rig ---- */
export function PreviewLights({
  lights,
  dims,
  underwater,
  ambient = true,
}: {
  lights: LightFixture[];
  dims: TankDimensions;
  underwater: boolean;
  /** Include the global ambient/hemisphere fill. Off for per-tank rigs in the
   *  showroom (the room provides one fill; N tank fills would wash it out). */
  ambient?: boolean;
}) {
  // Flooded gallery scapes read darker than the editor's design view; lift the
  // underwater dim + fill so tiles/showroom are as fresh as the editor.
  const uw = underwater ? 0.85 : 1;
  return (
    <>
      {ambient && (
        <>
          <ambientLight intensity={underwater ? 0.42 : 0.35} />
          <hemisphereLight
            intensity={underwater ? 0.48 : 0.4}
            color={underwater ? "#cfeffb" : "#ffffff"}
            groundColor={underwater ? "#15303a" : "#cdbfae"}
          />
        </>
      )}
      {lights
        .filter((l) => l.on)
        .map((l) => {
          const color =
            l.type === "rgb" ? new THREE.Color(l.color) : kelvinToRgb(l.kelvin);
          const base = l.type === "spot" ? 2.2 : l.type === "rgb" ? 1.4 : 1.6;
          return (
            <pointLight
              key={l.id}
              position={[l.x, dims.height + l.height, l.z]}
              intensity={base * l.intensity * uw * 1.6}
              decay={0}
              color={color}
            />
          );
        })}
    </>
  );
}

/**
 * The scape's scene graph (glass, substrate, hardscape, plants, water tint) with
 * its tank floor at local y=0 — no lights, no camera, no rotation. Drop it into
 * any scene (a preview tile, or the 3D showroom room) and position the parent.
 */
export function ScapeContent({
  layout,
  underwater: underwaterOverride,
  fish,
  worldOffset = [0, 0, 0],
}: {
  layout: Layout;
  /** Force the flooded look regardless of the saved view mode (gallery showroom). */
  underwater?: boolean;
  /** Render swimming fish with this config (gallery showroom). */
  fish?: FishConfig | null;
  /** World-space translation of this scape (showroom cabinets); shifts the plant
   *  glass clip planes so they track the tank, not the origin. Default origin. */
  worldOffset?: [number, number, number];
}) {
  const dims = layout.tank;
  const underwater = underwaterOverride ?? layout.mode === "underwater";
  const growth = layout.growth ?? 0.25;
  const customMeshes = layout.customMeshes ?? {};
  const customSurfaces = layout.customSurfaces ?? {};
  const customPlantTextures = layout.customPlantTextures ?? {};
  const customPlants = layout.customPlants ?? [];
  return (
    <group>
      {/* the same backdrop (backlit / gradient / solid) the scape was designed
          with — the bright backlit panel is the ADA-gallery "white glow" look */}
      {layout.background && (
        <BackdropPanel background={layout.background} dims={dims} />
      )}
      <GlassTank dims={dims} />
      <PreviewSubstrate dims={dims} substrate={layout.substrate} />
      {layout.hardscape.map((item) => (
        <PreviewPiece
          key={item.id}
          item={item}
          customMeshes={customMeshes}
          customSurfaces={customSurfaces}
        />
      ))}
      {layout.plants.map((p) => (
        <PreviewPatch
          key={p.id}
          placement={p}
          dims={dims}
          growth={growth}
          underwater={underwater}
          customTex={customPlantTextures[p.speciesId]}
          customSpecies={customPlants.find((c) => c.id === p.speciesId)}
          worldOffset={worldOffset}
        />
      ))}
      {underwater && fish && fish.count > 0 && (
        <Fish dims={dims} substrate={layout.substrate} fish={fish} />
      )}
      {underwater && (
        <mesh position={[0, dims.height / 2, 0]}>
          <boxGeometry args={[dims.width, dims.height, dims.depth]} />
          {/* light, clear water — a pale cyan veil, not a dark tint */}
          <meshBasicMaterial color="#bfeefa" transparent opacity={0.05} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/* ---- the static scene (grid tile) ---- */
function Scape({ layout }: { layout: Layout }) {
  const dims = layout.tank;
  const underwater = layout.mode === "underwater";
  const lights = layout.lights ?? [];

  return (
    <>
      <PreviewLights lights={lights} dims={dims} underwater={underwater} />
      <ScapeContent layout={layout} />
    </>
  );
}

/**
 * Live 3D tile for a saved scape. Renders only while on-screen (Intersection
 * Observer); off-screen it shows the captured thumbnail so dozens of tiles never
 * exhaust WebGL contexts. The canvas is pointer-transparent so the parent tile
 * still handles the click-to-open.
 */
export function LiveTank({
  layout,
  thumb,
  alt,
}: {
  layout: Layout;
  thumb: string;
  alt: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="absolute inset-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumb} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      {visible && (
        <Canvas
          className="!absolute inset-0"
          style={{ pointerEvents: "none" }}
          dpr={[1, 1.5]}
          gl={{ antialias: true }}
          camera={{ position: defaultCameraPosition(layout.tank), fov: 40, near: 1, far: 6000 }}
          onCreated={({ camera, gl }) => {
            const c = tankCenter(layout.tank);
            camera.lookAt(c[0], c[1], c[2]);
            gl.localClippingEnabled = true;
            gl.setClearColor("#ffffff", 1); // white tile background
          }}
        >
          <Scape layout={layout} />
        </Canvas>
      )}
    </div>
  );
}
