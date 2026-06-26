import type { RockForm, Vec3 } from "@/lib/types";

// Data-driven rock forms. Each form is a base primitive + a sensible starting set
// of sculpt params; the Customize panel applies these on click ("preset, then
// fine-tune"), the geometry reads `primitive` to pick the base shape, and the
// palette spawns the non-convex ones directly. Adding a form is one entry here.
export interface RockFormDef {
  label: string;
  /** Base primitive the noise is displaced from. */
  primitive: "icosa" | "lathe" | "torus";
  shape: Vec3;
  jaggedness: number;
  detail: number;
  strata: boolean;
  /** Radius scaled by height: + wide base, − wide top. */
  taper: number;
  /** Planar cleave 0..1 (flat top + side face). */
  flat: number;
}

export const ROCK_FORMS: Record<RockForm, RockFormDef> = {
  boulder: {
    label: "Boulder",
    primitive: "icosa",
    shape: [1, 0.85, 1],
    jaggedness: 0.45,
    detail: 3,
    strata: false,
    taper: 0,
    flat: 0,
  },
  cobble: {
    label: "Cobble",
    primitive: "icosa",
    shape: [1.1, 0.7, 1],
    jaggedness: 0.16,
    detail: 3,
    strata: false,
    taper: 0.15,
    flat: 0.15,
  },
  slab: {
    label: "Slab",
    primitive: "icosa",
    shape: [1.9, 0.45, 1.2],
    jaggedness: 0.35,
    detail: 3,
    strata: true,
    taper: 0,
    flat: 0.6,
  },
  plate: {
    label: "Plate",
    primitive: "icosa",
    shape: [1.7, 0.3, 1.6],
    jaggedness: 0.3,
    detail: 3,
    strata: true,
    taper: 0,
    flat: 0.85,
  },
  spire: {
    label: "Spire",
    primitive: "icosa",
    shape: [0.7, 1.8, 0.7],
    jaggedness: 0.5,
    detail: 3,
    strata: false,
    taper: -0.5,
    flat: 0.1,
  },
  shard: {
    label: "Shard",
    primitive: "icosa",
    shape: [0.6, 1.4, 0.6],
    jaggedness: 0.7,
    detail: 3,
    strata: false,
    taper: -0.7,
    flat: 0.25,
  },
  arch: {
    label: "Arch",
    primitive: "torus",
    shape: [1.3, 1.0, 0.8],
    jaggedness: 0.35,
    detail: 3,
    strata: false,
    taper: 0,
    flat: 0,
  },
  bowl: {
    label: "Bowl",
    primitive: "lathe",
    shape: [1.2, 0.9, 1.2],
    jaggedness: 0.3,
    detail: 3,
    strata: false,
    taper: 0,
    flat: 0,
  },
};

export function getRockForm(form: RockForm | undefined): RockFormDef {
  return ROCK_FORMS[form ?? "boulder"];
}

export const ROCK_FORM_IDS = Object.keys(ROCK_FORMS) as RockForm[];
