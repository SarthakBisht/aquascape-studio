# 🪨 Aquascape Studio

A 3D web studio for the **aquascaping** hobby. Set your tank's real dimensions,
design a hardscape + planting layout, orbit around it from any angle, then
**flood the tank** for an underwater view with swaying plants and swimming fish.

> Throwaway MVP / prototype. Optimized for speed of learning and the "looks real
> enough to be compelling" wow factor.

## Features

- **Tank** — preset sizes (Nano, ADA 60-P/90-P/120-P, Shallow) or custom W×D×H,
  with a sloped substrate (aquasoil / sand / gravel).
- **Hardscape** — procedurally generated rocks (Seiryu, Dragon Stone, Lava) and
  driftwood (Spider Wood, Manzanita). Add, **move / rotate / scale**, stack,
  duplicate, **regenerate** (new random shape), and delete. Data-driven, so new
  materials are a one-line addition.
- **Background** — set the panel behind the tank: **black** (colors pop),
  **white** (pro depth), **blue** (open water), **gradient**, or a **backlit**
  frosted-white glow (the contest "gold standard" for depth) with adjustable
  light. Solid/gradient/backlit styles with custom colors.
- **Plants** — a classified, filterable browser (category · difficulty · light ·
  CO₂). Select a species, then **click any surface — soil, stone, or driftwood —
  to paint** a patch of **crossed photographic billboards** (real leaf
  silhouettes per plant form, not grass-cones), correctly scaled & colored.
  Plants always rest on the surface you clicked. A **brush** controls area /
  density / size. Drop a cutout PNG into `public/plants/` to upgrade any species
  to a real photo (see [public/ASSETS.md](public/ASSETS.md)).
- **Bring your own plant photo** — drag an image onto a plant in the browser (or
  click **＋ img**); an **in-browser AI** removes the background and uses the
  cutout as that plant's look (saved per species). Plants without an image are
  highlighted.
- **Draw tool** — a freehand pen: pick a plant or a substrate material (sand /
  gravel / soil) and **drag** on the tank to paint. Plants seat on the surface
  slope; material draws as level patches. Orbit pauses while you draw.
- **Composition help** — rule-of-thirds grid + golden-ratio markers, and
  Iwagumi / Nature / Dutch style hints.
- **Underwater mode** — flood the tank with **subtle, near-transparent water**
  (only the tank), a soft **glare from the overhead light**, **caustics** on the
  substrate, drifting **bubbles**, and **fish you control** (count, size, color
  palette, swim pattern — school / calm / dart / scatter — and speed) that flock
  and turn smoothly off the glass; plants sway.
- **Camera** — orbit / zoom / pan around the tank.
- **Quality slider**, **grown-in plant preview**, **PNG screenshot**, and
  **export / import** layouts as portable `.aquascape.json` files. Your work
  also auto-saves to localStorage.

## Stack

Next.js 16 · React 19 · TypeScript (strict) · Tailwind v4 · React Three Fiber +
drei + three.js · zustand. No backend — everything runs in the browser.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

```bash
pnpm build      # production build (also type-checks)
```

> **pnpm 11 note:** build-script approvals for `sharp` / `unrs-resolver` live in
> `pnpm-workspace.yaml` (`allowBuilds`). Without them `pnpm install` aborts.

## How to use

1. Pick a tank size (or set custom dimensions) and a substrate in the **Tank**
   panel. Optionally choose a **style** for composition hints.
2. Toggle **Guides** on and place rocks/wood from the **Hardscape** panel; click
   a piece to **Move / Rotate / Scale / Regenerate** it. Build up and stack.
3. In the **Plants** panel, filter and pick a species, then click on the
   substrate to fill an area with it.
4. Flip to **Underwater** in the toolbar to flood the tank and watch the fish.
5. **Export** to save/share your scape, or **📷** for a screenshot.

## Project layout

```
src/
  app/                 layout · page · globals.css
  components/
    Studio.tsx         Canvas host + UI overlay (client, mounted-gated)
    scene/             TankScene, GlassTank, Substrate, Lighting, Hardscape,
                       Plants, Water, Fish, CompositionGuides
    ui/                Toolbar, TankPanel, HardscapePalette, PlantBrowser,
                       SelectionBar, primitives
  store/useStudioStore.ts   single zustand store (persisted)
  data/                tankPresets, hardscapeMaterials, plants, stylePresets
  lib/                 types, units, proceduralRock, persistence
public/ASSETS.md       where to drop CC0 models/textures/HDRIs
```

See [CLAUDE.md](CLAUDE.md) for architecture details, conventions, and the
deferred-realism milestones (scanned glTF assets, caustics/god-rays, GPU boids,
billboard foliage, …).
