"use client";

import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  CameraControls,
  Environment,
  Lightformer,
  MeshReflectorMaterial,
  ContactShadows,
  Sparkles,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  ToneMapping,
} from "@react-three/postprocessing";
import { ScapeContent, PreviewLights } from "./LiveTank";
import type { SavedScape } from "@/store/useLibraryStore";

// A premium ADA-style Nature Aquarium GALLERY in one WebGL canvas. The saved
// scapes are treated as museum pieces: rimless tanks on identical matte cabinets,
// aligned along a long off-white hall over a polished-concrete reflector floor,
// each under its own suspended pendant. The room stays dark; the aquariums are
// the brightest objects and brighten further as the camera approaches. Move with
// damped, cinematic CameraControls (museum walk, not orbit); click a tank — or
// flip on Showcase — to glide to it. Replaces the old "room with aquariums" feel.

const lerp = THREE.MathUtils.lerp;
const CAB_H = 72; // cabinet height (cm) — identical for every exhibit
const GAP = 78; // generous negative space between tanks (cm)
const SHOWCASE_MS = 17000;

interface Exhibit {
  scape: SavedScape;
  pos: [number, number, number]; // group origin (floor, tank centre x/z)
  tank: { width: number; height: number; depth: number };
  hero: boolean;
  /** camera fly-to waypoint when this exhibit is featured. */
  camPos: [number, number, number];
  lookAt: [number, number, number];
}

/* ---------------- layout: aligned row + one hero centrepiece ---------------- */
function buildExhibits(scapes: SavedScape[], zRow: number): Exhibit[] {
  const vol = (s: SavedScape) =>
    s.layout.tank.width * s.layout.tank.height * s.layout.tank.depth;
  // one freestanding showcase centrepiece once the gallery is big enough
  const heroIdx = scapes.length >= 5 ? scapes.indexOf([...scapes].sort((a, b) => vol(b) - vol(a))[0]) : -1;

  const row = scapes.filter((_, i) => i !== heroIdx);
  const widths = row.map((s) => s.layout.tank.width);
  const rowW = widths.reduce((a, w) => a + w, 0) + GAP * Math.max(0, row.length - 1);

  const waypoint = (t: SavedScape["layout"]["tank"], cx: number, cz: number) => {
    const dist = t.depth / 2 + Math.max(t.width, t.height) * 1.2 + 64;
    return {
      camPos: [cx, CAB_H + t.height * 0.55, cz + dist] as [number, number, number],
      lookAt: [cx, CAB_H + t.height * 0.44, cz] as [number, number, number],
    };
  };

  const out: Exhibit[] = [];
  let x = -rowW / 2;
  for (const scape of row) {
    const t = scape.layout.tank;
    const cx = x + t.width / 2;
    out.push({ scape, pos: [cx, 0, zRow], tank: t, hero: false, ...waypoint(t, cx, zRow) });
    x += t.width + GAP;
  }
  if (heroIdx >= 0) {
    const scape = scapes[heroIdx];
    const t = scape.layout.tank;
    const cz = zRow + 280; // pulled forward into the hall as the centrepiece
    out.push({ scape, pos: [0, 0, cz], tank: t, hero: true, ...waypoint(t, 0, cz) });
  }
  return out;
}

