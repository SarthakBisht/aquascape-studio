// Per-plant "natural state": how each species grows + where it sits. Derived
// from the species' form / category / growth rate so plants behave like
// themselves (stems shoot up, carpets creep, mosses fill, epiphytes barely
// move, floaters ride the surface) — with a per-species `habit` override for
// the cases the rules miss (e.g. a water lily whose leaf stays put while the
// stem climbs). Pure + data-light so it has a node-runnable self-check.

import type { PlantSpecies, PlantForm, PlantCategory, GrowthRate, PlantHabit } from "./types";

// How much of the [minH,maxH] range the growth slider walks, by silhouette.
const HEIGHT_GAIN: Record<PlantForm, number> = {
  stem: 1.0, // tall stems reach their full height
  blade: 0.9, // grasses grow nearly full
  rosette: 0.65, // crypts/swords lengthen leaves moderately
  broadleaf: 0.4, // anubias-type leaves change little
  moss: 0.2, // mounds thicken more than they rise
  floating: 0.0, // height irrelevant — it sits on the surface
};

// How strongly "grown-in" fills the patch (more blades revealed), by role.
const FULLNESS_GAIN: Record<PlantCategory, number> = {
  carpet: 1.0,
  moss: 1.0,
  midground: 0.6,
  background: 0.5,
  epiphyte: 0.35, // slow, stays sparse
  floating: 0.7,
};

// Slow growers move less of their range per slider tick.
const RATE_SCALAR: Record<GrowthRate, number> = { slow: 0.5, medium: 0.8, fast: 1.0 };

/** Resolve a species' growth/placement character (defaults derived, `habit` wins). */
export function plantHabit(s: PlantSpecies): PlantHabit {
  const base: PlantHabit = {
    anchor: s.form === "floating" || s.category === "floating" ? "surface" : "substrate",
    heightGain: HEIGHT_GAIN[s.form],
    fullnessGain: FULLNESS_GAIN[s.category],
    leafScalesWithHeight: true,
    rateScalar: RATE_SCALAR[s.growth],
  };
  return { ...base, ...s.habit };
}

// ── self-check (run: npx tsx src/lib/plantHabit.ts) ────────────────────────
function demo() {
  const mk = (p: Partial<PlantSpecies>): PlantSpecies => ({
    id: "x", name: "x", latin: "x", category: "background", form: "stem",
    difficulty: "easy", growth: "medium", light: "medium", co2: false,
    heightCm: [10, 40], color: "#4f9a3f", ...p,
  });

  const stem = plantHabit(mk({ form: "stem", category: "background", growth: "fast" }));
  const carpet = plantHabit(mk({ form: "blade", category: "carpet", growth: "fast" }));
  const epi = plantHabit(mk({ form: "broadleaf", category: "epiphyte", growth: "slow" }));
  const floater = plantHabit(mk({ form: "floating", category: "floating" }));
  const lily = plantHabit(mk({ form: "broadleaf", habit: { leafScalesWithHeight: false } }));

  // a fast stem traverses more height than a fast carpet
  console.assert(stem.heightGain > carpet.heightGain, "stem should out-grow carpet");
  // a slow epiphyte changes less per slider than a fast stem
  console.assert(epi.heightGain * epi.rateScalar < stem.heightGain * stem.rateScalar, "epiphyte < stem");
  // floating plants anchor to the surface
  console.assert(floater.anchor === "surface", "floater anchors to surface");
  // override wins
  console.assert(lily.leafScalesWithHeight === false, "habit override applies");
  console.log("plantHabit self-check passed");
}

// node-only self-check; `module` is undefined in the browser ESM bundle, so
// guard on it too (Turbopack would otherwise ReferenceError on evaluation).
declare const module: unknown;
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module)
  demo();
