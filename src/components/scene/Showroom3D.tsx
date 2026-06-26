"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, MeshReflectorMaterial } from "@react-three/drei";
import { ScapeContent, PreviewLights } from "./LiveTank";
import type { SavedScape } from "@/store/useLibraryStore";

// A single navigable 3D gallery ROOM (one WebGL canvas) — the saved scapes are
// placed as real tanks on cabinets along the back wall of a dim showroom, each
// running live and lit from above. Free-look with the mouse: drag to look,
// right-drag (or two-finger) to move through the room, scroll to walk in/out,
// click a tank to open it. Replaces the old CSS "showroom" of flat tiles.

const CAB_H = 75; // cabinet height (cm)
const GAP = 36; // gap between tanks (cm)

interface Placed {
  scape: SavedScape;
  cx: number; // center x (cm), row centered on 0
  w: number;
  d: number;
  h: number;
}

function layoutRow(scapes: SavedScape[]): { placed: Placed[]; total: number } {
  let x = 0;
  const placed = scapes.map((scape) => {
    const t = scape.layout.tank;
    const cx = x + t.width / 2;
    x += t.width + GAP;
    return { scape, cx, w: t.width, d: t.depth, h: t.height };
  });
  const total = Math.max(0, x - GAP);
  placed.forEach((p) => (p.cx -= total / 2)); // center the row on x=0
  return { placed, total };
}

function Exhibit({
  item,
  zRow,
  active,
  onOpen,
  onHover,
}: {
  item: Placed;
  zRow: number;
  active: boolean;
  onOpen: () => void;
  onHover: (name: string | null) => void;
}) {
  const { scape, cx, w, d, h } = item;
  return (
    <group
      position={[cx, 0, zRow]}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
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
      {/* cabinet / plinth — matte charcoal with two recessed door panels */}
      <mesh position={[0, CAB_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w + 8, CAB_H, d + 8]} />
        <meshStandardMaterial color={active ? "#243024" : "#202327"} roughness={0.85} metalness={0.12} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 4), CAB_H / 2, (d + 8) / 2 + 0.3]}>
          <planeGeometry args={[w / 2 - 6, CAB_H - 10]} />
          <meshStandardMaterial color="#191c20" roughness={0.7} metalness={0.15} />
        </mesh>
      ))}

      {/* the live tank, sitting on the cabinet top — flooded + lit by its own
          saved light rig, with its own fish swimming */}
      <group position={[0, CAB_H, 0]}>
        <PreviewLights
          lights={scape.layout.lights ?? []}
          dims={scape.layout.tank}
          underwater
          ambient={false}
        />
        <ScapeContent layout={scape.layout} underwater fish={scape.layout.fish} />
      </group>

      {/* cyan glass-edge glow — the signature rimless-tank look (emissive frame
          around the top rim of the glass) */}
      {[0, h].map((y) => (
        <mesh key={y} position={[0, CAB_H + y, 0]}>
          <boxGeometry args={[w + 0.6, 0.8, d + 0.6]} />
          <meshBasicMaterial color="#56e6ff" />
        </mesh>
      ))}

      {/* suspended pendant fixture (cables + slim LED bar) over the tank */}
      <group position={[0, CAB_H + h + 38, 0]}>
        {[-w * 0.28, w * 0.28].map((cxx) => (
          <mesh key={cxx} position={[cxx, 30, 0]}>
            <cylinderGeometry args={[0.4, 0.4, 60, 6]} />
            <meshBasicMaterial color="#2a2d31" />
          </mesh>
        ))}
        <mesh>
          <boxGeometry args={[Math.min(w * 0.85, w - 6), 5, 12]} />
          <meshStandardMaterial color="#16181c" roughness={0.5} metalness={0.4} />
        </mesh>
        {/* glowing emitter underside */}
        <mesh position={[0, -2.6, 0]}>
          <boxGeometry args={[Math.min(w * 0.85, w - 6) - 3, 0.6, 9]} />
          <meshBasicMaterial color="#f2f8ff" />
        </mesh>
      </group>

      {active && (
        <mesh position={[0, CAB_H + h + 16, d / 2 + 1]}>
          <planeGeometry args={[w, 6]} />
          <meshBasicMaterial color="#97b06f" />
        </mesh>
      )}
    </group>
  );
}

