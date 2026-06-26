// "Clean" — one-click tidy. Removes only the pieces left sitting OUTSIDE the
// glass (hardscape, plant patches, painted ground); everything inside is left
// exactly as the user placed it. Nothing is added, reseated, or nudged. Pure &
// dependency-free (only ./types) so it has a node-runnable self-check and never
// touches GPU/store state — the store wires state in and out.

import type {
  GroundPatch,
  HardscapeItem,
  PlantPlacement,
  TankDimensions,
  Vec3,
} from "./types";

export interface CleanInput {
  tank: TankDimensions;
  hardscape: HardscapeItem[];
  plants: PlantPlacement[];
  ground: GroundPatch[];
}

export interface CleanResult {
  hardscape: HardscapeItem[];
  plants: PlantPlacement[];
  ground: GroundPatch[];
  /** Pieces (hardscape + plants + ground) removed for sitting outside the glass. */
  removed: number;
}

export function cleanScape(input: CleanInput): CleanResult {
  const { tank, hardscape, plants, ground } = input;
  const halfW = tank.width / 2;
  const halfD = tank.depth / 2;
  const inside = (p: Vec3) => Math.abs(p[0]) <= halfW && Math.abs(p[2]) <= halfD;

  const keptHardscape = hardscape.filter((it) => inside(it.position));
  const keptPlants = plants.filter((p) => inside(p.position));
  const keptGround = ground.filter((p) => inside(p.position));

  const removed =
    hardscape.length -
    keptHardscape.length +
    (plants.length - keptPlants.length) +
    (ground.length - keptGround.length);

  return {
    hardscape: keptHardscape,
    plants: keptPlants,
    ground: keptGround,
    removed,
  };
}

// --- node-runnable self-check (run the file directly) ---
function demo() {
  const tank: TankDimensions = { width: 60, depth: 30, height: 36 };
  const mkRock = (id: string, x: number, z: number): HardscapeItem => ({
    id, materialId: "seiryu", kind: "rock",
    position: [x, 0, z], rotation: [0, 0, 0], scale: 10, seed: 1,
  });
  const inRock = mkRock("in", 10, 4); // inside
  const outRock = mkRock("out", 500, -400); // outside
  const inPlant: PlantPlacement = { id: "p", speciesId: "c", position: [0, 5, 5], radius: 6, density: 10 };
  const outPlant: PlantPlacement = { id: "po", speciesId: "c", position: [-90, 5, 5], radius: 6, density: 10 };
  const inGround: GroundPatch = { id: "g", type: "sand", position: [5, 3, 0], radius: 6 };
  const outGround: GroundPatch = { id: "go", type: "sand", position: [0, 3, 99], radius: 6 };

  const r = cleanScape({
    tank,
    hardscape: [inRock, outRock],
    plants: [inPlant, outPlant],
    ground: [inGround, outGround],
  });
  if (r.removed !== 3) throw new Error(`expected removed=3, got ${r.removed}`);
  if (!r.hardscape.some((h) => h.id === "in")) throw new Error("inside rock dropped");
  if (r.hardscape.some((h) => h.id === "out")) throw new Error("outside rock kept");
  if (!r.plants.some((p) => p.id === "p")) throw new Error("inside plant dropped");
  if (r.ground.some((g) => g.id === "go")) throw new Error("outside ground kept");
  // Nothing added & inside pieces untouched (same object refs, no reseat).
  if (r.hardscape.find((h) => h.id === "in") !== inRock) throw new Error("inside rock mutated");

  console.log("autoScape demo OK", { removed: r.removed });
}

if (
  typeof process !== "undefined" &&
  process.argv?.[1] &&
  process.argv[1].includes("autoScape")
) {
  demo();
}
