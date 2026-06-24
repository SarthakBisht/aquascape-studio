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
    id: "night",
    label: "Night",
    note: "Calm dark gradient",
    config: { style: "gradient", colorTop: "#1a241d", colorBottom: "#0a0d0a", glow: 0 },
  },
  {
    id: "black",
    label: "Black",
    note: "Colors pop, hides gear",
    config: { style: "solid", colorTop: "#0a0a0a", colorBottom: "#0a0a0a", glow: 0 },
  },
  {
    id: "white",
    label: "White",
    note: "Pro choice — max depth",
    config: { style: "solid", colorTop: "#eef0ec", colorBottom: "#eef0ec", glow: 0 },
  },
  {
    id: "blue",
    label: "Blue",
    note: "Open-water feel",
    config: { style: "gradient", colorTop: "#2f86ab", colorBottom: "#08222e", glow: 0 },
  },
  {
    id: "backlit",
    label: "Backlit",
    note: "Frosted glow · gold standard",
    config: { style: "backlit", colorTop: "#f6f8f3", colorBottom: "#aeb6ab", glow: 0.7 },
  },
];

export const DEFAULT_BACKGROUND: BackgroundConfig = BACKGROUND_PRESETS[0].config;

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
