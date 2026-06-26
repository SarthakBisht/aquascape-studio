// "Clean & Polish" — one-click tidy + fill of a scape, driven by the baked
// composition rules (see src/data/stylePresets.ts). Pure & data-light (only
// ./terrain + ./types, both relative) so it has a node-runnable self-check and
// can never touch GPU/store state directly — the store wires state in/out.
//
// What it does (the user picked "Polish + fill", style-driven):
//   1. Tidy hardscape — pull any piece sitting OUTSIDE the glass back inside its
//      footprint, reseat every piece on the substrate top, and nudge a near-
//      centered dominant stone onto the nearest rule-of-thirds line (focal point).
//   2. If the scape has no hardscape (and the style isn't plant-led Dutch), seed
//      an odd cluster of stones (Iwagumi Oyaishi + two supporting stones).
//   3. Fill the plant layers the scape is *missing* for its style (carpet front,
//      midground, background back), seating every blade on the real surface.
// Existing work is preserved: layers already planted are left alone.

import type {
  AquascapeStyle,
  Blade,
  HardscapeItem,
  PlantCategory,
  PlantPlacement,
  PlantSpecies,
  SubstrateConfig,
  TankDimensions,
  Vec3,
} from "./types";
import { fieldGrid, makeLinearField, sampleField } from "./terrain";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const clamp01 = (v: number) => clamp(v, 0, 1);

/** Plant layers (front +z → back −z) to ensure present, per style. zFrac is the
 *  band's z as a fraction of tank depth (+0.5 = front glass, −0.5 = back). */
const FILL_PLANS: Record<AquascapeStyle, { category: PlantCategory; zFrac: number }[]> = {
  // Rock-led: a carpet sweeping the front + midground floor, nothing tall.
  iwagumi: [
    { category: "carpet", zFrac: 0.24 },
    { category: "carpet", zFrac: 0.0 },
  ],
  // Layered landscape: carpet → midground → background.
  nature: [
    { category: "carpet", zFrac: 0.28 },
    { category: "midground", zFrac: 0.05 },
    { category: "background", zFrac: -0.28 },
  ],
  // Plant-led "streets": terraced midground + background stems, little hardscape.
  dutch: [
    { category: "midground", zFrac: 0.12 },
    { category: "background", zFrac: -0.06 },
    { category: "background", zFrac: -0.26 },
  ],
};

/** Rough horizontal footprint radius (cm) of a placed piece. Rock geometry is a
 *  unit-radius blob × scale; wood is thinner. */
function footprintR(it: Pick<HardscapeItem, "scale" | "kind">): number {
  return it.scale * (it.kind === "wood" ? 0.5 : 0.85);
}

export interface CleanInput {
  tank: TankDimensions;
  substrate: SubstrateConfig;
  style: AquascapeStyle | null;
  hardscape: HardscapeItem[];
  plants: PlantPlacement[];
  /** Built-in + custom species (built-ins first) — for category lookup & picking. */
  species: PlantSpecies[];
  newId: () => string;
  /** Injectable RNG for deterministic tests; defaults to Math.random. */
  rng?: () => number;
}

export interface CleanResult {
  hardscape: HardscapeItem[];
  plants: PlantPlacement[];
  addedStones: number;
  addedPatches: number;
  /** Pieces (hardscape + plant patches) removed for sitting outside the glass. */
  removed: number;
}

