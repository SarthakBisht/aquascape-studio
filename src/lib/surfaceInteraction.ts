"use client";

import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useStudioStore } from "@/store/useStudioStore";
import type { Blade, Vec3 } from "./types";

const _ray = new THREE.Raycaster();
const _down = new THREE.Vector3(0, -1, 0);
const _origin = new THREE.Vector3();

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

/**
 * When the plant brush is active, drop a patch where a surface was clicked and
 * pre-sample each blade onto the real surface beneath it (soil slope / stone /
 * driftwood) by raycasting straight down — so nothing floats over the slope.
 * Returns true if it painted (caller skips selection).
 */
export function paintIfActive(e: ThreeEvent<MouseEvent>): boolean {
  const s = useStudioStore.getState();
  if (s.mode !== "design" || s.tool !== "paint" || !s.activePlantId) return false;
  e.stopPropagation();

  const { radius, density } = s.brush;
  const center = e.point;

  // Collect the paintable surface meshes once for this stroke.
  const targets: THREE.Object3D[] = [];
  sceneRoot(e.object).traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && isPaintable(m)) targets.push(m);
  });

  const rand = mulberry32((center.x * 1000 + center.z) | 0 || Date.now());
  const top = center.y + 40; // cast from above the surface
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
      lean: (rand() - 0.5) * 0.25,
      hMul: 0.7 + rand() * 0.6,
    });
  }

  s.addPlantPatch(
    s.activePlantId,
    [center.x, center.y, center.z] as Vec3,
    blades,
  );
  return true;
}
