import type { SubstrateType } from "@/lib/types";

/**
 * Substrate library (data-driven, like hardscapeMaterials). Each variant is a
 * real aquascaping product with an exact grain colour + grain diameter; `type`
 * is the physics category (drives repose-angle slumping + paint, see
 * `terrain.ts` / `surfaceInteraction.ts`). The granular PBR look is generated
 * from `color`/`accent`/`grainMm`/`relief` in `lib/substrateTextureGen.ts`.
 * Colours sampled from product photography (ADA / Tropica / Fluval / CaribSea).
 */
export interface SubstrateVariant {
  id: string;
  label: string;
  type: SubstrateType; // physics: aquasoil holds steep, sand slumps shallow
  /** Mean grain colour (exact). */
  color: string;
  /** Lighter grain / highlight colour — grains jitter between color↔accent. */
  accent: string;
  /** Grain diameter in mm (sets real-world tiling density). */
  grainMm: number;
  /** Bump strength 0..1 (chunky soil/gravel = 1, fine sand = low). */
  relief: number;
}

export const SUBSTRATES: SubstrateVariant[] = [
  // ── Aqua soils (dark granulated nutrient pellets, 2–3 mm) ──────────────
  {
    id: "amazonia",
    label: "ADA Amazonia",
    type: "aquasoil",
    color: "#241910",
    accent: "#4a3422",
    grainMm: 2.5,
    relief: 1.0,
  },
  {
    id: "amazonia-light",
    label: "Amazonia Light",
    type: "aquasoil",
    color: "#3a2a1c",
    accent: "#6b4d33",
    grainMm: 2.5,
    relief: 1.0,
  },
  {
    id: "tropica-soil",
    label: "Tropica Soil",
    type: "aquasoil",
    color: "#2b2118",
    accent: "#4a3826",
    grainMm: 2.8,
    relief: 1.0,
  },
  {
    id: "fluval-stratum",
    label: "Fluval Stratum",
    type: "aquasoil",
    color: "#33271c",
    accent: "#574029",
    grainMm: 3.0,
    relief: 1.0,
  },
  {
    id: "malaya",
    label: "ADA Malaya",
    type: "aquasoil",
    color: "#4a3320",
    accent: "#75502f",
    grainMm: 2.5,
    relief: 1.0,
  },
  // ── Sands (fine, 0.3–0.8 mm) ──────────────────────────────────────────
  {
    id: "la-plata",
    label: "La Plata (white)",
    type: "sand",
    color: "#e6dcc6",
    accent: "#fbf4e3",
    grainMm: 0.5,
    relief: 0.45,
  },
  {
    id: "nature-sand",
    label: "Nature Sand",
    type: "sand",
    color: "#cdb083",
    accent: "#e3cda1",
    grainMm: 0.6,
    relief: 0.45,
  },
  {
    id: "colorado",
    label: "Colorado (tan)",
    type: "sand",
    color: "#c19663",
    accent: "#d8b485",
    grainMm: 0.6,
    relief: 0.45,
  },
  {
    id: "black-sand",
    label: "Black Sand",
    type: "sand",
    color: "#2b2b30",
    accent: "#4a4a55",
    grainMm: 0.5,
    relief: 0.5,
  },
  // ── Gravels (2–5 mm) ──────────────────────────────────────────────────
  {
    id: "river-gravel",
    label: "River Gravel",
    type: "gravel",
    color: "#9a8d78",
    accent: "#bcae95",
    grainMm: 4.0,
    relief: 1.0,
  },
  {
    id: "quartz-gravel",
    label: "Quartz Gravel",
    type: "gravel",
    color: "#b8ad95",
    accent: "#d6ccb1",
    grainMm: 4.0,
    relief: 0.95,
  },
  {
    id: "basalt-gravel",
    label: "Basalt Gravel",
    type: "gravel",
    color: "#595550",
    accent: "#807a6f",
    grainMm: 4.0,
    relief: 1.0,
  },
];

const BY_ID = new Map(SUBSTRATES.map((s) => [s.id, s]));

/** Resolve a SubstrateConfig to its variant: explicit `variant` wins; legacy
 *  layouts (only `type`) fall back to the first variant of that type. */
export function resolveSubstrate(s: {
  type: SubstrateType;
  variant?: string;
}): SubstrateVariant {
  if (s.variant) {
    const v = BY_ID.get(s.variant);
    if (v) return v;
  }
  return SUBSTRATES.find((x) => x.type === s.type) ?? SUBSTRATES[0];
}
