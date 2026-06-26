"use client";

import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Clone, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useStudioStore } from "@/store/useStudioStore";
import { getFishModel } from "@/data/fishModels";
import type {
  FishConfig,
  FishPalette,
  FishPattern,
  SubstrateConfig,
  TankDimensions,
} from "@/lib/types";

// Fish built from primitives but proportioned to read as fish (tapered body,
// caudal + dorsal fins, eyes) with a tail swish. Look & behaviour are
// controlled from the Fish panel: count, size, colour palette, swim pattern
// (schooling / calm / darting / scattered) and speed. Heading-based steering
// curves them off the glass — they never stop or stick in corners.

const PALETTES: Record<FishPalette, string[]> = {
  tropical: ["#e8743b", "#f2c14e", "#5b8def", "#e6e6e6", "#d94f70", "#6ec5b8"],
  neon: ["#46ff8f", "#ff2db3", "#19e0ff", "#fff200", "#ff6a00"],
  natural: ["#9a8c6e", "#bcb4a2", "#6e6a52", "#c2b280", "#8a8270", "#a89878"],
  mono: ["#cdd6da", "#b3bcc0", "#e2e8ea"],
};

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(1, 0, 0);

// reusable temporaries (single-threaded frame loop)
const _force = new THREE.Vector3();
const _c = new THREE.Vector3();
const _a = new THREE.Vector3();
const _s = new THREE.Vector3();
const _tmp = new THREE.Vector3();

interface Boid {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  baseSpeed: number;
  phase: number;
  sizeVar: number;
  colorIndex: number;
  burst: number; // dart timer
}

function Fish3D({
  color,
  tailRef,
}: {
  color: string;
  tailRef: (el: THREE.Group | null) => void;
}) {
  return (
    <group>
      <mesh scale={[2.3, 0.95, 0.62]}>
        <sphereGeometry args={[0.9, 16, 12]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.1} />
      </mesh>
      <mesh position={[0.1, 0.78, 0]} rotation={[0, 0, -0.2]} scale={[1.1, 1, 0.12]}>
        <coneGeometry args={[0.5, 1.0, 3]} />
        <meshStandardMaterial color={color} roughness={0.6} transparent opacity={0.9} />
      </mesh>
      {[0.35, -0.35].map((z) => (
        <mesh key={z} position={[1.45, 0.2, z]}>
          <sphereGeometry args={[0.16, 8, 8]} />
          <meshStandardMaterial color="#10130f" roughness={0.3} />
        </mesh>
      ))}
      <group ref={tailRef} position={[-1.9, 0, 0]}>
        <mesh position={[-0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.16]}>
          <coneGeometry args={[1.1, 1.7, 4]} />
          <meshStandardMaterial color={color} roughness={0.6} transparent opacity={0.92} />
        </mesh>
      </group>
    </group>
  );
}

// Real .glb fish: normalized to a unit length, calibrated by the model's
// scale/rotationY, with a body-yaw wiggle standing in for the tail swish.
function FishModelMesh({
  url,
  scale,
  rotationY,
  phase,
}: {
  url: string;
  scale: number;
  rotationY: number;
  phase: number;
}) {
  const { scene } = useGLTF(url);
  const norm = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    return 1 / (Math.max(size.x, size.y, size.z) || 1);
  }, [scene]);
  const wiggle = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (wiggle.current)
      wiggle.current.rotation.y = Math.sin(state.clock.elapsedTime * 6 + phase) * 0.12;
  });
  return (
    <group ref={wiggle}>
      <group rotation={[0, rotationY, 0]} scale={norm * scale}>
        <Clone object={scene} />
      </group>
    </group>
  );
}

// Per-pattern steering weights.
const PATTERN: Record<
  FishPattern,
  { wander: number; coh: number; align: number; sep: number; speed: number; turn: number }
> = {
  school: { wander: 0.5, coh: 0.9, align: 1.1, sep: 1.6, speed: 1.0, turn: 2.2 },
  calm: { wander: 0.6, coh: 0, align: 0, sep: 0.7, speed: 0.55, turn: 1.2 },
  dart: { wander: 1.4, coh: 0, align: 0.2, sep: 0.8, speed: 1.5, turn: 4.0 },
  scatter: { wander: 0.8, coh: 0, align: 0, sep: 2.4, speed: 0.9, turn: 1.6 },
};

