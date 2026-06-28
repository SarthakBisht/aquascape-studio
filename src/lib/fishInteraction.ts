// Shared, render-free singletons for the underwater fish interactions (Feed /
// Follow cursor) — mirrors `surfaceInteraction.hover`: module-level state written
// on pointer events and read imperatively inside useFrame, so per-frame food /
// pointer motion never triggers a React render. Dependency-free (plain {x,y,z}
// numbers, no three) so it stays node-runnable for the self-check below.

/** Current cursor target inside the tank (world cm). Drives Follow-cursor mode. */
export const pointer = { x: 0, y: 0, z: 0, active: false };

export interface Pellet {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  born: number; // ms timestamp
  eaten: boolean;
}

/** Live food pellets, mutated in place so held references stay valid. */
export const food: Pellet[] = [];

/** Bumped on every drop so Fish can re-roll which fish join the feeding swarm. */
let foodEpoch = 0;
export function getFoodEpoch() {
  return foodEpoch;
}

const PELLET_LIFETIME = 12000; // ms
const SINK = 3; // cm/s downward drift

/** Render-pool cap — keep the live pellet count bounded (matches FoodParticles). */
export const MAX_PELLETS = 80;

/** Drop a small cluster of pellets at a world point. */
export function addFood(x: number, y: number, z: number, now = Date.now()) {
  if (food.length >= MAX_PELLETS) return; // pool full — ignore until some clear
  const n = 6 + Math.floor(Math.random() * 5); // 6..10
  for (let i = 0; i < n; i++) {
    food.push({
      x: x + (Math.random() - 0.5) * 3,
      y: y + (Math.random() - 0.5) * 2,
      z: z + (Math.random() - 0.5) * 3,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -SINK * (0.6 + Math.random() * 0.8),
      vz: (Math.random() - 0.5) * 1.5,
      born: now,
      eaten: false,
    });
  }
  foodEpoch++;
}

/** Advance pellet motion + cull eaten / sunk / expired ones. Returns live count. */
export function integrateFood(dt: number, floorY: number, now = Date.now()) {
  for (let i = food.length - 1; i >= 0; i--) {
    const p = food[i];
    if (p.eaten || p.y < floorY || now - p.born > PELLET_LIFETIME) {
      food.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    // damp the horizontal drift so pellets settle into a gentle fall
    p.vx *= 0.96;
    p.vz *= 0.96;
  }
  return food.length;
}

/** Test-only: empty the food list + reset epoch. */
export function clearFood() {
  food.length = 0;
  foodEpoch = 0;
}

// --- node-runnable self-check (run the file directly) ---
function demo() {
  clearFood();
  const e0 = getFoodEpoch();
  addFood(0, 30, 0, 1000);
  if (food.length < 6) throw new Error(`addFood didn't seed pellets: ${food.length}`);
  if (getFoodEpoch() !== e0 + 1) throw new Error("foodEpoch not bumped");

  // an eaten pellet is culled
  food[0].eaten = true;
  const before = food.length;
  integrateFood(0.1, -100, 1100);
  if (food.length !== before - 1) throw new Error("eaten pellet not removed");

  // expired pellets (older than lifetime) are culled
  integrateFood(0.1, -100, 1000 + 12001);
  if (food.length !== 0) throw new Error("expired pellets not removed");

  // sunk pellets (below floor) are culled
  addFood(0, 5, 0, 2000);
  integrateFood(0.1, 10, 2100); // floorY=10 > pellet y≈5 → all removed
  if (food.length !== 0) throw new Error("sunk pellets not removed");

  clearFood();
  console.log("fishInteraction demo OK");
}

if (
  typeof process !== "undefined" &&
  process.argv?.[1] &&
  process.argv[1].includes("fishInteraction")
) {
  demo();
}
