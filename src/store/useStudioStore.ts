import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AquascapeStyle,
  BackgroundConfig,
  Blade,
  GroundPatch,
  HardscapeItem,
  Layout,
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

interface StudioState {
  // ---- persisted scene data ----
  tank: TankDimensions;
  substrate: SubstrateConfig;
  style: AquascapeStyle | null;
  hardscape: HardscapeItem[];
  plants: PlantPlacement[];
  ground: GroundPatch[];
  background: BackgroundConfig;

  // ---- persisted view settings ----
  mode: ViewMode;
  quality: Quality;
  showGuides: boolean;
  grownIn: boolean;
  /** Zen mode dissolves the interface so only the scape remains. Transient. */
  zen: boolean;

  // ---- plant brush (size/density of newly painted patches) ----
  brush: { radius: number; density: number; scale: number };

  // ---- transient editor state (not persisted) ----
  selectedId: string | null;
  transformMode: TransformMode;
  activePlantId: string | null; // species "loaded" for the plant brush
  activeGround: SubstrateType | null; // material "loaded" for the draw brush
  tool: "select" | "plant" | "ground";

  // ---- actions ----
  setTank: (dims: TankDimensions) => void;
  setSubstrate: (patch: Partial<SubstrateConfig>) => void;
  setStyle: (style: AquascapeStyle | null) => void;
  setBackground: (patch: Partial<BackgroundConfig>) => void;

  addHardscape: (materialId: string) => void;
  updateHardscape: (id: string, patch: Partial<HardscapeItem>) => void;
  removeHardscape: (id: string) => void;
  duplicateHardscape: (id: string) => void;

  selectItem: (id: string | null) => void;
  setTransformMode: (mode: TransformMode) => void;

  setActivePlant: (speciesId: string | null) => void;
  setActiveGround: (type: SubstrateType | null) => void;
  setTool: (tool: "select" | "plant" | "ground") => void;
  setBrush: (patch: Partial<StudioState["brush"]>) => void;
  addPlantPatch: (speciesId: string, position: Vec3, blades?: Blade[]) => void;
  removePlant: (id: string) => void;
  addGroundPatch: (type: SubstrateType, position: Vec3) => void;

  setMode: (mode: ViewMode) => void;
  setQuality: (q: Quality) => void;
  toggleGuides: () => void;
  setGrownIn: (on: boolean) => void;
  toggleZen: () => void;

  loadLayout: (layout: Layout) => void;
  getLayout: () => Layout;
  reset: () => void;
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

      mode: "design",
      quality: "medium",
      showGuides: true,
      grownIn: false,
      zen: false,

      brush: { radius: 6, density: 24, scale: 1 },

      selectedId: null,
      transformMode: "translate",
      activePlantId: null,
      activeGround: null,
      tool: "select",

      setTank: (dims) => set({ tank: dims }),
      setSubstrate: (patch) =>
        set((s) => ({ substrate: { ...s.substrate, ...patch } })),
      setStyle: (style) => set({ style }),
      setBackground: (patch) =>
        set((s) => ({ background: { ...s.background, ...patch } })),

      addHardscape: (materialId) => {
        const mat = getMaterial(materialId);
        if (!mat) return;
        const item: HardscapeItem = {
          id: genId(),
          materialId,
          kind: mat.kind,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: mat.kind === "wood" ? 14 : 10,
          seed: Math.floor(Math.random() * 1e9),
        };
        set((s) => ({ hardscape: [...s.hardscape, item], selectedId: item.id }));
      },
      updateHardscape: (id, patch) =>
        set((s) => ({
          hardscape: s.hardscape.map((h) =>
            h.id === id ? { ...h, ...patch } : h,
          ),
        })),
      removeHardscape: (id) =>
        set((s) => ({
          hardscape: s.hardscape.filter((h) => h.id !== id),
          selectedId: s.selectedId === id ? null : s.selectedId,
        })),
      duplicateHardscape: (id) =>
        set((s) => {
          const src = s.hardscape.find((h) => h.id === id);
          if (!src) return {};
          const copy: HardscapeItem = {
            ...src,
            id: genId(),
            position: [src.position[0] + 5, src.position[1], src.position[2] + 5],
            seed: Math.floor(Math.random() * 1e9),
          };
          return { hardscape: [...s.hardscape, copy], selectedId: copy.id };
        }),

      selectItem: (id) => set({ selectedId: id }),
      setTransformMode: (mode) => set({ transformMode: mode }),

      setActivePlant: (speciesId) =>
        set((s) => ({
          activePlantId: speciesId,
          activeGround: null,
          tool: speciesId ? "plant" : "select",
          selectedId: speciesId ? null : s.selectedId,
        })),
      setActiveGround: (type) =>
        set((s) => ({
          activeGround: type,
          activePlantId: null,
          tool: type ? "ground" : "select",
          selectedId: type ? null : s.selectedId,
        })),
      setTool: (tool) =>
        set({
          tool,
          ...(tool === "select" ? { activePlantId: null, activeGround: null } : {}),
        }),
      setBrush: (patch) => set((s) => ({ brush: { ...s.brush, ...patch } })),
      addPlantPatch: (speciesId, position, blades) => {
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
      removePlant: (id) =>
        set((s) => ({ plants: s.plants.filter((p) => p.id !== id) })),
      addGroundPatch: (type, position) => {
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
      setGrownIn: (on) => set({ grownIn: on }),
      toggleZen: () => set((s) => ({ zen: !s.zen, selectedId: null })),

      loadLayout: (layout) =>
        set({
          tank: layout.tank,
          substrate: layout.substrate,
          style: layout.style,
          hardscape: layout.hardscape,
          plants: layout.plants,
          ground: layout.ground ?? [],
          background: layout.background ?? DEFAULT_BACKGROUND,
          selectedId: null,
        }),
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
      reset: () =>
        set({
          tank: DEFAULT_TANK,
          substrate: DEFAULT_SUBSTRATE,
          style: null,
          hardscape: [],
          plants: [],
          ground: [],
          background: DEFAULT_BACKGROUND,
          selectedId: null,
        }),
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
        mode: s.mode,
        quality: s.quality,
        showGuides: s.showGuides,
        grownIn: s.grownIn,
        brush: s.brush,
      }),
    },
  ),
);
