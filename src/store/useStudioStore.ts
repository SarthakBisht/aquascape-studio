import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AquascapeStyle,
  BackgroundConfig,
  Blade,
  FishConfig,
  FixtureType,
  GroundPatch,
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
import { getMaterial } from "@/data/hardscapeMaterials";
import { TANK_PRESETS, DEFAULT_TANK_ID } from "@/data/tankPresets";
import { DEFAULT_BACKGROUND } from "@/data/backgrounds";

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
  /** Per-species custom billboard image (speciesId → PNG data URL). */
  customPlantTextures: Record<string, string>;

  // ---- persisted view settings ----
  mode: ViewMode;
  quality: Quality;
  showGuides: boolean;
  growth: number; // 0 = just planted, 1 = fully grown-in
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
  tool: "select" | "plant" | "ground" | "place";
  placingMaterialId: string | null; // rock armed for ghost placement (transient)
  placingSeed: number; // shape seed shared by ghost + committed rock (transient)

  // ---- actions ----
  setTank: (dims: TankDimensions) => void;
  setSubstrate: (patch: Partial<SubstrateConfig>) => void;
  setStyle: (style: AquascapeStyle | null) => void;
  setBackground: (patch: Partial<BackgroundConfig>) => void;

  addHardscape: (materialId: string, position?: Vec3, seed?: number) => void;
  updateHardscape: (id: string, patch: Partial<HardscapeItem>) => void;
  removeHardscape: (id: string) => void;
  duplicateHardscape: (id: string) => void;
  beginPlacing: (materialId: string) => void;
  cancelPlacing: () => void;

  selectItem: (id: string | null) => void;
  setTransformMode: (mode: TransformMode) => void;

  setActivePlant: (speciesId: string | null) => void;
  setActiveGround: (type: SubstrateType | null) => void;
  setTool: (tool: "select" | "plant" | "ground" | "place") => void;
  setBrush: (patch: Partial<StudioState["brush"]>) => void;
  addPlantPatch: (speciesId: string, position: Vec3, blades?: Blade[]) => void;
  removePlant: (id: string) => void;
  setPlantTexture: (speciesId: string, dataUrl: string) => void;
  clearPlantTexture: (speciesId: string) => void;
  addGroundPatch: (type: SubstrateType, position: Vec3) => void;

  setMode: (mode: ViewMode) => void;
  setQuality: (q: Quality) => void;
  toggleGuides: () => void;
  setGrowth: (v: number) => void;
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
      customPlantTextures: {},

      mode: "design",
      quality: "medium",
      showGuides: true,
      growth: 0.25,
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
      placingMaterialId: null,
      placingSeed: 0,

      setTank: (dims) => {
        get().pushHistory();
        set({ tank: dims });
      },
      setSubstrate: (patch) => {
        get().pushHistory();
        set((s) => ({ substrate: { ...s.substrate, ...patch } }));
      },
      setStyle: (style) => {
        get().pushHistory();
        set({ style });
      },
      setBackground: (patch) => {
        get().pushHistory();
        set((s) => ({ background: { ...s.background, ...patch } }));
      },

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
      setGrowth: (v) => set({ growth: Math.max(0, Math.min(1, v)) }),
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
          selectedId: null,
        });
      },
      getLayout: () => {
        const s = get();
        return {
          version: 1,
          tank: s.tank,
          substrate: s.substrate,
          style: s.style,
          hardscape: s.hardscape,
          plants: s.plants,
          ground: s.ground,
          background: s.background,
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
        customPlantTextures: s.customPlantTextures,
        mode: s.mode,
        quality: s.quality,
        showGuides: s.showGuides,
        growth: s.growth,
        lights: s.lights,
        fish: s.fish,
        brush: s.brush,
      }),
      version: 1,
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
        return s as unknown as StudioState;
      },
    },
  ),
);
