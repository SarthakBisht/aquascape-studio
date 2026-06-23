import type { TankDimensions } from "@/lib/types";

export interface TankPreset {
  id: string;
  label: string;
  note: string;
  dims: TankDimensions;
}

// Common real-world aquascaping tank footprints (cm). Volumes are approximate.
export const TANK_PRESETS: TankPreset[] = [
  { id: "nano-30", label: "Nano Cube", note: "30×30×30 · ~27 L", dims: { width: 30, depth: 30, height: 30 } },
  { id: "ada-60p", label: "ADA 60-P", note: "60×30×36 · ~64 L", dims: { width: 60, depth: 30, height: 36 } },
  { id: "ada-90p", label: "ADA 90-P", note: "90×45×45 · ~182 L", dims: { width: 90, depth: 45, height: 45 } },
  { id: "ada-120p", label: "ADA 120-P", note: "120×45×45 · ~243 L", dims: { width: 120, depth: 45, height: 45 } },
  { id: "shallow-45", label: "Shallow 45", note: "45×27×20 · low-profile", dims: { width: 45, depth: 27, height: 20 } },
];

export const DEFAULT_TANK_ID = "ada-60p";

/** Clamp custom tank dimensions to a sane, renderable range (cm). */
export const TANK_LIMITS = {
  width: [15, 200] as const,
  depth: [15, 80] as const,
  height: [15, 80] as const,
};
