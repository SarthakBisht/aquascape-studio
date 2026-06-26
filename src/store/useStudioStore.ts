import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AquascapeStyle,
  BackgroundConfig,
  Blade,
  ColorGrade,
  CustomMesh,
  FishConfig,
  FixtureType,
  GroundPatch,
  GuideConfig,
  HardscapeItem,
  Layout,
  LightFixture,
  PlantPlacement,
  Quality,
  SubstrateConfig,
  SubstrateType,
  TankDimensions,
  TransformMode,
  Vec3,
  ViewMode,
} from "@/lib/types";
import { fieldGrid, makeLinearField, sculptField } from "@/lib/terrain";
import { getMaterial } from "@/data/hardscapeMaterials";
import { TANK_PRESETS, DEFAULT_TANK_ID } from "@/data/tankPresets";
import { DEFAULT_BACKGROUND, DEFAULT_AMBIENCE } from "@/data/backgrounds";

// SSR-safe storage: localStorage doesn't exist on the server / during build.
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const DEFAULT_TANK: TankDimensions =
  TANK_PRESETS.find((t) => t.id === DEFAULT_TANK_ID)?.dims ?? {
    width: 60,
    depth: 30,
    height: 36,
  };

const DEFAULT_SUBSTRATE: SubstrateConfig = {
  type: "aquasoil",
  depthFront: 3,
  depthBack: 7,
};

const DEFAULT_GRADE: ColorGrade = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
};

const DEFAULT_LIGHTS: LightFixture[] = [
  {
    id: "default-flood",
    type: "flood",
    x: 0,
    z: 0,
    height: Math.round(DEFAULT_TANK.height * 0.5),
    intensity: 1,
    kelvin: 6500,
    color: "#7fd4ff",
    on: true,
  },
];

/** The slice of state that undo/redo snapshots — the scape itself, not the
 *  view settings, fish, custom textures, or transient editor state. */
type SceneSnapshot = Pick<
  StudioState,
  "tank" | "substrate" | "style" | "hardscape" | "plants" | "ground" | "background"
>;

const HISTORY_LIMIT = 50;
const sceneSnapshot = (s: StudioState): SceneSnapshot => ({
  tank: s.tank,
  substrate: s.substrate,
  style: s.style,
  hardscape: s.hardscape,
  plants: s.plants,
  ground: s.ground,
  background: s.background,
});

// Transient gesture bookkeeping (module-level so it never triggers renders or
// gets persisted). While a transaction is open (a transform drag or a paint
// stroke) the per-mutation pushHistory() calls are suppressed, so the whole
// gesture collapses into a single undo step.
let historyTxnOpen = false;
let txnPre: SceneSnapshot | null = null;

interface StudioState {
  // ---- persisted scene data ----
  tank: TankDimensions;
  substrate: SubstrateConfig;
  style: AquascapeStyle | null;
  hardscape: HardscapeItem[];
  plants: PlantPlacement[];
  ground: GroundPatch[];
  background: BackgroundConfig;
  /** Scene / room ambience color — fills the canvas outside the tank. */
  ambience: string;
  /** Per-species custom billboard image (speciesId → PNG data URL). */
  customPlantTextures: Record<string, string>;
  /** Generated hardscape height fields (meshId → height PNG), rebuilt to geometry on load. */
  customMeshes: Record<string, CustomMesh>;

  // ---- persisted view settings ----
  mode: ViewMode;
  quality: Quality;
  showGuides: boolean;
  /** Which glass pane(s) the composition grid sits on + at what ratio. */
  guides: GuideConfig;
  growth: number; // 0 = just planted, 1 = fully grown-in
  /** Global post-process color grade for the whole render. */
  grade: ColorGrade;
  /** Zen mode dissolves the interface so only the scape remains. Transient. */
  zen: boolean;

  /** Fish look & behaviour (underwater mode). */
  fish: FishConfig;

  /** Overhead light rig — add/remove fixtures hung above the tank. */
  lights: LightFixture[];

  // ---- plant brush (size/density of newly painted patches) ----
  brush: { radius: number; density: number; scale: number };

  // ---- undo/redo history (in-memory; never persisted) ----
  past: SceneSnapshot[];
  future: SceneSnapshot[];