/* ---------------- one exhibit: cabinet · tank · pendant ---------------- */
function ExhibitView({
  ex,
  onSelect,
  onHover,
}: {
  ex: Exhibit;
  onSelect: () => void;
  onHover: (name: string | null) => void;
}) {
  const { scape, tank: t } = ex;
  const w = t.width;
  const h = t.height;
  const d = t.depth;

  const fill = useRef<THREE.PointLight>(null); // upper-front cool fill
  const fill2 = useRef<THREE.PointLight>(null); // lower-front warm fill (scape base)
  const emitter = useRef<THREE.MeshStandardMaterial>(null);

  // The fills are always on (so plants + hardscape read even from across the
  // hall) and lift further on approach. No overhead down-light — the scape lights
  // itself from the front. Faint flicker on the decorative pendant bar.
  useFrame(({ camera, clock }) => {
    const dist = Math.hypot(camera.position.x - ex.pos[0], camera.position.z - ex.pos[2]);
    const near = THREE.MathUtils.clamp(1 - (dist - w * 1.4) / (w * 4), 0, 1); // 1 close → 0 far
    const flick = 0.97 + Math.sin(clock.elapsedTime * 11 + ex.pos[0]) * 0.012 + Math.sin(clock.elapsedTime * 2.3) * 0.018;
    if (fill.current) fill.current.intensity = lerp(fill.current.intensity, (1.5 + near * 1.4) * flick, 0.05);
    if (fill2.current) fill2.current.intensity = lerp(fill2.current.intensity, (1.0 + near * 0.9) * flick, 0.05);
    if (emitter.current) emitter.current.emissiveIntensity = lerp(emitter.current.emissiveIntensity, (0.7 + near * 0.9) * flick, 0.05);
  });

  const pendantY = h + 44;
  const barLen = Math.min(w * 0.85, w - 6);

  return (
    <group
      position={ex.pos}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(scape.name);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = "auto";
      }}
    >
      {/* cabinet — identical-height matte charcoal plinth with recessed doors */}
      <mesh position={[0, CAB_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w + 10, CAB_H, d + 10]} />
        <meshStandardMaterial color="#1e2125" roughness={0.55} metalness={0.18} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 4), CAB_H / 2 - 2, (d + 10) / 2 + 0.2]}>
          <planeGeometry args={[w / 2 - 7, CAB_H - 14]} />
          <meshStandardMaterial color="#16181b" roughness={0.5} metalness={0.22} />
        </mesh>
      ))}
      {/* thin brushed-alloy trim where glass meets cabinet */}
      <mesh position={[0, CAB_H + 0.6, 0]}>
        <boxGeometry args={[w + 11, 1.4, d + 11]} />
        <meshStandardMaterial color="#3a3d42" roughness={0.3} metalness={0.85} />
      </mesh>

      {/* the live, flooded scape on the cabinet top, lit by its own saved rig */}
      <group position={[0, CAB_H, 0]}>
        <PreviewLights lights={scape.layout.lights ?? []} dims={t} underwater ambient={false} />
        {/* localized "ambient" for this scape — soft fills from the camera side
            that light the plant faces + hardscape (always on; distance-limited so
            they don't wash the dark room). Upper cool + lower warm = even read. */}
        <pointLight ref={fill} position={[0, h * 0.62, d * 0.55 + 18]} intensity={1.5} distance={Math.max(200, w * 2.6)} decay={1.6} color="#eef4ff" />
        <pointLight ref={fill2} position={[0, h * 0.16, d * 0.5 + 10]} intensity={1.0} distance={Math.max(160, w * 2)} decay={1.7} color="#f4efe6" />
        <ScapeContent layout={scape.layout} underwater fish={scape.layout.fish} worldOffset={[ex.pos[0], CAB_H, ex.pos[2]]} />
      </group>

      {/* suspended pendant: near-invisible cables + slim anodized bar + emitter */}
      <group position={[0, CAB_H + pendantY, 0]}>
        {[-barLen * 0.34, barLen * 0.34].map((cx) => (
          <mesh key={cx} position={[cx, 26, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 52, 5]} />
            <meshStandardMaterial color="#3a3d42" roughness={0.4} metalness={0.6} transparent opacity={0.5} />
          </mesh>
        ))}
        <mesh castShadow>
          <boxGeometry args={[barLen, 5, 13]} />
          {/* premium anodized aluminium */}
          <meshStandardMaterial color="#26282c" roughness={0.28} metalness={0.92} />
        </mesh>
        <mesh position={[0, -2.7, 0]}>
          <boxGeometry args={[barLen - 4, 0.7, 9]} />
          <meshStandardMaterial ref={emitter} color="#f3f8ff" emissive="#eaf4ff" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------- the gallery shell ---------------- */
