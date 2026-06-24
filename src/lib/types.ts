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
  /**
   * Optional path to a real .glb model (e.g. "/models/seiryu-01.glb"). When set
   * it replaces the procedural rock — the upgrade path to scanned hardscape.
   * See public/ASSETS.md.
   */
  model?: string;
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

/** Silhouette family — drives the billboard texture + proportions. */
export type PlantForm =
  | "blade" // grass / carpet blades
  | "broadleaf" // anubias / crypt broad leaves
  | "stem" // tall stem plants
  | "rosette" // radiating crypt/sword
  | "moss" // fuzzy clumps
  | "floating"; // surface leaves

export interface PlantSpecies {
  id: string;
  name: string;
  latin: string;
  category: PlantCategory;
  form: PlantForm;
  difficulty: Difficulty;
  growth: GrowthRate;
  light: LightNeed;
  co2: boolean;
  /** Real height range in cm — used to scale the placed plant correctly. */
  heightCm: [number, number];
  /** Representative foliage color. */
  color: string;
  /**
   * Optional path to a real cutout PNG (e.g. "/plants/anubias-nana.png").
   * When set it replaces the procedural billboard texture — the upgrade path
   * to photoreal foliage. See public/ASSETS.md.
   */
  texture?: string;
}

/** One scattered plant within a patch, with the surface height sampled under it. */
export interface Blade {
  /** Offset from the patch center (cm). */
  x: number;
  z: number;
  /** Absolute world surface height the blade sits on (cm). */
  y: number;
  yaw: number;
  lean: number;
  /** Per-blade height multiplier. */
  hMul: number;
}

/** A painted region of a single plant species. */
export interface PlantPlacement {
  id: string;
  speciesId: string;
  /** Center of the painted patch on the surface that was clicked. */
  position: Vec3;
  /** Patch radius in cm. */
  radius: number;
  /** Blades/stems per patch (scaled by quality at render time). */
  density: number;
  /** Per-patch height multiplier (the "size" customization). Defaults to 1. */
  scale?: number;
  /**
   * Pre-sampled blades, each seated on the real surface (soil slope / stone /
   * driftwood) under it. Baked at paint time. Older patches without this fall
   * back to a flat scatter.
   */
  blades?: Blade[];
}

/** A drawn patch of substrate material (e.g. a sand path) laid level on the soil. */
export interface GroundPatch {
  id: string;
  type: SubstrateType;
  /** Center on the surface that was painted. */
  position: Vec3;
  /** Patch radius in cm. */
  radius: number;
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

export type FishPattern = "school" | "calm" | "dart" | "scatter";
export type FishPalette = "tropical" | "neon" | "natural" | "mono";

export interface FishConfig {
  count: number;
  /** Body size multiplier. */
  size: number;
  /** Swim speed multiplier. */
  speed: number;
  pattern: FishPattern;
  palette: FishPalette;
}
export type TransformMode = "translate" | "rotate" | "scale";

/** The tank's backdrop — the panel behind the back glass. */
export type BackgroundStyle = "solid" | "gradient" | "backlit";

export interface BackgroundConfig {
  style: BackgroundStyle;
  /** Top / center color (solid uses this). */
  colorTop: string;
  /** Bottom (gradient) / edge (backlit) color. */
  colorBottom: string;
  /** Backlight intensity 0..1 (backlit only) — the frosted-panel glow. */
  glow: number;
}

/** The serializable layout that gets saved / exported / shared. */
export interface Layout {
  version: 1;
  tank: TankDimensions;
  substrate: SubstrateConfig;
  style: AquascapeStyle | null;
  hardscape: HardscapeItem[];
  plants: PlantPlacement[];
  ground?: GroundPatch[];
  background?: BackgroundConfig;
}
