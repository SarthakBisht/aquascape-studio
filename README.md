# 🪨 Aquascape Studio

A 3D web studio for the **aquascaping** hobby. Set your tank's real dimensions,
design a hardscape + planting layout, orbit around it from any angle, then
**flood the tank** for an underwater view with swaying plants and swimming fish.

> Throwaway MVP / prototype. Optimized for speed of learning and the "looks real
> enough to be compelling" wow factor.

## Features

- **Tank** — preset sizes (Nano, ADA 60-P/90-P/120-P, Shallow) or custom W×D×H,
  with a **sculptable substrate** (aquasoil / sand / gravel): set the base
  front/back slope, then raise/carve free-form hills, valleys and terraces with
  the Sculpt brush — soil slumps to its angle of repose, so steep piles settle
  like the real thing.
- **Hardscape** — procedurally generated rocks grounded in real aquascaping
  stones (Seiryu, Dragon/Ohko, Lava, Frodo, Elephant Skin, Pagoda, Petrified
  Wood). Each ships **textured by default** — angular, eroded geometry (ridged 3D
  noise → sharp crests + cavities, with per-seed shape variety so no two are
  alike) wrapped in a seamless **PBR surface** (domain-warped grain, crevice
  shading, per-piece colour/sample jitter) — plus driftwood (Spider Wood,
  Manzanita). Pick a stone and a **ghost preview follows
  your cursor** — click to place it anywhere (inside the tank or outside), then
  **move / rotate / scale**, stack, duplicate, **regenerate** (new random shape),
  and delete. Data-driven, so new materials are a one-line addition.
- **Customize each piece (3D)** — select any rock/wood and open the **Customize**
  panel: tint its **color**, apply a realistic **PBR surface** (Seiryu, Granite,
  Slate, Lava, Sandstone, Dragon Stone, Petrified Wood, Driftwood Bark, Weathered
  Wood — seamless procedural albedo + normal + roughness, projected **triplanar**
  so it tiles cleanly on any shape), set **roughness**, pick a **form**
  (Boulder · Cobble · Slab · Plate · Spire · Shard · **Arch** · **Bowl** — the
  arch/bowl are genuinely concave, not just stretched spheres), then fine-tune the
  shape with sliders (width / height / depth, **taper**, **flatten** into cleaved
  faces, **tilt**, jaggedness, detail, layered strata, vein color). **♻ New shape**
  rolls a fresh random variant of the same form. Spawn an Arch / Bowl / Slab /
  Spire straight from the palette's **Rock forms** row.
- **Make your own hardscape** — four ways, all client-side:
  - **Driftwood generator** — one click spawns a unique **branchy** piece
    (recursive tapered limbs); tune branches / length / gnarl / taper / splits /
    thickness, or Regenerate for a new one.
  - **Draw → 3D** — sketch a silhouette on a 2D canvas (brush / erase / mirror);
    it's **inflated and roughened into a real stone** (surface relief, not a smooth
    pillow) shown in a **live rotating 3D preview** before you place it.
  - **Photo → 3D** — drop a driftwood/rock photo; an **in-browser AI** removes the
    background and estimates **monocular depth** (Depth-Anything v2) to build a real
    3D mesh of the piece. First use downloads a small model.
  - Generated pieces persist as tiny grayscale height maps and rebuild on load.
- **Light rig** — build the lighting above the tank in the **Light** panel:
  **add / remove fixtures** (Flood · Spot · RGB), each with its own intensity,
  **warmth** (color temperature) or RGB color, **X/Z position**, and on/off.
  Visible hardware hangs above the glass; a soft ambient fill keeps the scape
  lit even with every fixture off. Applies in design and underwater views.
- **Background** — two controls. **Scene ambience** tints the room behind the
  whole tank (dark → light swatches + custom). The **tank backdrop** is a panel
  edge-to-edge on the back glass: **None** (transparent), **White** (pro depth),
  **Black** (colors pop), **Blue/Aqua/Night** gradients, or a **backlit** glow
  (**Lumen** white · **Lagoon** blue · **Sunset** warm) — the contest "gold
  standard" for depth, with adjustable color, brightness, and glow position.
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
- **Add your own plant** — **＋ Add custom plant** opens a form: drop a photo (the
  background is removed), set name, category, leaf form, difficulty, default
  height range, and color → it's added to the browser as a real species, armed
  for painting. 🗑 removes it. Custom plants save, export, and show in the gallery
  with the scape.
- **Draw tool** — a freehand pen: pick a plant or a substrate material (sand /
  gravel / soil) and **drag** on the tank to paint. Plants seat on the surface
  slope; material draws as level patches. Or **Sculpt slope** (Raise / Carve) to
  push the substrate into hills and valleys that slump like real soil. Orbit
  pauses while you draw.
- **Composition help** — a rule-of-thirds / golden-ratio grid drawn on the front,
  back, or both glass panes (choose pane + ratio), and Iwagumi / Nature / Dutch
  style hints.
