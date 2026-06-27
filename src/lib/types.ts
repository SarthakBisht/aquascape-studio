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

/** Editable substrate top surface: depth (cm) per grid cell, row-major
 *  (j=0 front → j=nz-1 back, i over width). See `src/lib/terrain.ts`. */
export interface HeightField {
  nx: number;
  nz: number;
  h: number[];
}

export interface SubstrateConfig {
  type: SubstrateType;
  /** Granular look/colour variant id (see `src/data/substrates.ts`). Optional:
   *  legacy layouts without it fall back to the first variant of `type`. */
  variant?: string;
  /** Average depth in cm at the front of the tank. */
  depthFront: number;
  /** Average depth in cm at the back (usually higher → "slope" for depth). */
  depthBack: number;
  /**
   * Sculpted top surface (absolute depth in cm per grid cell). When set, it
   * overrides the flat front/back ramp so hills, valleys and terraces are
   * possible. Seeded from depthFront/depthBack; see `src/lib/terrain.ts`.
   */
  field?: HeightField;
}

export type HardscapeKind = "rock" | "wood";

/** Base form of a procedural rock. boulder/slab/plate/spire/shard/cobble deform
 *  an icosahedron; arch/bowl use non-convex primitives (half-torus / lathe). */
export type RockForm =
  | "boulder"
  | "slab"
  | "plate"
  | "spire"
  | "shard"
  | "cobble"
  | "dragon"
  | "arch"
  | "bowl";

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
  /** Per-stone surface roughness of the silhouette (higher = more jagged). */
  jaggedness?: number;
  /** Secondary color streaked into the surface as vertex colors (e.g. calcite veins). */
  veinColor?: string;
  /** Horizontal stratification — layered sedimentary look (Pagoda / petrified wood). */
  strata?: boolean;
  /** Default PBR surface id (HARDSCAPE_SURFACES) so library pieces ship textured,
   *  not flat. A per-piece `textureId` override still wins. */
  textureId?: string;
  /** Default base form for the procedural mesh (undefined ⇒ boulder). */
  form?: RockForm;
  /**
   * Optional path to a real .glb model (e.g. "/models/seiryu-01.glb"). When set
   * it replaces the procedural rock — the upgrade path to scanned hardscape.
   * See public/ASSETS.md.
   */
  model?: string;
}

/** A surface in the PBR library. Albedo/normal/roughness maps are generated
 *  procedurally from these params (seeded, seamless) — no bundled image files,
 *  no CORS/404 risk. Drop-in upgrade path: swap the generator for real maps. */
export interface HardscapeSurface {
  id: string;
  label: string;
  kind: HardscapeKind;
  /** Base stone/wood color (hex). */
  base: string;
  /** Secondary mottle / grain color (hex). */
  accent: string;
  /** Feature size of the grain, in cm (bigger = coarser). */
  grainCm: number;
  /** Real-world tile size in cm (drives triplanar repeat). */
  tileCm: number;
  /** Base roughness + how much it varies across the grain. */
  roughBase: number;
  roughVar: number;
  /** Normal-map bump strength. */
  bump: number;
  /** Horizontal banding (sedimentary stone / wood grain). */
  strata?: boolean;
}

/** Parameters for the procedural branching driftwood generator. */
export interface DriftParams {
  branches: number; // primary limbs off the base
  length: number; // overall reach (relative)
  gnarl: number; // how much each limb wanders
  taper: number; // how fast limbs thin toward the tip
  splits: number; // recursive child branches per limb
  thickness: number; // base trunk radius (relative)
}

/** A generated mesh (from a drawing or a depth photo), persisted as a small
 *  grayscale height PNG so the layout stays light and rebuilds deterministically
 *  on load — no model re-run. */
export interface CustomMesh {
  /** Grayscale height field as a PNG data URL (white = tall). */
  height: string;
  w: number;
  h: number;
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

  /** Geometry source. Undefined ⇒ "procedural" (legacy rocks). "sculpt" = a
   *  procedural base that's been freely 3D-sculpted (see lib/rockSculpt.ts). */
  source?: "procedural" | "drift" | "mesh" | "sculpt";

  // ---- per-piece look overrides (fall back to the material) ----
  color?: string;
  /** Triplanar PBR surface: a HARDSCAPE_SURFACES id, OR a "custom:"-prefixed id
   *  into the store's customSurfaces (an uploaded photo). Overrides the material. */
  textureId?: string;
  roughness?: number;
  /** Triplanar repeat size (cm) for an uploaded custom texture. Default ~20. */
  textureScaleCm?: number;

  // ---- free-sculpt (source === "sculpt") ----
  /** Per-welded-vertex vec3 displacement from the locked base, quantized base64
   *  (see lib/rockSculpt.ts). Undefined ⇒ base shape, not yet brushed. */
  sculptD?: string;
  /** Welded vertex count the buffer was authored against — a load-time guard so a
   *  param-lock mismatch decodes to "un-sculpted" rather than corrupting verts. */
  sculptN?: number;

  // ---- per-piece rock sculpt overrides (passed to makeRockGeometry) ----
  /** Base form (undefined ⇒ material default ⇒ boulder). */
  form?: RockForm;
  shape?: Vec3;
  jaggedness?: number;
  detail?: number;
  strata?: boolean;
  veinColor?: string;
  /** Radius scaled by height: + = wide base/anvil, − = wide top/spire. */
  taper?: number;
  /** Planar cleave amount 0..1 — flattens the top & a side into flat faces. */
  flat?: number;
  /** Small lean so the piece isn't axis-symmetric (radians-ish, 0..1). */
  tilt?: number;
  /** Dragon-scale pitting strength 0..1 (cellular craters). 0 ⇒ none. */
  pitting?: number;
  /** Pit cell frequency (≈ craters across the rock). Bigger = denser. */
  pitScale?: number;