  // ---- transient editor state (not persisted) ----
  selectedId: string | null;
  transformMode: TransformMode;
  activePlantId: string | null; // species "loaded" for the plant brush
  activeGround: SubstrateType | null; // material "loaded" for the draw brush
  tool: "select" | "plant" | "ground" | "place" | "sculpt";
  /** Sculpt brush direction: +1 raises soil, -1 carves it. Transient. */
  sculptDir: 1 | -1;
  placingMaterialId: string | null; // rock armed for ghost placement (transient)
  placingSeed: number; // shape seed shared by ghost + committed rock (transient)

  // ---- actions ----
  setTank: (dims: TankDimensions) => void;
  setSubstrate: (patch: Partial<SubstrateConfig>) => void;
  setStyle: (style: AquascapeStyle | null) => void;
  setBackground: (patch: Partial<BackgroundConfig>) => void;
  setAmbience: (color: string) => void;

  addHardscape: (materialId: string, position?: Vec3, seed?: number) => void;
  /** Add a non-library piece (driftwood generator / drawn / depth-photo mesh). Returns its id. */
  addGeneratedHardscape: (
    partial: Pick<HardscapeItem, "kind" | "source"> &
      Partial<
        Pick<
          HardscapeItem,
          "materialId" | "drift" | "meshId" | "color" | "textureId" | "scale"
        >
      >,
  ) => string;
  updateHardscape: (id: string, patch: Partial<HardscapeItem>) => void;
  removeHardscape: (id: string) => void;
  duplicateHardscape: (id: string) => void;
  setCustomMesh: (id: string, data: CustomMesh) => void;
  clearCustomMesh: (id: string) => void;
  beginPlacing: (materialId: string) => void;
  cancelPlacing: () => void;

  selectItem: (id: string | null) => void;
  setTransformMode: (mode: TransformMode) => void;

  setActivePlant: (speciesId: string | null) => void;
  setActiveGround: (type: SubstrateType | null) => void;
  setTool: (tool: "select" | "plant" | "ground" | "place" | "sculpt") => void;
  setSculptDir: (dir: 1 | -1) => void;
  /** Raise (+) / carve (−) the substrate height field under a world point. */
  sculptSubstrate: (px: number, pz: number) => void;
  setBrush: (patch: Partial<StudioState["brush"]>) => void;
  addPlantPatch: (speciesId: string, position: Vec3, blades?: Blade[]) => void;
  removePlant: (id: string) => void;
  setPlantTexture: (speciesId: string, dataUrl: string) => void;
  clearPlantTexture: (speciesId: string) => void;
  addGroundPatch: (type: SubstrateType, position: Vec3) => void;

  setMode: (mode: ViewMode) => void;
  setQuality: (q: Quality) => void;
  toggleGuides: () => void;
  setGuides: (patch: Partial<GuideConfig>) => void;
  setGrowth: (v: number) => void;
  setGrade: (patch: Partial<ColorGrade>) => void;
  resetGrade: () => void;
  toggleZen: () => void;
  setFish: (patch: Partial<FishConfig>) => void;

  addLight: (type: FixtureType) => void;
  updateLight: (id: string, patch: Partial<LightFixture>) => void;
  removeLight: (id: string) => void;

  loadLayout: (layout: Layout) => void;
  getLayout: () => Layout;
  reset: () => void;

  pushHistory: () => void;
  beginTxn: () => void;
  endTxn: () => void;
  undo: () => void;
  redo: () => void;
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      tank: DEFAULT_TANK,
      substrate: DEFAULT_SUBSTRATE,
      style: null,
      hardscape: [],
      plants: [],
      ground: [],
      background: DEFAULT_BACKGROUND,
      ambience: DEFAULT_AMBIENCE,
      customPlantTextures: {},
      customMeshes: {},

      mode: "design",
      quality: "medium",
      showGuides: true,
      guides: { face: "front", ratio: "both" },
      growth: 0.25,
      grade: DEFAULT_GRADE,
      zen: false,

      fish: { count: 14, size: 1, speed: 1, pattern: "school", palette: "tropical" },

      lights: DEFAULT_LIGHTS,

      brush: { radius: 6, density: 24, scale: 1 },

      past: [],
      future: [],

      selectedId: null,
      transformMode: "translate",
      activePlantId: null,
      activeGround: null,
      tool: "select",
      sculptDir: 1,
      placingMaterialId: null,
      placingSeed: 0,

