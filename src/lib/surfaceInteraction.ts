"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useStudioStore } from "@/store/useStudioStore";
import type { Vec3 } from "./types";

/**
 * When the plant brush is active, drop a patch exactly where a surface was
 * clicked — so plants always sit on the soil, a stone, or driftwood rather than
 * floating on a flat plane. Returns true if it painted (caller skips selection).
 */
export function paintIfActive(e: ThreeEvent<MouseEvent>): boolean {
  const s = useStudioStore.getState();
  if (s.mode !== "design" || s.tool !== "paint" || !s.activePlantId) return false;
  e.stopPropagation();
  s.addPlantPatch(s.activePlantId, [e.point.x, e.point.y, e.point.z] as Vec3);
  return true;
}
