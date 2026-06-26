// Aquascaping calculators — pure math, no React / three / data deps (only the
// constants below). Mirrors the node-runnable self-check pattern in autoScape.ts.
// Base unit matches the scene: 1 cm world unit, volumes in litres (1 L = 1000 cm³).
// Reference tables (salts, products, densities, light bands) live in
// src/data/dosing.ts — these functions take the looked-up numbers as args so the
// lib stays pure and self-checkable.

export const US_GAL_L = 3.78541;
export const UK_GAL_L = 4.54609;
export const IN_PER_CM = 0.393701;
/** 1 dGH / 1 dKH ≈ this many ppm CaCO3. */
export const PPM_CACO3_PER_DEGREE = 17.848;
/** Default heater calibration: W per litre per °C of rise. Insulation/room vary
 *  — exposed as an editable knob in the UI (ponytail: physical calibration). */
export const DEFAULT_HEATER_K = 0.2;
/** Rated canister/HOB flow drops to roughly this fraction once full of media. */
export const REAL_FLOW_DERATE = 0.55;
/** Common off-the-shelf aquarium heater wattages. */
export const HEATER_SIZES = [25, 50, 75, 100, 150, 200, 250, 300] as const;

// ── Volume ──────────────────────────────────────────────────────────────────
/** Full interior volume in litres from cm dimensions. */
export const grossLiters = (w: number, d: number, h: number) =>
  (w * d * h) / 1000;
export const toUSgal = (l: number) => l / US_GAL_L;
export const toUKgal = (l: number) => l / UK_GAL_L;

/** Real water volume: filled to `fillFrac` of height, minus substrate & hardscape
 *  displacement (all litres). Never returns below 0. */
export function netLiters(
  grossL: number,
  fillFrac: number,
  substrateL: number,
  hardscapeL: number,
) {
  return Math.max(0, grossL * fillFrac - substrateL - hardscapeL);
}

// ── Substrate ─────────────────────────────────────────────────────────────────
/** Volume of substrate (L) for a footprint (cm) at an average depth (cm). */
export const substrateLiters = (w: number, d: number, avgDepthCm: number) =>
  (w * d * avgDepthCm) / 1000;
export const bagsNeeded = (l: number, bagSizeL: number) =>
  bagSizeL > 0 ? Math.ceil(l / bagSizeL) : 0;
export const substrateWeightKg = (l: number, densityKgPerL: number) =>
  l * densityKgPerL;

// ── Water change / dilution ───────────────────────────────────────────────────
export const changeLiters = (netL: number, pct: number) => (pct / 100) * netL;
/** How many `pct`% water changes to bring `cur` down to `tgt` (same units).
 *  Returns 0 if already at/below target, NaN for nonsense input. */
export function changesToTarget(cur: number, tgt: number, pct: number) {
  const p = pct / 100;
  if (!(cur > 0) || !(tgt > 0) || !(p > 0 && p < 1)) return NaN;
  if (tgt >= cur) return 0;
  return Math.ceil(Math.log(tgt / cur) / Math.log(1 - p));
}
/** Dechlorinator dose: `perDose` mL covers `perL` litres of new water. */
export const dechlorMl = (changeL: number, perL: number, perDose: number) =>
  perL > 0 ? (changeL / perL) * perDose : 0;

// ── Fertilizer dry salt ↔ ppm ─────────────────────────────────────────────────
/** ppm (mg/L) of an element added by `grams` of a salt whose element mass
 *  fraction is `frac`, dissolved in `liters`. */
export const saltPpm = (grams: number, frac: number, liters: number) =>
  liters > 0 ? (grams * frac * 1000) / liters : 0;
/** Grams of salt to reach `ppm` of the element in `liters`. */
export const saltGrams = (ppm: number, frac: number, liters: number) =>
  frac > 0 ? (ppm * liters) / (frac * 1000) : 0;

// ── CO2 (drop-checker / pH–KH relationship) ───────────────────────────────────
/** Dissolved CO2 in ppm from tank pH and carbonate hardness (dKH). */
export const co2ppm = (pH: number, kh: number) => 3 * kh * 10 ** (7 - pH);
/** pH that yields `co2` ppm at carbonate hardness `kh` (dKH). */
export const phForCo2 = (co2: number, kh: number) =>
  7 - Math.log10(co2 / (3 * kh));

// ── Remineralization (RO/DI → GH/KH) ──────────────────────────────────────────
/** Grams of additive to raise GH or KH by `deltaDeg` degrees in `liters`,
 *  given the product's dose rate (g per degree per litre). */
export const reminGrams = (
  ratePerDegPerL: number,
  deltaDeg: number,
  liters: number,
) => ratePerDegPerL * deltaDeg * liters;
export const degToPpmCaCO3 = (deg: number) => deg * PPM_CACO3_PER_DEGREE;
export const ppmCaCO3ToDeg = (ppm: number) => ppm / PPM_CACO3_PER_DEGREE;

