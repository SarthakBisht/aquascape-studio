"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useStudioStore } from "@/store/useStudioStore";
import { getSpecies } from "@/data/plants";
import { usePlantTexture } from "@/lib/plantTextures";
import { hover } from "@/lib/surfaceInteraction";

// Hand-tool cursors shown while planting / trimming directly on the scape:
//  • plant tool → tweezers lowering a translucent "ghost" sprig of the armed
//    species onto the surface, plus a footprint ring (the brush area).
//  • trim tool  → scissors snipping over the canopy, same ring.
// Everything tracks the shared `hover` point imperatively (no React renders) and
// is non-raycastable so it never intercepts the paint stroke beneath it.

const noRay = () => null;
const METAL = { color: "#cdd4dc", metalness: 0.9, roughness: 0.25 } as const;

// One crossed billboard (base at y=0), reused by the plant ghost.
const GHOST_GEO: THREE.BufferGeometry = (() => {
  const a = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const b = a.clone().rotateY(Math.PI / 2);
  return mergeGeometries([a, b]) ?? a;
})();

/** Two prongs that open/close around a hinge — gentle idle "grip". */
function Tweezers() {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  useFrame((s) => {
    const grip = (Math.sin(s.clock.elapsedTime * 2.5) * 0.5 + 0.5) ** 2;
    const spread = 0.18 + grip * 0.18;
    if (left.current) left.current.rotation.z = spread;
    if (right.current) right.current.rotation.z = -spread;
  });
  // Each prong hinges at the top (origin) and hangs down, so only the bottom
  // tips open/close — a pinching V, not an X.
  return (
    <group>
      <group ref={left}>
        <mesh position={[0, -5.5, 0]} raycast={noRay}>
          <boxGeometry args={[0.7, 11, 0.7]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      </group>
      <group ref={right}>
        <mesh position={[0, -5.5, 0]} raycast={noRay}>
          <boxGeometry args={[0.7, 11, 0.7]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      </group>
      <mesh raycast={noRay}>
        <sphereGeometry args={[1.1, 12, 12]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
    </group>
  );
}

/** Two crossed blades + finger rings, snipping on a sine. */
function Scissors() {
  const a = useRef<THREE.Group>(null);
  const b = useRef<THREE.Group>(null);
  useFrame((s) => {
    const snip = Math.abs(Math.sin(s.clock.elapsedTime * 4));
    const open = 0.12 + (1 - snip) * 0.34;
    if (a.current) a.current.rotation.z = open;
    if (b.current) b.current.rotation.z = -open;
  });
  const half = (ref: RefObject<THREE.Group | null>, sgn: number) => (
    <group ref={ref}>
      <mesh position={[sgn * 0.6, 4.5, 0]} raycast={noRay}>
        <boxGeometry args={[0.6, 9, 0.45]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <mesh
        position={[sgn * 1.6, -2.4, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        raycast={noRay}
      >
        <torusGeometry args={[1.7, 0.4, 8, 18]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
    </group>
  );
  return (
    <group>
      {half(a, 1)}
      {half(b, -1)}
      <mesh raycast={noRay}>
        <cylinderGeometry args={[0.7, 0.7, 1.1, 12]} />
        <meshStandardMaterial {...METAL} color="#9aa3ad" />
      </mesh>
    </group>
  );
}

export function PlantTools() {
  const tool = useStudioStore((s) => s.tool);
  const activePlantId = useStudioStore((s) => s.activePlantId);
  const radius = useStudioStore((s) => s.brush.radius);
  const tankHeight = useStudioStore((s) => s.tank.height);
  const customPlants = useStudioStore((s) => s.customPlants);
  const customTex = useStudioStore((s) =>
    activePlantId ? s.customPlantTextures[activePlantId] : undefined,
  );

  const species = activePlantId
    ? (getSpecies(activePlantId) ?? customPlants.find((p) => p.id === activePlantId))
    : undefined;
  const url = customTex ?? species?.texture;
  const texture = usePlantTexture(species?.form ?? "blade", url);
  const hasImage = !!url;

  // Ghost sprig height: a young plant, capped so it never pierces the glass.
  const ghostH = species
    ? Math.min(tankHeight * 0.5, Math.max(4, species.heightCm[0]))
    : 6;
  const ghostW = ghostH * 0.5;

  const group = useRef<THREE.Group>(null);
  const bob = useRef<THREE.Group>(null);
  const planting = tool === "plant" && !!species;
  const trimming = tool === "trim";
  const active = planting || trimming;

  // Drive position/orientation imperatively from the hover point each frame, so
  // the tools glide with the cursor without re-rendering the React tree.
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    g.visible = active && hover.active;
    if (!g.visible) return;
    g.position.set(hover.x, hover.y, hover.z);
    g.rotation.y = Math.atan2(
      state.camera.position.x - hover.x,
      state.camera.position.z - hover.z,
    );
    if (bob.current)
      bob.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.6;
  });

  if (!active) return null;

  return (
    <group ref={group} visible={false}>
      {/* footprint ring — the brush area that will be planted / trimmed */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]} raycast={noRay}>
        <ringGeometry args={[Math.max(0.5, radius - 0.5), radius, 40]} />
        <meshBasicMaterial
          color={planting ? "#8fe388" : "#ffd27a"}
          transparent
          opacity={0.35}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {planting && (
        <group ref={bob}>
          <mesh geometry={GHOST_GEO} scale={[ghostW, ghostH, ghostW]} raycast={noRay}>
            <meshStandardMaterial
              map={texture}
              color={hasImage ? "#ffffff" : (species?.color ?? "#4f9a3f")}
              transparent
              opacity={0.6}
              alphaTest={0.4}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* tweezers gripping the base of the sprig, tilted into the tank */}
          <group position={[2.2, ghostH * 0.32, 1.2]} rotation={[0.35, 0, -0.5]} scale={1.1}>
            <Tweezers />
          </group>
        </group>
      )}

      {trimming && (
        <group position={[1.6, tankHeight * 0.28, 1.2]} rotation={[0.2, 0, 0]}>
          <Scissors />
        </group>
      )}
    </group>
  );
}