export function Fish({
  dims,
  substrate,
  fish,
}: {
  dims: TankDimensions;
  substrate: SubstrateConfig;
  /** Per-tank fish config (gallery). Omitted ⇒ the editor's live store config. */
  fish?: FishConfig;
}) {
  const storeFish = useStudioStore((s) => s.fish);
  const cfg = fish ?? storeFish;
  // ponytail: no hard cap — count comes from the volume-scaled slider
  // (fishCountLimit). O(n²) boid neighbour loop, fine for low hundreds; add a
  // spatial grid if a giant tank chugs.
  const count = Math.max(0, Math.round(cfg.count));
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const tailRefs = useRef<(THREE.Group | null)[]>([]);

  const bounds = useMemo(() => {
    const m = 4;
    const floor = Math.max(substrate.depthFront, substrate.depthBack) + m;
    return {
      min: new THREE.Vector3(-dims.width / 2 + m, floor, -dims.depth / 2 + m),
      max: new THREE.Vector3(dims.width / 2 - m, dims.height * 0.9, dims.depth / 2 - m),
    };
  }, [dims, substrate]);

  const neighborR = Math.min(dims.width, dims.depth, dims.height) * 0.5;
  const margin = 7;

  const boids = useMemo<Boid[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      pos: new THREE.Vector3(
        THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, Math.random()),
        THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, Math.random()),
        THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, Math.random()),
      ),
      dir: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
      baseSpeed: 9 + Math.random() * 6,
      phase: Math.random() * Math.PI * 2,
      sizeVar: 0.75 + Math.random() * 0.45,
      colorIndex: i,
      burst: Math.random() * 3,
    }));
  }, [count, bounds]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const { min, max } = bounds;
    const w = PATTERN[cfg.pattern];

    boids.forEach((b, i) => {
      _force.set(0, 0, 0);

      // wander
      _force.x += (Math.random() - 0.5) * w.wander;
      _force.y += (Math.random() - 0.5) * w.wander * 0.4;
      _force.z += (Math.random() - 0.5) * w.wander;

      // neighbours (cohesion / alignment / separation)
      if (w.coh > 0 || w.align > 0 || w.sep > 0) {
        _c.set(0, 0, 0);
        _a.set(0, 0, 0);
        _s.set(0, 0, 0);
        let n = 0;
        for (let j = 0; j < boids.length; j++) {
          if (j === i) continue;
          const o = boids[j];
          const d = b.pos.distanceTo(o.pos);
          if (d < neighborR) {
            _c.add(o.pos);
            _a.add(o.dir);
            if (d < neighborR * 0.45 && d > 0.001) {
              _tmp.copy(b.pos).sub(o.pos).divideScalar(d * d);
              _s.add(_tmp);
            }
            n++;
          }
        }
        if (n > 0) {
          if (w.coh > 0) {
            _c.divideScalar(n).sub(b.pos);
            if (_c.lengthSq() > 0) _force.addScaledVector(_c.normalize(), w.coh);
          }
          if (w.align > 0 && _a.lengthSq() > 0)
            _force.addScaledVector(_a.normalize(), w.align);
          if (w.sep > 0 && _s.lengthSq() > 0)
            _force.addScaledVector(_s.normalize(), w.sep);
        }
      }

      // wall avoidance — ramp inward as we near the glass
      if (b.pos.x < min.x + margin) _force.x += (min.x + margin - b.pos.x) / margin * 4;
      if (b.pos.x > max.x - margin) _force.x -= (b.pos.x - (max.x - margin)) / margin * 4;
      if (b.pos.y < min.y + margin) _force.y += (min.y + margin - b.pos.y) / margin * 4;
      if (b.pos.y > max.y - margin) _force.y -= (b.pos.y - (max.y - margin)) / margin * 4;
      if (b.pos.z < min.z + margin) _force.z += (min.z + margin - b.pos.z) / margin * 4;
      if (b.pos.z > max.z - margin) _force.z -= (b.pos.z - (max.z - margin)) / margin * 4;

      // darting: occasional speed burst
      let speedMul = w.speed;
      if (cfg.pattern === "dart") {
        b.burst -= dt;
        if (b.burst <= 0) {
          b.burst = 1.5 + Math.random() * 3;
          _force.x += (Math.random() - 0.5) * 6;
          _force.z += (Math.random() - 0.5) * 6;
        }
        speedMul *= b.burst < 0.5 ? 2.2 : 1;
      }

      b.dir.addScaledVector(_force, dt * w.turn);
      b.dir.y = THREE.MathUtils.clamp(b.dir.y, -0.35, 0.35);
      b.dir.normalize();

      const speed = b.baseSpeed * cfg.speed * speedMul;
      b.pos.addScaledVector(b.dir, speed * dt);
      b.pos.clamp(min, max);

      const g = groupRefs.current[i];
      if (g) {
        g.position.copy(b.pos);
        g.quaternion.setFromUnitVectors(FORWARD, b.dir);
      }
      const tail = tailRefs.current[i];
      if (tail) tail.rotation.y = Math.sin(t * (6 + speed * 0.5) + b.phase) * 0.55;
    });
  });

  const colors = PALETTES[cfg.palette];
  const model = getFishModel(cfg.modelId);

  return (
    <group>
      {boids.map((b, i) => (
        <group
          key={i}
          ref={(el) => {
            groupRefs.current[i] = el;
          }}
          scale={b.sizeVar * cfg.size}
        >
          {model ? (
            // ponytail: model uses its own materials → palette tint is ignored.
            <Suspense fallback={null}>
              <FishModelMesh
                url={model.model}
                scale={model.scale ?? 3}
                rotationY={model.rotationY ?? 0}
                phase={b.phase}
              />
            </Suspense>
          ) : (
            <Fish3D
              color={colors[b.colorIndex % colors.length]}
              tailRef={(el) => {
                tailRefs.current[i] = el;
              }}
            />
          )}
        </group>
      ))}
    </group>
  );
}