export function cleanScape(input: CleanInput): CleanResult {
  const { tank, substrate, hardscape, plants, species, newId } = input;
  const rng = input.rng ?? Math.random;
  const style: AquascapeStyle = input.style ?? "nature";
  const { width: w, depth: d } = tank;

  // --- substrate height sampler (world (x,z) → soil top y) ---
  const innerW = w * 0.98;
  const innerD = d * 0.98;
  const { nx, nz } = fieldGrid(w, d);
  const field =
    substrate.field ??
    makeLinearField(nx, nz, substrate.depthFront, substrate.depthBack);
  const surfaceY = (x: number, z: number) =>
    sampleField(field, clamp01(x / innerW + 0.5), clamp01(0.5 - z / innerD));

  // --- 1. tidy hardscape: DROP anything sitting outside the glass, reseat the
  //         rest on the substrate, and nudge the focal stone onto a thirds line.
  //         (Pieces outside the tank are removed, not relocated inside.) ---
  const halfW = w / 2;
  const halfD = d / 2;
  const inside = (p: Vec3) => Math.abs(p[0]) <= halfW && Math.abs(p[2]) <= halfD;

  const kept = hardscape.filter((it) => inside(it.position));
  const removed = hardscape.length - kept.length;

  let domId: string | null = null;
  let domScale = -Infinity;
  for (const it of kept)
    if (it.scale > domScale) ((domScale = it.scale), (domId = it.id));
  const thirdsX = w / 6; // a rule-of-thirds line, measured from center

  const tidied = kept.map((it) => {
    let x = it.position[0];
    const z = it.position[2];
    // Only re-place a dominant stone that's sitting dead-center — a deliberately
    // off-center focal point is left where the user put it.
    if (it.id === domId && Math.abs(x) < w * 0.1) {
      const mx = Math.max(0, halfW - footprintR(it) - w * 0.03);
      x = clamp(x >= 0 ? thirdsX : -thirdsX, -mx, mx);
    }
    return { ...it, position: [x, surfaceY(x, z), z] as Vec3 };
  });

  // --- 2. seed a stone cluster when the scape has no hardscape (skip plant-led Dutch) ---
  const stones: HardscapeItem[] = [];
  if (hardscape.length === 0 && style !== "dutch") {
    const base = (w + d) / 2;
    // Asymmetric odd cluster: a main stone on the left third + two supporters.
    const cluster = [
      { fx: -0.18, fz: -0.05, sMul: 0.24 }, // Oyaishi (main)
      { fx: -0.04, fz: 0.12, sMul: 0.13 }, // Soeishi
      { fx: 0.2, fz: -0.1, sMul: 0.17 }, // Fukuishi
    ];
    for (const c of cluster) {
      const x = w * c.fx;
      const z = d * c.fz;
      stones.push({
        id: newId(),
        materialId: "seiryu",
        kind: "rock",
        position: [x, surfaceY(x, z), z],
        rotation: [0, 0, 0],
        scale: Math.max(5, base * c.sMul),
        seed: Math.floor(rng() * 1e9),
      });
    }
  }

  const allStones = [...tidied, ...stones];

  // --- 3. fill the plant layers this style is missing ---
  // Drop any patch painted outside the glass too; fill is based on what's left.
  const keptPlants = plants.filter((p) => inside(p.position));
  const present = new Set<PlantCategory>();
  for (const p of keptPlants) {
    const sp = species.find((s) => s.id === p.speciesId);
    if (sp) present.add(sp.category);
  }

  const PATCH_R = clamp(w * 0.12, 5, 12);
  const DENSITY = 22;
  const usableHalf = w * 0.4;

  const nearStone = (x: number, z: number) =>
    allStones.some((s) => {
      const dx = x - s.position[0];
      const dz = z - s.position[2];
      return Math.hypot(dx, dz) < footprintR(s) + PATCH_R * 0.5;
    });

  const makeBlades = (cx: number, cz: number): Blade[] => {
    const out: Blade[] = [];
    for (let i = 0; i < DENSITY; i++) {
      const ang = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * PATCH_R;
      const bx = Math.cos(ang) * r;
      const bz = Math.sin(ang) * r;
      out.push({
        x: bx,
        z: bz,
        y: surfaceY(cx + bx, cz + bz),
        yaw: rng() * Math.PI * 2,
        lean: (rng() - 0.5) * 0.55,
        hMul: 0.5 + rng() * 1.1,
      });
    }
    return out;
  };

  const newPatches: PlantPlacement[] = [];
  for (const plan of FILL_PLANS[style]) {
    if (present.has(plan.category)) continue; // user already planted this layer
    const sp = species.find((s) => s.category === plan.category);
    if (!sp) continue;
    const count = clamp(Math.round(w / 22), 2, 6);
    const cz = plan.zFrac * d;
    for (let k = 0; k < count; k++) {
      const t = count === 1 ? 0.5 : k / (count - 1);
      const x = (t - 0.5) * 2 * usableHalf + (rng() - 0.5) * (w / count) * 0.4;
      const z = cz + (rng() - 0.5) * d * 0.06;
      if (nearStone(x, z)) continue; // don't bury a patch in a rock
      newPatches.push({
        id: newId(),
        speciesId: sp.id,
        position: [x, surfaceY(x, z), z],
        radius: PATCH_R,
        density: DENSITY,
        scale: 1,
        blades: makeBlades(x, z),
      });
    }
  }

  return {
    hardscape: allStones,
    plants: [...keptPlants, ...newPatches],
    addedStones: stones.length,
    addedPatches: newPatches.length,
    removed: removed + (plants.length - keptPlants.length),
  };
}

