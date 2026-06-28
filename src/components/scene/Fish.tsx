"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Clone, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useStudioStore } from "@/store/useStudioStore";
import { getFishModel } from "@/data/fishModels";
import { pointer, food, getFoodEpoch } from "@/lib/fishInteraction";
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

// Feed / follow seek tuning.
const SEEK = 5; // attraction force toward food / cursor (overrides wander+flock)
const EAT_R = 2.5; // cm — within this a participating fish "eats" a pellet
const SCARE = 7; // flee force when the cursor passes near a fish (idle mode)
const SCARE_R = 16; // cm — cursor-ray proximity that spooks a fish

const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _near = new THREE.Vector3();

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
  partake: boolean; // joins the current feed/follow event (re-rolled per event)
  retreat: number; // s left of darting away after a bite (hit-and-run feeding)
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
  // Feed / follow only applies to the live editor (not gallery previews that
  // pass an explicit `fish`).
  const interact = useStudioStore((s) => s.fishInteract);
  const fishInteract = fish ? "none" : interact;
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
      partake: false,
      retreat: 0,
    }));
  }, [count, bounds]);

  // Re-roll which fish join the swarm on each feed drop / when Follow turns on.
  const epochRef = useRef(-1);
  const prevInteractRef = useRef<typeof fishInteract>("none");

  // Track the cursor in NDC so idle fish can shy away from the pointer ray.
  const { camera, gl } = useThree();
  const ndcActive = useRef(false);
  useEffect(() => {
    const el = gl.domElement;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      _ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      _ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ndcActive.current = true;
    };
    const leave = () => {
      ndcActive.current = false;
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const { min, max } = bounds;
    const w = PATTERN[cfg.pattern];

    // Fresh random 60–70% subset per event (new food, or Follow just armed).
    const ep = getFoodEpoch();
    const reroll =
      (fishInteract === "feed" && ep !== epochRef.current) ||
      (fishInteract === "follow" && prevInteractRef.current !== "follow");
    if (reroll) {
      const thr = 0.6 + Math.random() * 0.1;
      for (const bb of boids) bb.partake = Math.random() < thr;
    }
    epochRef.current = ep;
    prevInteractRef.current = fishInteract;

    // Idle (not feeding/following): fish shy away from the cursor ray.
    const doScare = fishInteract === "none" && ndcActive.current;
    if (doScare) _ray.setFromCamera(_ndc, camera);

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

      // feed / follow: participating fish steer hard toward the food or cursor.
      // Feeding is hit-and-run — bite, then dart away for a beat before going
      // back — so they never pile up and hang on one spot.
      let seeking = false;
      if (b.partake && fishInteract === "feed") {
        if (b.retreat > 0) {
          b.retreat -= dt; // mid-flee: momentum + wander carry it off, then return
        } else {
          let bestD = Infinity;
          let bx = 0, by = 0, bz = 0, best: (typeof food)[number] | null = null;
          for (const p of food) {
            if (p.eaten) continue;
            const dx = p.x - b.pos.x, dy = p.y - b.pos.y, dz = p.z - b.pos.z;
            const dd = dx * dx + dy * dy + dz * dz;
            if (dd < bestD) { bestD = dd; bx = dx; by = dy; bz = dz; best = p; }
          }
          if (best) {
            seeking = true;
            const dist = Math.sqrt(bestD) || 1;
            _tmp.set(bx / dist, by / dist, bz / dist);
            _force.addScaledVector(_tmp, SEEK);
            if (dist < EAT_R) {
              best.eaten = true; // FoodParticles culls it → reads as eaten
              b.retreat = 0.7 + Math.random() * 1.6; // desync'd flee+return
              // dart away from the food (and a touch upward)
              b.dir.set(b.pos.x - best.x, Math.abs(b.pos.y - best.y) + 1, b.pos.z - best.z).normalize();
            }
          }
        }
      } else if (b.partake && fishInteract === "follow" && pointer.active) {
        seeking = true;
        _tmp.set(pointer.x - b.pos.x, pointer.y - b.pos.y, pointer.z - b.pos.z);
        const dist = _tmp.length() || 1;
        _force.addScaledVector(_tmp.divideScalar(dist), SEEK);
      }

      // idle scare: if the cursor ray passes close, bolt away from it
      if (doScare) {
        const dRay = _ray.ray.distanceToPoint(b.pos);
        if (dRay < SCARE_R) {
          _ray.ray.closestPointToPoint(b.pos, _near);
          _tmp.copy(b.pos).sub(_near);
          const len = _tmp.length() || 1;
          _force.addScaledVector(_tmp.divideScalar(len), SCARE * (1 - dRay / SCARE_R));
        }
      }

      // seeking fish turn sharper, may rise/dive freely, and rush a little
      const turn = seeking ? w.turn * 2.2 : w.turn;
      b.dir.addScaledVector(_force, dt * turn);
      b.dir.y = THREE.MathUtils.clamp(b.dir.y, seeking ? -0.9 : -0.35, seeking ? 0.9 : 0.35);
      b.dir.normalize();

      const speed =
        b.baseSpeed * cfg.speed * speedMul * (seeking || b.retreat > 0 ? 1.35 : 1);
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