- **Underwater mode** — flood the tank with **subtle, near-transparent water**
  (only the tank) whose look follows your **light rig**: each fixture casts a
  **god-ray shaft** from its real position (tight & bright for a spot, broad for
  a flood, colored for RGB), and the **caustics**, water tint, and surface glare
  take their color/brightness from the active lights — all fading cooler with
  depth (real water absorbs warm light first). Plus drifting **bubbles** and
  **fish you control** (count, size, color palette, swim pattern —
  school / calm / dart / scatter — and speed) that flock and turn smoothly off
  the glass; plants sway.
- **Gallery** — save scapes into a personal, contest-style **gallery**: press
  **Save** and the tank is flooded for the shot, so every tile is an underwater
  hero image. View your scapes two ways: a dark **Grid** of live 3D tiles, or a
  **Showroom** — a **navigable 3D gallery room** where every saved tank is placed
  and running on a lit cabinet along the wall, in a cozy, warm-lit lounge — just
  like walking into a real aquascaping showroom. Each tank is **flooded and lit by
  its own light rig, with its own fish swimming** (the count / size / palette /
  pattern you set). Free-look with the mouse (drag to look, right-drag to move
  through the room, scroll to zoom), hover a tank to read its name, click to open
  it (its full look — lights, fish, color grade, underwater settings — comes
  back). Or start a fresh **New scape**. Stored locally in your browser.
- **Camera** — orbit / zoom / pan around the tank.
- **Color grade** — global **brightness / contrast / saturation / tint** over the
  whole render (post-process, so screenshots keep the look). Reset to neutral.
- **Quality slider**, a **growth slider** (just-planted → fully grown-in,
  scaling plant height *and* fullness), **PNG screenshot**, and
  **export / import** layouts as portable `.aquascape.json` files. Your work
  also auto-saves to localStorage.

## Stack

Next.js 16 · React 19 · TypeScript (strict) · Tailwind v4 · React Three Fiber +
drei + three.js · zustand · `@imgly/background-removal` + `@huggingface/transformers`
(transformers.js, lazy-loaded for in-browser depth). No backend — everything runs
in the browser.

## Run

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

```bash
pnpm build      # production build (also type-checks)
```

> **pnpm 11 note:** build-script approvals live in `pnpm-workspace.yaml`
> (`allowBuilds`): `sharp` / `unrs-resolver` are enabled; `onnxruntime-node`
> (pulled by transformers.js, Node-only) is set `false` — we use the browser WASM
> path. Without these entries `pnpm install` aborts.

## How to use

1. Pick a tank size (or set custom dimensions) and a substrate in the **Tank**
   panel (set the front/back slope here). In the **Draw** panel, use **Sculpt
   slope → Raise / Carve** to shape hills and valleys; soil slumps naturally.
   Optionally choose a **style** for composition hints.
2. Place rocks/wood from the **Hardscape** panel: pick a stone, position the
   **ghost preview**, and click to drop it; or **Create your own** — generate
   **Driftwood**, **Draw → 3D**, or **Photo → 3D**. Click a piece to **Move /
   Rotate / Scale / Regenerate** it, and use the **Customize** panel to set its
   color, **surface texture**, and **sculpt** its shape. Build up and stack; tune
   the overhead **Light** panel to taste.
3. In the **Plants** panel, filter and pick a species, then click on the
   substrate to fill an area with it.
4. Flip to **Underwater** in the toolbar to flood the tank and watch the fish.
5. Press **Save** to add the scape to your **Gallery** (it's auto-flooded for the
   tile). Open the **Gallery** to revisit any scape, or **New scape** for a blank
   tank.
6. **Export** to save/share your scape as a file, or **📷** for a screenshot.

## Project layout

```
src/
  app/                 layout · page · globals.css
  components/
    Studio.tsx         Canvas host + UI overlay (client, mounted-gated)
    scene/             TankScene, GlassTank, Substrate, Lighting, LightFixtures,
                       Hardscape, TriplanarMaterial, PlacementGhost, Plants,
                       Water, Fish, CompositionGuides, LiveTank (gallery tile)
                       + Showroom3D (navigable 3D gallery room)
    ui/                Toolbar, TankPanel, HardscapePalette, HardscapeEditPanel,
                       DrawShapeModal, PhotoTo3DModal, LightPanel, DrawPanel,
                       BackgroundPanel, PlantBrowser, SelectionBar, Gallery,
                       primitives
  store/useStudioStore.ts   editor state — single zustand store (persisted)
  store/useLibraryStore.ts  saved-scape gallery (separate persisted store)
  data/                tankPresets, hardscapeMaterials, hardscapeTextures,
                       plants, stylePresets
  lib/                 types, units, proceduralRock, driftwood, inflate,
                       heightfieldMesh, hardscapeTextureGen, depthFromImage,
                       persistence
public/ASSETS.md       where to drop CC0 models/textures/HDRIs
```

See [CLAUDE.md](CLAUDE.md) for architecture details, conventions, and the
deferred-realism milestones (scanned glTF assets, caustics/god-rays, GPU boids,
billboard foliage, …).