      setTank: (dims) => {
        get().pushHistory();
        set({ tank: dims });
      },
      setSubstrate: (patch) => {
        get().pushHistory();
        set((s) => {
          const next = { ...s.substrate, ...patch };
          // Changing the front/back depth redefines the base slope → reseed the
          // sculpted field to a clean linear ramp (sculpt detail is intentional
          // to discard here; that's what "set the slope" means).
          if (patch.depthFront !== undefined || patch.depthBack !== undefined) {
            const { nx, nz } = fieldGrid(s.tank.width, s.tank.depth);
            next.field = makeLinearField(nx, nz, next.depthFront, next.depthBack);
          }
          return { substrate: next };
        });
      },
      setStyle: (style) => {
        get().pushHistory();
        set({ style });
      },
      setBackground: (patch) => {
        get().pushHistory();
        set((s) => ({ background: { ...s.background, ...patch } }));
      },
      setAmbience: (color) => set({ ambience: color }),

      addHardscape: (materialId, position = [0, 0, 0], seed) => {
        const mat = getMaterial(materialId);
        if (!mat) return;
        get().pushHistory();
        const item: HardscapeItem = {
          id: genId(),
          materialId,
          kind: mat.kind,
          position,
          rotation: [0, 0, 0],
          scale: mat.kind === "wood" ? 14 : 10,
          seed: seed ?? Math.floor(Math.random() * 1e9),
        };
        set((s) => ({
          hardscape: [...s.hardscape, item],
          selectedId: item.id,
          placingMaterialId: null,
          tool: s.tool === "place" ? "select" : s.tool,
        }));
      },
      addGeneratedHardscape: (partial) => {
        get().pushHistory();
        const id = genId();
        const item: HardscapeItem = {
          id,
          materialId: partial.materialId ?? "",
          kind: partial.kind,
          source: partial.source,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: partial.scale ?? (partial.kind === "wood" ? 14 : 10),
          seed: Math.floor(Math.random() * 1e9),
          drift: partial.drift,
          meshId: partial.meshId,
          color: partial.color,
          textureId: partial.textureId,
        };
        set((s) => ({
          hardscape: [...s.hardscape, item],
          selectedId: id,
          placingMaterialId: null,
          tool: s.tool === "place" ? "select" : s.tool,
        }));
        return id;
      },
      updateHardscape: (id, patch) => {
        get().pushHistory();
        set((s) => ({
          hardscape: s.hardscape.map((h) =>
            h.id === id ? { ...h, ...patch } : h,
          ),
        }));
      },
      removeHardscape: (id) => {
        get().pushHistory();
        set((s) => ({
          hardscape: s.hardscape.filter((h) => h.id !== id),
          selectedId: s.selectedId === id ? null : s.selectedId,
        }));
      },
      duplicateHardscape: (id) => {
        const src = get().hardscape.find((h) => h.id === id);
        if (!src) return;
        get().pushHistory();
        const copy: HardscapeItem = {
          ...src,
          id: genId(),
          position: [src.position[0] + 5, src.position[1], src.position[2] + 5],
          seed: Math.floor(Math.random() * 1e9),
        };
        set((s) => ({ hardscape: [...s.hardscape, copy], selectedId: copy.id }));
      },
      setCustomMesh: (id, data) =>
        set((s) => ({ customMeshes: { ...s.customMeshes, [id]: data } })),
      clearCustomMesh: (id) =>
        set((s) => {
          const next = { ...s.customMeshes };
          delete next[id];
          return { customMeshes: next };
        }),

      beginPlacing: (materialId) =>
        set({
          placingMaterialId: materialId,
          placingSeed: Math.floor(Math.random() * 1e9),
          tool: "place",
          activePlantId: null,
          activeGround: null,
          selectedId: null,
        }),
      cancelPlacing: () =>
        set((s) => ({
          placingMaterialId: null,
          tool: s.tool === "place" ? "select" : s.tool,
        })),

      selectItem: (id) => set({ selectedId: id }),
      setTransformMode: (mode) => set({ transformMode: mode }),