function Room({
  width,
  depth,
  height,
  zRow,
  rowW,
}: {
  width: number;
  depth: number;
  height: number;
  zRow: number;
  rowW: number;
}) {
  const zBack = zRow - 90; // back wall just behind the cabinet row
  return (
    <group>
      {/* polished concrete floor — light grey, glossy, reflecting the tanks +
          ceiling strips as long streaks (the gallery floor) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <MeshReflectorMaterial
          resolution={1024}
          blur={[200, 80]}
          mixBlur={0.9}
          mixStrength={1.1}
          mirror={0.55}
          color="#2c3034"
          metalness={0.5}
          roughness={0.62}
        />
      </mesh>
      {/* walls + ceiling — matte cool charcoal, near-black so tanks pop */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#191c20" roughness={0.97} side={THREE.BackSide} />
      </mesh>

      {/* the bright WHITE backlit band behind the row — tanks silhouette against
          it (the defining ADA-gallery glow). Charcoal wall above/below. */}
      <mesh position={[0, CAB_H + 55, zBack]}>
        <planeGeometry args={[rowW + 120, 150]} />
        <meshBasicMaterial color="#eef3f7" />
      </mesh>
      {/* wall-wash so the white band spills cool light onto cabinets + floor */}
      <pointLight position={[0, CAB_H + 60, zBack + 40]} intensity={0.9} distance={Math.max(900, rowW)} decay={0} color="#dfeaf4" />

      {/* long ceiling light strips running down the row → streak on the floor */}
      {[-width * 0.16, width * 0.16].map((x, i) => (
        <mesh key={i} position={[x, height - 1, zRow + depth * 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[28, depth * 0.7]} />
          <meshBasicMaterial color="#eef4fb" />
        </mesh>
      ))}
    </group>
  );
}

// Saved scapes also hang as framed prints on the upper wall — the gallery wall
// of contest photos (see reference). Reuses each scape's thumbnail as the art.
function FramedPrint({
  url,
  position,
  w,
}: {
  url: string;
  position: [number, number, number];
  w: number;
}) {
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [url]);
  useEffect(() => () => tex.dispose(), [tex]);
  const h = w * 0.72;
  return (
    <group position={position}>
      {/* frame */}
      <mesh position={[0, 0, -0.5]}>
        <boxGeometry args={[w + 6, h + 6, 1]} />
        <meshStandardMaterial color="#0c0d0f" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* print */}
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

// Simple dark lounge seating in the middle of the room (boxes) — the leather
// benches + glass coffee table of a real gallery viewing lounge, for ambiance.
function Lounge({ z }: { z: number }) {
  const seat = "#101216";
  return (
    <group position={[0, 0, z]}>
      {/* two long benches facing the tanks */}
      {[-40, 95].map((bz, i) => (
        <group key={i} position={[0, 0, bz]}>
          <mesh position={[0, 18, 0]} castShadow receiveShadow>
            <boxGeometry args={[260, 28, 55]} />
            <meshStandardMaterial color={seat} roughness={0.5} metalness={0.05} />
          </mesh>
          {/* tufted-ish cushion sheen strip */}
          <mesh position={[0, 33, 0]}>
            <boxGeometry args={[256, 4, 52]} />
            <meshStandardMaterial color="#16191e" roughness={0.35} metalness={0.1} />
          </mesh>
        </group>
      ))}
      {/* glass coffee table */}
      <mesh position={[0, 22, 28]}>
        <boxGeometry args={[120, 2, 60]} />
        <meshPhysicalMaterial color="#cfe3ea" transparent opacity={0.25} roughness={0.05} metalness={0} />
      </mesh>
      {[[-52, 12], [52, 12], [-52, 44], [52, 44]].map(([x, dz], i) => (
        <mesh key={i} position={[x, 11, dz]}>
          <boxGeometry args={[3, 22, 3]} />
          <meshStandardMaterial color="#0c0d0f" roughness={0.4} metalness={0.3} />
        </mesh>
      ))}
    </group>
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
  const [hovered, setHovered] = useState<string | null>(null);
  const { placed, total } = useMemo(() => layoutRow(scapes), [scapes]);

  const roomW = total + 460;
  const roomD = 560;
  const roomH = 300;
  const zRow = -roomD / 2 + 120; // tanks near the back wall
  const target: [number, number, number] = [0, CAB_H + 30, zRow];

  return (
    <div className="relative flex-1 overflow-hidden bg-[#0a0b0c]">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true }}
        camera={{ position: [0, 150, zRow + 360], fov: 45, near: 1, far: 8000 }}
        onCreated={({ gl }) => gl.setClearColor("#0d0f12", 1)}
      >
        {/* cool, dim gallery fill — clean daylight, tanks glow bright against the
            dark charcoal room (ADA Nature Aquarium Gallery). Fog deepens the far
            end of the row. */}
        <fog attach="fog" args={["#0d0f12", 340, 1800]} />
        <ambientLight intensity={0.26} color="#e8f0f8" />
        <hemisphereLight intensity={0.34} color="#dfeaf6" groundColor="#0d0f12" />
        <directionalLight position={[roomW * 0.2, roomH, zRow + 260]} intensity={0.35} color="#eaf2fb" />
        {/* soft neutral fill from the ceiling line so the room reads */}
        <pointLight position={[-roomW * 0.18, roomH - 30, zRow + 300]} intensity={0.4} distance={900} decay={0} color="#e6eef8" />
        <pointLight position={[roomW * 0.18, roomH - 30, zRow + 300]} intensity={0.4} distance={900} decay={0} color="#e6eef8" />

        <Room width={roomW} depth={roomD} height={roomH} zRow={zRow} rowW={total} />
        <Lounge z={zRow + 230} />

        {/* framed scape prints on the upper back wall, above the white band */}
        {placed.map((p) => (
          <FramedPrint
            key={`fr-${p.scape.id}`}
            url={p.scape.thumb}
            position={[p.cx, CAB_H + 185, zRow - 88]}
            w={Math.min(p.w * 0.7, 90)}
          />
        ))}

        {placed.map((p) => (
          <Exhibit
            key={p.scape.id}
            item={p}
            zRow={zRow}
            active={p.scape.id === currentId}
            onOpen={() => onOpen(p.scape.id)}
            onHover={setHovered}
          />
        ))}

        <OrbitControls
          makeDefault
          target={target}
          enablePan
          enableDamping
          dampingFactor={0.08}
          minDistance={70}
          maxDistance={Math.max(700, roomW)}
          maxPolarAngle={Math.PI / 2 - 0.04}
        />
      </Canvas>

      {/* museum label of the tank under the cursor */}
      {hovered && (
        <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-md bg-sumi/85 px-3 py-1.5 text-sm text-mist shadow-lg backdrop-blur">
          {hovered}
        </div>
      )}

      {/* navigation hint */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-sumi/70 px-4 py-1.5 text-[11px] text-stone/90 backdrop-blur">
        Drag to look · right-drag to move · scroll to zoom · click a tank to open
      </div>
    </div>
  );
}
