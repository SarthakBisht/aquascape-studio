"use client";

import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useStudioStore } from "@/store/useStudioStore";
import type { Blade, Vec3 } from "./types";

// Freehand "pen": press on a surface and drag to draw plants or substrate
// material. Each plant blade is pre-sampled onto the real surface beneath it
// (soil slope / stone / driftwood) so nothing floats. OrbitControls is disabled
// whenever a brush is active (see TankScene), so dragging draws instead of
// orbiting.

const _ray = new THREE.Raycaster();
const _down = new THREE.Vector3(0, -1, 0);
const _origin = new THREE.Vector3();

const stroke = { active: false, lastX: 0, lastZ: 0, painted: false };

// Shared cursor point on the paintable surface, read imperatively by the plant /
// trim tool ghosts (tweezers, scissors, plant preview) so they never trigger a
// React render. `active` falls false when the pointer leaves every surface.
export const hover = { x: 0, y: 0, z: 0, active: false };
export function trackHover(e: ThreeEvent<PointerEvent>) {
  hover.x = e.point.x;
  hover.y = e.point.y;
  hover.z = e.point.z;
  hover.active = true;
}
export function clearHover() {
  hover.active = false;
}
/** onPointerMove for paintable surfaces: track the cursor + advance any stroke. */
export function onSurfaceMove(e: ThreeEvent<PointerEvent>) {
  trackHover(e);
  moveStroke(e);
}

function sceneRoot(obj: THREE.Object3D): THREE.Object3D {
  let o = obj;
  while (o.parent) o = o.parent;
  return o;
}

function isPaintable(obj: THREE.Object3D): boolean {
  let o: THREE.Object3D | null = obj;
  while (o) {
    if (o.userData?.paintable) return true;
    o = o.parent;
  }
  return false;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintableTargets(from: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  sceneRoot(from).traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && isPaintable(m)) out.push(m);
  });
  return out;
}

function paintPlant(e: ThreeEvent<PointerEvent>) {
  const s = useStudioStore.getState();
  if (!s.activePlantId) return;
  const { radius, density } = s.brush;
  const center = e.point;
  const targets = paintableTargets(e.object);
  const rand = mulberry32((center.x * 1000 + center.z * 7 + Date.now()) | 0);
  const top = center.y + 40;
  const blades: Blade[] = [];
  for (let i = 0; i < density; i++) {
    const ang = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius;
    const bx = Math.cos(ang) * r;
    const bz = Math.sin(ang) * r;
    _origin.set(center.x + bx, top, center.z + bz);
    _ray.set(_origin, _down);
    const hit = _ray.intersectObjects(targets, false)[0];
    blades.push({
      x: bx,
      z: bz,
      y: hit ? hit.point.y : center.y,
      yaw: rand() * Math.PI * 2,
      // strong size + lean variance so a bunch doesn't read as identical copies
      lean: (rand() - 0.5) * 0.55,
      hMul: 0.5 + rand() * 1.1,
    });
  }
  s.addPlantPatch(s.activePlantId, [center.x, center.y, center.z] as Vec3, blades);
}

function paintGround(e: ThreeEvent<PointerEvent>) {
  const s = useStudioStore.getState();
  if (!s.activeGround) return;
  const p = e.point;
  s.addGroundPatch(s.activeGround, [p.x, p.y, p.z] as Vec3);
}

function paintAt(e: ThreeEvent<PointerEvent>) {
  const s = useStudioStore.getState();
  if (s.tool === "plant") paintPlant(e);
  else if (s.tool === "ground") paintGround(e);
  else if (s.tool === "sculpt") s.sculptSubstrate(e.point.x, e.point.z);
  else if (s.tool === "trim") s.trimPlants(e.point.x, e.point.z);
  stroke.lastX = e.point.x;
  stroke.lastZ = e.point.z;
  stroke.painted = true;
}

/** Pointer down on a paintable surface — begin a stroke if a brush is active. */
export function beginStroke(e: ThreeEvent<PointerEvent>): boolean {
  const s = useStudioStore.getState();
  if (s.tool === "select") return false;
  e.stopPropagation();
  stroke.active = true;
  stroke.painted = false;
  // The whole stroke (many dabs) collapses into one undo step.
  useStudioStore.getState().beginTxn();
  paintAt(e);
  return true;
}

/** Pointer move while drawing — drop another dab once we've moved far enough. */
export function moveStroke(e: ThreeEvent<PointerEvent>) {
  if (!stroke.active) return;
  const s = useStudioStore.getState();
  if (s.tool === "select") return;
  const dx = e.point.x - stroke.lastX;
  const dz = e.point.z - stroke.lastZ;
  const spacing = Math.max(2, s.brush.radius * 0.8);
  if (dx * dx + dz * dz >= spacing * spacing) {
    e.stopPropagation();
    paintAt(e);
  }
}

/** Pointer up anywhere — end the stroke. */
export function endStroke() {
  if (stroke.active) useStudioStore.getState().endTxn();
  stroke.active = false;
}