// ── Filtration ────────────────────────────────────────────────────────────────
/** Tank turnovers per hour for a filter rated at `flowLph` litres/hour. */
export const turnover = (flowLph: number, netL: number) =>
  netL > 0 ? flowLph / netL : 0;
export const flowForTurnover = (netL: number, target: number) => netL * target;
/** Rated flow to actually achieve `needed` real flow once media derates it. */
export const ratedForReal = (needed: number, derate = REAL_FLOW_DERATE) =>
  needed / derate;

// ── Heater ────────────────────────────────────────────────────────────────────
export const heaterWatts = (netL: number, deltaT: number, k = DEFAULT_HEATER_K) =>
  netL * deltaT * k;
/** Smallest standard heater size ≥ the computed wattage. */
export function nextHeaterSize(watts: number) {
  return HEATER_SIZES.find((s) => s >= watts) ?? HEATER_SIZES[HEATER_SIZES.length - 1];
}

// ── Lighting (LED ballpark — real intensity needs a PAR meter) ─────────────────
export const wattsPerL = (ledW: number, netL: number) =>
  netL > 0 ? ledW / netL : 0;
export const lumensPerL = (lm: number, netL: number) => (netL > 0 ? lm / netL : 0);

// ── Composition ───────────────────────────────────────────────────────────────
/** Golden-ratio focal lines along a span (cm): from each end. */
export const goldenPoints = (span: number): [number, number] => [
  span * 0.382,
  span * 0.618,
];
export const thirdsPoints = (span: number): [number, number] => [
  span / 3,
  (2 * span) / 3,
];
/** Very rough stocking ceiling: total cm of small fish for `netL` litres
 *  (k litres per cm). A guideline only — real bioload depends on species/filter. */
export const stockingMaxCm = (netL: number, k = 1) => (k > 0 ? netL / k : 0);

// ── Unit converters ───────────────────────────────────────────────────────────
export const cmToIn = (cm: number) => cm * IN_PER_CM;
export const inToCm = (inch: number) => inch / IN_PER_CM;
export const cToF = (c: number) => (c * 9) / 5 + 32;
export const fToC = (f: number) => ((f - 32) * 5) / 9;

// --- node-runnable self-check (run the file directly: `tsx aquacalc.ts`) ---
function demo() {
  const approx = (a: number, b: number, eps = 0.05) => Math.abs(a - b) < eps;
  const must = (ok: boolean, msg: string) => {
    if (!ok) throw new Error(msg);
  };

  // 60×30×36 cm = 64.8 L
  must(approx(grossLiters(60, 30, 36), 64.8), "grossLiters");
  // 100 L ≈ 26.42 US gal
  must(approx(toUSgal(100), 26.417, 0.01), "toUSgal");
  // KNO3 (NO3 frac .6139) for 10 ppm NO3 in 100 L ≈ 1.629 g
  must(approx(saltGrams(10, 0.6139, 100), 1.629, 0.01), "saltGrams");
  // round-trip ppm
  must(approx(saltPpm(1.629, 0.6139, 100), 10, 0.01), "saltPpm");
  // CO2 at pH 6.8 / KH 4 ≈ 19.0 ppm
  must(approx(co2ppm(6.8, 4), 19.02, 0.1), "co2ppm");
  must(approx(phForCo2(19.02, 4), 6.8, 0.01), "phForCo2");
  // 50% changes to halve a value: exactly 1
  must(changesToTarget(40, 20, 50) === 1, "changesToTarget halve");
  // 25% changes to go 80 → 20 (ln .25 / ln .75 ≈ 4.82 → 5)
  must(changesToTarget(80, 20, 25) === 5, "changesToTarget");
  // already below target → 0
  must(changesToTarget(10, 20, 50) === 0, "changesToTarget at target");
  // substrate: 60×30 at 5 cm avg = 9 L
  must(approx(substrateLiters(60, 30, 5), 9), "substrateLiters");
  must(bagsNeeded(9, 9) === 1 && bagsNeeded(9.1, 9) === 2, "bagsNeeded");
  // turnover: 600 L/h in 100 L = 6×
  must(approx(turnover(600, 100), 6), "turnover");
  // heater: 100 L, +6°C, k .2 = 120 W → next size 150
  must(approx(heaterWatts(100, 6), 120) && nextHeaterSize(120) === 150, "heater");
  // dGH/dKH ↔ ppm
  must(approx(degToPpmCaCO3(4), 71.39, 0.01), "degToPpm");
  // golden point of 60 cm
  must(approx(goldenPoints(60)[1], 37.08), "goldenPoints");

  console.log("aquacalc demo OK");
}

if (
  typeof process !== "undefined" &&
  process.argv?.[1] &&
  process.argv[1].includes("aquacalc")
) {
  demo();
}