function Room({ width, depth, height, zWall, zRow, rowW }: { width: number; depth: number; height: number; zWall: number; zRow: number; rowW: number }) {
  const wall = "#c9c6bf"; // matte off-white
  return (
    <group>
      {/* polished-concrete floor — reflects the lit tanks + ceiling strips */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <MeshReflectorMaterial
          resolution={1024}
          mixBlur={1}
          mixStrength={1.4}
          blur={[300, 90]}
          mirror={0.42}
          color="#b9b6b1"
          roughness={0.72}
          metalness={0.18}
          depthScale={0.6}
        />
      </mesh>
      {/* off-white shell (single inverted box) — dim, so it reads as soft grey */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={wall} roughness={0.96} side={THREE.BackSide} />
      </mesh>
      {/* subtle plinth/base shadow line along the back wall */}
      <mesh position={[0, 0.2, zWall + 1]}>
        <planeGeometry args={[width, 2]} />
        <meshBasicMaterial color="#9a978f" />
      </mesh>
      {/* minimal ceiling: long recessed light strips → streak reflections below */}
      {[-width * 0.22, 0, width * 0.22].map((x, i) => (
        <mesh key={i} position={[x, height - 0.6, zRow + depth * 0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[16, depth * 0.78]} />
          <meshBasicMaterial color="#eef4fb" toneMapped={false} />
        </mesh>
      ))}
      {/* soft fill from the ceiling line so the off-white shell is just-visible */}
      <pointLight position={[-width * 0.2, height - 20, zRow + depth * 0.1]} intensity={0.5} distance={width * 1.4} decay={1.1} color="#eaf0f7" />
      <pointLight position={[width * 0.2, height - 20, zRow + depth * 0.1]} intensity={0.5} distance={width * 1.4} decay={1.1} color="#eaf0f7" />
    </group>
  );
}

// Framed aquascape prints on the back wall above selected exhibits (curated, not
// every tank). Reuses each scape's saved thumbnail as the artwork.
function FramedPrint({ url, position, w }: { url: string; position: [number, number, number]; w: number }) {
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [url]);
  useEffect(() => () => tex.dispose(), [tex]);
  const h = w * 0.72;
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.4]}>
        <boxGeometry args={[w + 5, h + 5, 1]} />
        <meshStandardMaterial color="#101113" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

// Minimal viewing bench — a single low slab, restrained.
function Bench({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 19, 0]} castShadow receiveShadow>
        <boxGeometry args={[180, 9, 46]} />
        <meshStandardMaterial color="#1a1c1f" roughness={0.45} metalness={0.1} />
      </mesh>
      {[-78, 78].map((x) => (
        <mesh key={x} position={[x, 7.5, 0]}>
          <boxGeometry args={[8, 15, 40]} />
          <meshStandardMaterial color="#0e0f11" roughness={0.4} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

// Procedural studio IBL (Lightformers baked to an env map) — gives glass/metal
// real Fresnel reflections without any external HDRI file (sidesteps the CORS
// asset gotcha). Kept dim so the room stays dark; the tanks still pop.
function GalleryEnv() {
  return (
    <Environment resolution={256} frames={1} background={false}>
      <color attach="background" args={["#0a0b0c"]} />
      <Lightformer intensity={0.5} position={[0, 6, -4]} scale={[12, 4, 1]} color="#dfeaf6" />
      <Lightformer intensity={0.35} position={[-6, 3, 2]} scale={[3, 6, 1]} color="#cfe0f0" />
      <Lightformer intensity={0.35} position={[6, 3, 2]} scale={[3, 6, 1]} color="#cfe0f0" />
      <Lightformer intensity={0.2} position={[0, -3, 4]} scale={[10, 3, 1]} color="#243038" />
    </Environment>
  );
}

function CameraRig({
  controls,
  exhibits,
  selected,
  intro,
}: {
  controls: React.RefObject<ComponentRef<typeof CameraControls> | null>;
  exhibits: Exhibit[];
  selected: number | null;
  intro: { camPos: [number, number, number]; lookAt: [number, number, number] };
}) {
  // one-time establishing shot down the hall
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.setLookAt(...intro.camPos, ...intro.lookAt, false);
    // ponytail: subtle damped inertia comes from CameraControls itself; skip a
    // hand-rolled head-bob — premium reads as stable, add idle drift only if asked.
    c.smoothTime = 0.55;
    c.draggingSmoothTime = 0.18;
    c.dollySpeed = 0.4;
    c.truckSpeed = 1.4;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // glide to the featured exhibit (click or showcase), or back to the hall shot
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const w = selected != null ? exhibits[selected] : null;
    if (w) c.setLookAt(...w.camPos, ...w.lookAt, true);
    else c.setLookAt(...intro.camPos, ...intro.lookAt, true);
  }, [selected, exhibits, intro, controls]);

  return (
    <CameraControls ref={controls} makeDefault minDistance={55} maxDistance={Math.max(900, exhibits.length * 200)} maxPolarAngle={Math.PI / 2 - 0.03} />
  );
}

// Bloom lifts the bright water/emitters; Vignette darkens the edges so the lit
// tanks read as the focal points. No depth-of-field — keep the whole hall sharp.
function Effects() {
  return (
    <EffectComposer enableNormalPass={false} multisampling={2}>
      <Bloom luminanceThreshold={0.62} luminanceSmoothing={0.25} intensity={0.65} mipmapBlur />
      <Vignette eskil={false} offset={0.28} darkness={0.62} />
      <ToneMapping />
    </EffectComposer>
  );
}

export function Showroom3D({
  scapes,
  currentId,
  onOpen,
}: {
  scapes: SavedScape[];
  currentId: string | null;
  onOpen: (id: string) => void;
}) {
  const controls = useRef<ComponentRef<typeof CameraControls> | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [showcase, setShowcase] = useState(false);

  const roomD = 880;
  const zRow = -roomD / 2 + 150;
  const zWall = -roomD / 2 + 8;
  const exhibits = useMemo(() => buildExhibits(scapes, zRow), [scapes, zRow]);
  const rowW = useMemo(() => {
    const xs = exhibits.filter((e) => !e.hero).map((e) => e.pos[0]);
    return xs.length ? Math.max(...xs) - Math.min(...xs) + 200 : 320;
  }, [exhibits]);
  const roomW = Math.max(1000, rowW + 560);
  const roomH = 320;

  const intro = useMemo(
    () => ({
      camPos: [-rowW * 0.16, CAB_H + 96, zRow + 460] as [number, number, number],
      lookAt: [0, CAB_H + 28, zRow] as [number, number, number],
    }),
    [rowW, zRow],
  );

  // Showcase mode: every ~17s one aquarium becomes the featured exhibit and the
  // camera slowly transitions to it — a luxury archviz walkthrough, not a game.
  useEffect(() => {
    if (!showcase || exhibits.length === 0) return;
    setSelected((s) => (s == null ? 0 : s));
    const id = setInterval(() => {
      setSelected((s) => ((s ?? -1) + 1) % exhibits.length);
    }, SHOWCASE_MS);
    return () => clearInterval(id);
  }, [showcase, exhibits.length]);

  const sel = selected != null ? exhibits[selected] : null;

  return (
    <div className="relative flex-1 overflow-hidden bg-[#070809]">
      <Canvas
        shadows
        dpr={[1, 1.6]}
        gl={{ antialias: true, toneMappingExposure: 1.05 }}
        camera={{ position: intro.camPos, fov: 42, near: 1, far: 9000 }}
        onCreated={({ gl }) => {
          gl.setClearColor("#070809", 1);
          gl.localClippingEnabled = true;
        }}
      >
        <fog attach="fog" args={["#070809", 380, 2400]} />
        {/* room stays dark: a whisper of ambient, the tanks supply the light */}
        <ambientLight intensity={0.12} color="#e6eef8" />
        <hemisphereLight intensity={0.18} color="#dfeaf6" groundColor="#0a0b0c" />
        <GalleryEnv />

        <Room width={roomW} depth={roomD} height={roomH} zWall={zWall} zRow={zRow} rowW={rowW} />

        {/* curated prints above every other row exhibit (not the hero) */}
        {exhibits.map((e, i) =>
          !e.hero && i % 2 === 0 ? (
            <FramedPrint key={`fr-${e.scape.id}`} url={e.scape.thumb} position={[e.pos[0], CAB_H + e.tank.height + 96, zWall + 1.2]} w={Math.min(e.tank.width * 0.62, 78)} />
          ) : null,
        )}

        {exhibits.map((e, i) => (
          <ExhibitView key={e.scape.id} ex={e} onSelect={() => setSelected(i)} onHover={setHovered} />
        ))}

        {/* a couple of restrained benches in the open hall */}
        <Bench position={[-rowW * 0.18, 0, zRow + 360]} />
        <Bench position={[rowW * 0.18, 0, zRow + 360]} />

        {/* contact shadows ground the furniture without heavy shadow maps */}
        <ContactShadows position={[0, 0.05, zRow + 180]} scale={roomW * 0.9} blur={3} opacity={0.5} far={120} color="#000000" />

        {/* floating dust motes drifting in the volumetric light */}
        <Sparkles count={90} scale={[roomW * 0.8, roomH * 0.7, roomD * 0.7]} position={[0, roomH * 0.4, zRow + roomD * 0.2]} size={2.2} speed={0.18} opacity={0.35} color="#dfeaf6" />

        <CameraRig controls={controls} exhibits={exhibits} selected={selected} intro={intro} />
        <Effects />
      </Canvas>

      {/* showcase toggle */}
      <button
        onClick={() => {
          setShowcase((v) => !v);
          if (showcase) setSelected(null);
        }}
        className={`absolute right-4 top-4 rounded-full px-4 py-1.5 text-xs font-medium backdrop-blur transition-colors ${
          showcase ? "bg-moss text-sumi" : "bg-sumi/70 text-mist/85 hover:bg-sumi/90"
        }`}
      >
        {showcase ? "■ Stop showcase" : "▶ Showcase mode"}
      </button>

      {/* museum label of the tank under the cursor */}
      {hovered && !sel && (
        <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-md bg-sumi/85 px-3 py-1.5 text-sm tracking-wide text-mist shadow-lg backdrop-blur">
          {hovered}
        </div>
      )}

      {/* selected-exhibit plaque: name + open / step back */}
      {sel && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-mist/10 bg-sumi/85 px-5 py-3 shadow-2xl backdrop-blur">
          <div className="min-w-0">
            <p className="font-display text-base tracking-wide text-mist">{sel.scape.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-stone/70">
              {sel.scape.id === currentId ? "Currently open" : "Featured exhibit"}
            </p>
          </div>
          <button
            onClick={() => onOpen(sel.scape.id)}
            className="rounded-md bg-moss px-3.5 py-1.5 text-xs font-medium text-sumi transition-colors hover:bg-moss-bright"
          >
            Open scape ▸
          </button>
          <button
            onClick={() => {
              setShowcase(false);
              setSelected(null);
            }}
            className="rounded-md border border-mist/15 bg-mist/[0.06] px-3 py-1.5 text-xs text-mist/80 transition-colors hover:bg-mist/[0.12]"
          >
            Step back
          </button>
        </div>
      )}

      {/* navigation hint */}
      {!sel && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-sumi/70 px-4 py-1.5 text-[11px] text-stone/90 backdrop-blur">
          Drag to look · right-drag to walk · scroll to move · click a tank to approach
        </div>
      )}
    </div>
  );
}