      setActivePlant: (speciesId) =>
        set((s) => ({
          activePlantId: speciesId,
          activeGround: null,
          placingMaterialId: null,
          tool: speciesId ? "plant" : "select",
          selectedId: speciesId ? null : s.selectedId,
        })),
      setActiveGround: (type) =>
        set((s) => ({
          activeGround: type,
          activePlantId: null,
          placingMaterialId: null,
          tool: type ? "ground" : "select",
          selectedId: type ? null : s.selectedId,
        })),
      setTool: (tool) =>
        set({
          tool,
          ...(tool === "select"
            ? { activePlantId: null, activeGround: null, placingMaterialId: null }
            : {}),
        }),
      setBrush: (patch) => set((s) => ({ brush: { ...s.brush, ...patch } })),
      setSculptDir: (dir) => set({ sculptDir: dir }),
      sculptSubstrate: (px, pz) => {
        get().pushHistory(); // suppressed mid-stroke (one undo per drag)
        set((s) => {
          const { tank, substrate, brush, sculptDir } = s;
          const innerW = tank.width * 0.98;
          const innerD = tank.depth * 0.98;
          const { nx, nz } = fieldGrid(tank.width, tank.depth);
          const field =
            substrate.field ??
            makeLinearField(nx, nz, substrate.depthFront, substrate.depthBack);
          const strength = Math.max(0.6, brush.radius * 0.18) * sculptDir;
          const next = sculptField(
            field,
            substrate.type,
            innerW,
            innerD,
            px,
            pz,
            brush.radius,
            strength,
            tank.height * 0.85,
          );
          return { substrate: { ...substrate, field: next } };
        });
      },
      addPlantPatch: (speciesId, position, blades) => {
        get().pushHistory();
        const { radius, density, scale } = get().brush;
        const patch: PlantPlacement = {
          id: genId(),
          speciesId,
          position,
          radius,
          density,
          scale,
          blades,
        };
        set((s) => ({ plants: [...s.plants, patch] }));
      },
      removePlant: (id) => {
        get().pushHistory();
        set((s) => ({ plants: s.plants.filter((p) => p.id !== id) }));
      },
      setPlantTexture: (speciesId, dataUrl) =>
        set((s) => ({
          customPlantTextures: { ...s.customPlantTextures, [speciesId]: dataUrl },
        })),
      clearPlantTexture: (speciesId) =>
        set((s) => {
          const next = { ...s.customPlantTextures };
          delete next[speciesId];
          return { customPlantTextures: next };
        }),
      addGroundPatch: (type, position) => {
        get().pushHistory();
        const patch: GroundPatch = {
          id: genId(),
          type,
          position,
          radius: get().brush.radius,
        };
        set((s) => ({ ground: [...s.ground, patch] }));
      },

      setMode: (mode) => set({ mode, selectedId: null }),
      setQuality: (q) => set({ quality: q }),
      toggleGuides: () => set((s) => ({ showGuides: !s.showGuides })),
      setGuides: (patch) => set((s) => ({ guides: { ...s.guides, ...patch } })),
      setGrowth: (v) => set({ growth: Math.max(0, Math.min(1, v)) }),
      setGrade: (patch) => set((s) => ({ grade: { ...s.grade, ...patch } })),
      resetGrade: () => set({ grade: DEFAULT_GRADE }),
      toggleZen: () => set((s) => ({ zen: !s.zen, selectedId: null })),
      setFish: (patch) => set((s) => ({ fish: { ...s.fish, ...patch } })),

