import type { SubstrateType } from "@/lib/types";

// Reference tables for the dosing / chemistry / equipment calculators
// (data-driven, like substrates.ts / hardscapeMaterials.ts). The math lives in
// src/lib/aquacalc.ts — these are the looked-up numbers it consumes.

/** A dry fertilizer salt and the mass fraction of each element/ion it carries.
 *  Fractions are (atomic/ion mass) ÷ (formula mass). The calculator multiplies
 *  grams × fraction to get mg of that element. */
export interface Salt {
  id: string;
  label: string;
  /** Element/ion → mass fraction of the salt. */
  fractions: Record<string, number>;
}

export const SALTS: Salt[] = [
  { id: "kno3", label: "KNO₃ (potassium nitrate)", fractions: { NO3: 0.6139, N: 0.1385, K: 0.3866 } },
  { id: "kh2po4", label: "KH₂PO₄ (mono-potassium phosphate)", fractions: { PO4: 0.6984, P: 0.2276, K: 0.2867 } },
  { id: "k2so4", label: "K₂SO₄ (potassium sulphate)", fractions: { K: 0.4487 } },
  { id: "mgso4", label: "MgSO₄·7H₂O (Epsom salt)", fractions: { Mg: 0.0986 } },
  { id: "caso4", label: "CaSO₄·2H₂O (gypsum)", fractions: { Ca: 0.2328 } },
  { id: "csmb", label: "CSM+B (trace mix)", fractions: { Fe: 0.07 } },
];

/** Estimative Index weekly target ranges (ppm) for a high-tech planted tank. */
export const EI_TARGETS: { el: string; lo: number; hi: number }[] = [
  { el: "NO3", lo: 10, hi: 30 },
  { el: "PO4", lo: 1, hi: 3 },
  { el: "K", lo: 10, hi: 30 },
  { el: "Fe", lo: 0.2, hi: 0.5 },
  { el: "Ca", lo: 10, hi: 30 },
  { el: "Mg", lo: 2, hi: 5 },
];

/** A remineralizing product. `ratePerDegPerL` = grams to raise the target
 *  degree (GH or KH) by 1° in 1 L — editable in the UI; verify against the label. */
export interface ReminProduct {
  id: string;
  label: string;
  raises: "GH" | "KH" | "GH+KH";
  ratePerDegPerL: number;
  note?: string;
}

export const REMIN_PRODUCTS: ReminProduct[] = [
  { id: "salty-ghkh", label: "Salty Shrimp GH/KH+", raises: "GH+KH", ratePerDegPerL: 0.04, note: "≈1 g per 50 L raises both ~1°. Verify vs label." },
  { id: "salty-gh", label: "Salty Shrimp GH+", raises: "GH", ratePerDegPerL: 0.04 },
  { id: "equilibrium", label: "Seachem Equilibrium", raises: "GH", ratePerDegPerL: 0.043, note: "≈16 g per 80 L ≈ 3 dGH." },
  { id: "nahco3", label: "Baking soda (NaHCO₃)", raises: "KH", ratePerDegPerL: 0.03, note: "Pure salt: ~0.03 g/L raises ~1 dKH." },
];

/** Bulk density of wet substrate (kg per L) for the weight estimate. */
export const SUBSTRATE_DENSITY: Record<SubstrateType, number> = {
  aquasoil: 0.9,
  sand: 1.5,
  gravel: 1.6,
};

/** LED light-level bands (rough, for low-light vs high-tech ballpark). Real
 *  intensity is PAR and needs a meter — these classify watts/L & lumens/L only. */
export const LIGHT_BANDS = {
  wattsPerL: { low: 0.25, high: 0.5 },
  lumensPerL: { low: 20, high: 40 },
};

/** Classify a per-litre figure against a {low, high} band. */
export function classifyBand(value: number, band: { low: number; high: number }) {
  if (value < band.low) return "low-tech";
  if (value > band.high) return "high-tech";
  return "medium";
}
