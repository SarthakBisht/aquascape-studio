import type { BackgroundConfig } from "@/lib/types";

// Aquascaping backdrop presets. In the hobby: black makes colors pop but feels
// closed-in; opaque white is what most pros use for maximum depth; blue evokes
// open water; and a *backlit* frosted-white panel is the contest "gold
// standard" — a glow behind the hardscape that gives real depth.
export interface BackgroundPreset {
  id: string;
  label: string;
  note: string;
  config: BackgroundConfig;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: "none",
    label: "None",
    note: "Transparent — glass only, room shows through",
    config: { style: "none", colorTop: "#000000", colorBottom: "#000000", glow: 0 },
  },
  {
    id: "white",
    label: "White",
    note: "ADA pro choice — max depth, colors read true",
    config: { style: "solid", colorTop: "#eef1ec", colorBottom: "#eef1ec", glow: 0 },
  },
  {
    id: "black",
    label: "Black",
    note: "Colors pop, hides gear",
    config: { style: "solid", colorTop: "#0a0a0a", colorBottom: "#0a0a0a", glow: 0 },
  },
  {
    id: "blue",
    label: "Blue",
    note: "Classic poster — sky to deep water",
    config: { style: "gradient", colorTop: "#4a9fd4", colorBottom: "#0a2a3d", glow: 0 },
  },
  {
    id: "aqua",
    label: "Aqua",
    note: "Bright tropical shallows",
    config: { style: "gradient", colorTop: "#bdece6", colorBottom: "#2f7d8a", glow: 0 },
  },
  {
    id: "night",
    label: "Night",
    note: "Calm dark gradient",
    config: { style: "gradient", colorTop: "#1a241d", colorBottom: "#0a0d0a", glow: 0 },
  },
  {
    id: "backlit",
    label: "Lumen",
    note: "Frosted white glow · contest gold standard",
    config: {
      style: "backlit",
      colorTop: "#ffffff",
      colorBottom: "#c2ccc6",
      glow: 0.7,
      glowX: 0.5,
      glowY: 0.42,
    },
  },
  {
    id: "backlit-blue",
    label: "Lagoon",
    note: "Backlit blue glow — open-water depth",
    config: {
      style: "backlit",
      colorTop: "#cdeeff",
      colorBottom: "#16486e",
      glow: 0.7,
      glowX: 0.5,
      glowY: 0.4,
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    note: "Warm low backlight — golden hour",
    config: {
      style: "backlit",
      colorTop: "#ffd9a0",
      colorBottom: "#5b3330",
      glow: 0.65,
      glowX: 0.5,
      glowY: 0.66,
    },
  },
];

// Default to the backlit backdrop — contest gold standard, looks great as a
// physical panel behind the glass without flooding the whole scene with white.
export const DEFAULT_BACKGROUND: BackgroundConfig =
  BACKGROUND_PRESETS.find((p) => p.id === "backlit")?.config ??
  BACKGROUND_PRESETS[0].config;

/** Default scene/room ambience — dark gallery keeps focus on the tank. */
export const DEFAULT_AMBIENCE = "#0d0f0b";

/** Quick-pick scene ambience colours (dark → light) for the Background panel. */
export const AMBIENCE_PRESETS = [
  { id: "dark", label: "Dark", color: "#0d0f0b" },
  { id: "charcoal", label: "Charcoal", color: "#1c1e1a" },
  { id: "warm", label: "Warm", color: "#1a140c" },
  { id: "cool", label: "Cool", color: "#0a0f18" },
  { id: "stone", label: "Stone", color: "#3a3c38" },
  { id: "light", label: "Light", color: "#cbcfc9" },
] as const;

/** Relative luminance of a #rrggbb color (0..1). */
export function hexLuminance(hex: string): number {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Whether a backdrop reads as "bright" (so the dark gallery vignette eases off). */
export function isBrightBackground(bg: BackgroundConfig): boolean {
  return bg.style === "backlit" || hexLuminance(bg.colorTop) > 0.55;
}