      addLight: (type) =>
        set((s) => {
          const base = {
            id: genId(),
            type,
            x: 0,
            z: 0,
            height: Math.round(s.tank.height * 0.5),
            intensity: 1,
            on: true,
          };
          const fixture: LightFixture =
            type === "rgb"
              ? { ...base, kelvin: 6500, color: "#48e0c0" }
              : { ...base, kelvin: type === "spot" ? 5200 : 6500, color: "#ffffff" };
          return { lights: [...s.lights, fixture] };
        }),
      updateLight: (id, patch) =>
        set((s) => ({
          lights: s.lights.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),
      removeLight: (id) =>
        set((s) => ({ lights: s.lights.filter((l) => l.id !== id) })),

      loadLayout: (layout) => {
        get().pushHistory();
        set({
          tank: layout.tank,
          substrate: layout.substrate,
          style: layout.style,
          hardscape: layout.hardscape,
          plants: layout.plants,
          ground: layout.ground ?? [],
          background: layout.background ?? DEFAULT_BACKGROUND,
          customMeshes: layout.customMeshes ?? {},
          // v2 look (each defaults so v1 files still load cleanly)
          ambience: layout.ambience ?? DEFAULT_AMBIENCE,
          lights: layout.lights ?? DEFAULT_LIGHTS,
          fish: layout.fish ?? DEFAULT_FISH,
          grade: layout.grade ?? DEFAULT_GRADE,
          growth: layout.growth ?? 0.25,
          guides: layout.guides ?? { face: "front", ratio: "both" },
          mode: layout.mode ?? "design",
          customPlantTextures: layout.customPlantTextures ?? {},
          selectedId: null,
        });
      },
      getLayout: () => {
        const s = get();
        // Only export the height fields / photos still referenced by a piece.
        const usedMesh = new Set(
          s.hardscape.map((h) => h.meshId).filter(Boolean) as string[],
        );
        const customMeshes = Object.fromEntries(
          Object.entries(s.customMeshes).filter(([id]) => usedMesh.has(id)),
        );
        const usedPlant = new Set(s.plants.map((p) => p.speciesId));
        const customPlantTextures = Object.fromEntries(
          Object.entries(s.customPlantTextures).filter(([id]) =>
            usedPlant.has(id),
          ),
        );
        return {
          version: 2,
          tank: s.tank,
          substrate: s.substrate,
          style: s.style,
          hardscape: s.hardscape,
          plants: s.plants,
          ground: s.ground,
          background: s.background,
          customMeshes,
          ambience: s.ambience,
          lights: s.lights,
          fish: s.fish,
          grade: s.grade,
          growth: s.growth,
          guides: s.guides,
          mode: s.mode,
          customPlantTextures,
        };
      },
      reset: () => {
        get().pushHistory();
        set({
          tank: DEFAULT_TANK,
          substrate: DEFAULT_SUBSTRATE,
          style: null,
          hardscape: [],
          plants: [],
          ground: [],
          background: DEFAULT_BACKGROUND,
          selectedId: null,
        });
      },

      // ---- undo / redo ----
      // pushHistory() records the current scape as a restore point, unless a
      // gesture transaction is open (then the whole gesture is one step).
      pushHistory: () => {
        if (historyTxnOpen) return;
        set((s) => ({
          past: [...s.past, sceneSnapshot(s)].slice(-HISTORY_LIMIT),
          future: [],
        }));
      },
      beginTxn: () => {
        historyTxnOpen = true;
        txnPre = sceneSnapshot(get());
      },
      endTxn: () => {
        historyTxnOpen = false;
        const pre = txnPre;
        txnPre = null;
        if (!pre) return;
        const cur = sceneSnapshot(get());
        // Skip no-op gestures (e.g. a click that didn't move/paint anything).
        if (JSON.stringify(pre) === JSON.stringify(cur)) return;
        set((s) => ({
          past: [...s.past, pre].slice(-HISTORY_LIMIT),
          future: [],
        }));
      },
      undo: () => {
        const { past } = get();
        if (!past.length) return;
        const prev = past[past.length - 1];
        set((s) => ({
          ...prev,
          past: s.past.slice(0, -1),
          future: [sceneSnapshot(s), ...s.future],
          selectedId: null,
        }));
      },
      redo: () => {
        const { future } = get();
        if (!future.length) return;
        const next = future[0];
        set((s) => ({
          ...next,
          past: [...s.past, sceneSnapshot(s)],
          future: s.future.slice(1),
          selectedId: null,
        }));
      },
    }),
    {
      name: "aquascape-studio:layout",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage,
      ),
      // Persist scene data + view settings, never transient editor state.
      partialize: (s) => ({
        tank: s.tank,
        substrate: s.substrate,
        style: s.style,
        hardscape: s.hardscape,
        plants: s.plants,
        ground: s.ground,
        background: s.background,
        ambience: s.ambience,
        customPlantTextures: s.customPlantTextures,
        customMeshes: s.customMeshes,
        mode: s.mode,
        quality: s.quality,
        showGuides: s.showGuides,
        guides: s.guides,
        growth: s.growth,
        grade: s.grade,
        lights: s.lights,
        fish: s.fish,
        brush: s.brush,
      }),
      version: 6,
      migrate: (persisted: unknown, version: number) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        if (version < 1) {
          if (typeof s.growth !== "number") {
            s.growth = s.grownIn === true ? 1 : 0.25;
          }
          delete s.grownIn;
          if (!Array.isArray(s.lights)) {
            s.lights = DEFAULT_LIGHTS;
          }
        }
        if (version < 2) {
          s.background = DEFAULT_BACKGROUND;
        }
        if (version < 3) {
          s.ambience = DEFAULT_AMBIENCE;
        }
        if (version < 4) {
          s.grade = DEFAULT_GRADE;
        }
        if (version < 5) {
          if (typeof s.customMeshes !== "object" || s.customMeshes === null) {
            s.customMeshes = {};
          }
        }
        if (version < 6) {
          s.guides = { face: "front", ratio: "both" };
        }
        return s as unknown as StudioState;
      },
    },
  ),
);
