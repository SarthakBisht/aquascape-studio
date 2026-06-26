import type { FishModel } from "@/lib/types";

// Real fish .glb models (data-driven, like hardscapeMaterials). The list is
// empty until you drop CC0 low-poly fish into public/models/fish/ — then add an
// entry here and it shows up in the Fish panel. `scale`/`rotationY` calibrate
// each asset's native size + forward axis (the loader normalizes longest axis
// to 1, so scale ≈ desired fish length in cm; rotationY points the nose to +X).
//
// Example once a file exists:
//   { id: "tetra", label: "Neon Tetra", model: "/models/fish/tetra.glb", scale: 4 },
export const FISH_MODELS: FishModel[] = [];

export function getFishModel(id: string | undefined): FishModel | undefined {
  if (!id) return undefined;
  return FISH_MODELS.find((m) => m.id === id);
}
