import type { HardscapeMaterial } from "@/lib/types";

// Data-driven hardscape library. Adding a new rock/wood type is just a new
// entry here — the palette, picker, and renderer all read from this list.
// `color/roughness/metalness` are placeholder looks until real scanned PBR
// textures are bundled under /public/textures (see public/ASSETS.md).
export const HARDSCAPE_MATERIALS: HardscapeMaterial[] = [
  {
    id: "seiryu",
    kind: "rock",
    label: "Seiryu Stone",
    blurb: "Jagged blue-grey limestone with white calcite veins. Raises pH.",
    color: "#6f7479",
    roughness: 0.85,
    metalness: 0.04,
    shape: [1.1, 1.0, 0.9],
  },
  {
    id: "dragon",
    kind: "rock",
    label: "Dragon Stone (Ohko)",
    blurb: "Porous brown clay rock. Great for caves & cliffs. Inert.",
    color: "#8a6f4e",
    roughness: 0.95,
    metalness: 0.0,
    shape: [1.0, 1.05, 1.0],
  },
  {
    id: "lava",
    kind: "rock",
    label: "Lava Rock",
    blurb: "Dark, lightweight, highly porous. Good biological filtration.",
    color: "#3a3537",
    roughness: 1.0,
    metalness: 0.0,
    shape: [1.0, 0.9, 1.0],
  },
  {
    id: "spiderwood",
    kind: "wood",
    label: "Spider Wood",
    blurb: "Branchy root-like wood. Lightens then darkens with age.",
    color: "#7a5a3a",
    roughness: 0.9,
    metalness: 0.0,
    shape: [0.45, 1.6, 0.45],
  },
  {
    id: "manzanita",
    kind: "wood",
    label: "Manzanita",
    blurb: "Dense, intricate branching. Prized for tree-style scapes.",
    color: "#6b4f34",
    roughness: 0.85,
    metalness: 0.0,
    shape: [0.4, 1.8, 0.4],
  },
];

export function getMaterial(id: string): HardscapeMaterial | undefined {
  return HARDSCAPE_MATERIALS.find((m) => m.id === id);
}