// --- node-runnable self-check (run the file directly) ---
function demo() {
  const tank: TankDimensions = { width: 60, depth: 30, height: 36 };
  const substrate: SubstrateConfig = { type: "aquasoil", depthFront: 3, depthBack: 7 };
  const species: PlantSpecies[] = [
    { id: "carpet1", name: "C", latin: "", category: "carpet", form: "blade", difficulty: "easy", growth: "medium", light: "high", co2: false, heightCm: [2, 4], color: "#0f0" },
    { id: "mid1", name: "M", latin: "", category: "midground", form: "rosette", difficulty: "easy", growth: "slow", light: "low", co2: false, heightCm: [10, 20], color: "#0a0" },
    { id: "bg1", name: "B", latin: "", category: "background", form: "stem", difficulty: "easy", growth: "fast", light: "high", co2: false, heightCm: [20, 45], color: "#3a3" },
  ];
  let n = 0;
  const newId = () => `id${n++}`;
  const rng = (() => {
    let a = 12345;
    return () => ((a = (a * 1103515245 + 12345) & 0x7fffffff), a / 0x7fffffff);
  })();

  // Empty nature scape → stones seeded + all three layers filled, all seated.
  const r = cleanScape({ tank, substrate, style: "nature", hardscape: [], plants: [], species, newId, rng });
  if (r.addedStones !== 3) throw new Error(`expected 3 stones, got ${r.addedStones}`);
  if (r.addedPatches < 3) throw new Error(`expected fill patches, got ${r.addedPatches}`);
  for (const it of r.hardscape) {
    if (Math.abs(it.position[0]) > tank.width / 2) throw new Error("stone outside glass");
    if (!Number.isFinite(it.position[1])) throw new Error("stone NaN y");
  }
  for (const p of r.plants)
    for (const b of p.blades ?? [])
      if (!Number.isFinite(b.y)) throw new Error("blade NaN y");

  // A piece dumped outside the glass is REMOVED (not relocated inside). The
  // scape started non-empty, so no replacement stones are seeded.
  const stray: HardscapeItem = {
    id: "stray", materialId: "seiryu", kind: "rock",
    position: [500, 0, -400], rotation: [0, 0, 0], scale: 10, seed: 1,
  };
  const r2 = cleanScape({ tank, substrate, style: "nature", hardscape: [stray], plants: [], species, newId, rng });
  if (r2.hardscape.length !== 0) throw new Error("stray piece not removed");
  if (r2.removed !== 1) throw new Error(`expected removed=1, got ${r2.removed}`);

  // An inside piece is kept (and reseated), not removed.
  const inRock: HardscapeItem = {
    id: "in", materialId: "seiryu", kind: "rock",
    position: [10, 0, 4], rotation: [0, 0, 0], scale: 10, seed: 2,
  };
  const r4 = cleanScape({ tank, substrate, style: "nature", hardscape: [inRock], plants: [], species, newId, rng });
  if (!r4.hardscape.some((h) => h.id === "in")) throw new Error("inside piece was dropped");
  if (r4.hardscape.find((h) => h.id === "in")!.position[1] <= 0)
    throw new Error("inside piece not reseated on substrate");

  // Existing layer is respected: a scape that already has a carpet gets no extra carpet.
  const r3 = cleanScape({
    tank, substrate, style: "nature",
    hardscape: [stray],
    plants: [{ id: "p", speciesId: "carpet1", position: [0, 5, 5], radius: 6, density: 10 }],
    species, newId, rng,
  });
  if (r3.plants.some((p) => p.id.startsWith("id") && p.speciesId === "carpet1"))
    throw new Error("added carpet despite existing carpet");

  console.log("autoScape demo OK", { stones: r.addedStones, patches: r.addedPatches });
}

if (
  typeof process !== "undefined" &&
  process.argv?.[1] &&
  process.argv[1].includes("autoScape")
) {
  demo();
}
