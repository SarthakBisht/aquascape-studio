import type { StylePreset } from "@/lib/types";

// Composition knowledge baked into the app. These power the style-preset
// starters and the on-screen guides (rule of thirds, golden ratio, odd stones).
export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "iwagumi",
    label: "Iwagumi",
    origin: "Japan · Takashi Amano lineage",
    blurb: "Minimalist, rock-led. Stones tell the whole story.",
    rules: [
      "Use an odd number of stones (3, 5, 7)",
      "One dominant 'Oyaishi' main stone, placed off-center",
      "Seat the main stone on a rule-of-thirds line",
      "Single rock type + carpet plants for cohesion",
    ],
  },
  {
    id: "nature",
    label: "Nature Aquarium",
    origin: "Japan · Amano",
    blurb: "Recreates a natural landscape — forest, ravine, mountainside.",
    rules: [
      "Build depth with a back-to-front substrate slope",
      "Combine one wood + one rock type",
      "Aim for a focal point on a golden-ratio intersection",
      "Layer planting: carpet → midground → background",
    ],
  },
  {
    id: "dutch",
    label: "Dutch",
    origin: "Netherlands · 1930s",
    blurb: "Plant-led. Terraced rows of contrasting stem plants, little hardscape.",
    rules: [
      "Group plants in 'streets' of contrasting color & texture",
      "Terrace heights from front to back",
      "Roughly one plant species per 10 cm of width",
      "Hardscape is optional and minimal",
    ],
  },
];

export function getStyle(id: string): StylePreset | undefined {
  return STYLE_PRESETS.find((s) => s.id === id);
}