  /** Driftwood generator params (when source === "drift"). */
  drift?: DriftParams;
  /** Key into the store's customMeshes (when source === "mesh"). */
  meshId?: string;
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

/**
 * How a species behaves in its "natural state" — drives growth + placement so
 * each plant grows like itself, not all alike. Mostly derived from form/category/
 * growth in `lib/plantHabit.ts`; a species can override any field via `habit`.
 */
export interface PlantHabit {
  /** Where it sits: rooted on the bed, or floating leaves at the waterline. */
  anchor: "substrate" | "surface";
  /** 0..1 — fraction of [minH,maxH] the growth slider traverses (stem=tall, carpet≈flat). */
  heightGain: number;
  /** 0..1 — how much density/fill rises as it grows in (carpet/moss fill, epiphyte stays sparse). */
  fullnessGain: number;
  /** false ⇒ leaf card width stays fixed while the stem grows (water lily). */
  leafScalesWithHeight: boolean;
  /** Per-slider change scalar by growth rate (slow plants change less). */
  rateScalar: number;
}

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
  /**
   * Optional per-species overrides of the derived growth/placement character
   * (see `lib/plantHabit.ts`). Only set where botany differs from the form's
   * default — e.g. a water lily (`leafScalesWithHeight: false`).
   */
  habit?: Partial<PlantHabit>;
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
  /** Granular variant id (see `src/data/substrates.ts`). Optional: legacy
   *  patches without it fall back to the first variant of `type`. */
  variant?: string;
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

/** Which glass pane(s) the composition grid is drawn on, and at what ratio. */
export type GuideFace = "front" | "back" | "both";
export type GuideRatio = "thirds" | "golden" | "both";
export interface GuideConfig {
  face: GuideFace;
  ratio: GuideRatio;
}

/** Global color grade applied to the whole render (post-process). Neutral = all 0. */
export interface ColorGrade {
  brightness: number; // -1..1
  contrast: number; // -1..1
  saturation: number; // -1..1
  hue: number; // 0..360 deg tint
}

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
  /** When set, render this .glb model (see data/fishModels.ts) instead of the
   *  stylized procedural fish. Undefined ⇒ procedural (the palette applies). */
  modelId?: string;
}

/** A real fish .glb model option (data-driven, like HardscapeMaterial). */
export interface FishModel {
  id: string;
  label: string;
  /** Path under /public, e.g. "/models/fish/tetra.glb". */
  model: string;
  /** Calibration knobs for the real asset's native units/orientation: the
   *  loader normalizes longest axis to 1, then applies `scale`; `rotationY`
   *  spins the model so its nose points along +X (the swim-forward axis). */
  scale?: number;
  rotationY?: number;
}
export type TransformMode = "translate" | "rotate" | "scale";

export type FixtureType = "spot" | "flood" | "rgb";

/** One controllable light hung above the tank. */
export interface LightFixture {
  id: string;
  type: FixtureType;
  /** Position above the tank: cm offset from tank center along width (x) / depth (z). */
  x: number;
  z: number;
  /** Fixture height above the tank rim, in cm. */
  height: number;
  /** Brightness multiplier (~0..3). */
  intensity: number;
  /** Color temperature, warm 3000K .. cool 8000K — drives spot/flood color. */
  kelvin: number;
  /** Hex color — used by the `rgb` accent type only. */
  color: string;
  /** Toggle off without deleting. */
  on: boolean;
}

/** The tank's backdrop — the panel behind the back glass. */
export type BackgroundStyle = "none" | "solid" | "gradient" | "backlit";

export interface BackgroundConfig {
  style: BackgroundStyle;
  /** Top / center color (solid uses this). */
  colorTop: string;
  /** Bottom (gradient) / edge (backlit) color. */
  colorBottom: string;
  /** Backlight intensity 0..1 (backlit only) — the frosted-panel glow. */
  glow: number;
  /** Backlit glow center, normalized 0..1 (default 0.5 / 0.45). */
  glowX?: number;
  glowY?: number;
}

/** The serializable layout that gets saved / exported / shared.
 *  v2 captures the full look (lights, fish, grade, ambience, growth, view mode,
 *  custom plant photos) so a reopened scape — incl. its underwater settings —
 *  is restored exactly. v1 files still load (the extras default). */
export interface Layout {
  version: 1 | 2;
  tank: TankDimensions;
  substrate: SubstrateConfig;
  style: AquascapeStyle | null;
  hardscape: HardscapeItem[];
  plants: PlantPlacement[];
  ground?: GroundPatch[];
  background?: BackgroundConfig;
  /** Generated custom-mesh height fields referenced by hardscape pieces. */
  customMeshes?: Record<string, CustomMesh>;
  /** Uploaded hardscape surface images (custom id → data URL), referenced by a
   *  piece's `textureId`. Mirrors customPlantTextures. */
  customSurfaces?: Record<string, string>;

  // ---- v2: full scape look ----
  ambience?: string;
  lights?: LightFixture[];
  fish?: FishConfig;
  grade?: ColorGrade;
  growth?: number;
  guides?: GuideConfig;
  /** Design vs underwater — so the gallery shows the scape as it was saved. */
  mode?: ViewMode;
  /** Per-species billboard photos referenced by the plants. */
  customPlantTextures?: Record<string, string>;
  /** User-created plant species referenced by the plants. */
  customPlants?: PlantSpecies[];
}
