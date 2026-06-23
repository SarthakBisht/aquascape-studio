// Shared types for the aquascape studio. All real-world measurements are in
// centimeters; 1 three.js world unit == 1 cm (see lib/units.ts).

export type Vec3 = [number, number, number];

/** Tank interior measured in centimeters. */
export interface TankDimensions {
  width: number; // left-right (x)
  depth: number; // front-back (z)
  height: number; // bottom-top (y)
}

export type SubstrateType = "aquasoil" | "sand" | "gravel";

export interface SubstrateConfig {
  type: SubstrateType;
  /** Average depth in cm at the front of the tank. */
  depthFront: number;
  /** Average depth in cm at the back (usually higher → "slope" for depth). */
  depthBack: number;
}

export type HardscapeKind = "rock" | "wood";

/** A material entry in the hardscape palette (data-driven, easy to extend). */
export interface HardscapeMaterial {
  id: string;
  kind: HardscapeKind;
  label: string;
  /** Short hobby description shown in the palette. */
  blurb: string;
  /** Base PBR-ish look until real scanned textures are wired in. */
  color: string;
  roughness: number;
  metalness: number;
  /** Default non-uniform shape bias applied to the procedural mesh. */
  shape: Vec3;
}

/** A placed piece of hardscape in the scene. */
export interface HardscapeItem {
  id: string;
  materialId: string;
  kind: HardscapeKind;
  position: Vec3;
  rotation: Vec3;
  /** Uniform scale multiplier. */
  scale: number;
  /** Seed drives the procedural geometry so each rock is unique but stable. */
  seed: number;
}

export type PlantCategory =
  | "carpet"
  | "midground"
  | "background"
  | "epiphyte"
  | "moss"
  | "floating";

export type Difficulty = "easy" | "medium" | "hard";
export type GrowthRate = "slow" | "medium" | "fast";
export type LightNeed = "low" | "medium" | "high";

export interface PlantSpecies {
  id: string;
  name: string;
  latin: string;
  category: PlantCategory;
  difficulty: Difficulty;
  growth: GrowthRate;
  light: LightNeed;
  co2: boolean;
  /** Real height range in cm — used to scale the placed plant correctly. */
  heightCm: [number, number];
  /** Representative foliage color. */
  color: string;
}

/** A painted region of a single plant species. */
export interface PlantPlacement {
  id: string;
  speciesId: string;
  /** Center of the painted patch on the substrate. */
  position: Vec3;
  /** Patch radius in cm. */
  radius: number;
  /** Blades/stems per patch (scaled by quality at render time). */
  density: number;
}

export type AquascapeStyle = "iwagumi" | "nature" | "dutch";

export interface StylePreset {
  id: AquascapeStyle;
  label: string;
  origin: string;
  blurb: string;
  /** Composition hints surfaced in the UI. */
  rules: string[];
}

export type Quality = "low" | "medium" | "high";
export type ViewMode = "design" | "underwater";
export type TransformMode = "translate" | "rotate" | "scale";

/** The serializable layout that gets saved / exported / shared. */
export interface Layout {
  version: 1;
  tank: TankDimensions;
  substrate: SubstrateConfig;
  style: AquascapeStyle | null;
  hardscape: HardscapeItem[];
  plants: PlantPlacement[];
}
