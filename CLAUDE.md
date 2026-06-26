# Aquascape Studio — stack-specific rules

Inherits `../CLAUDE.md`. This file adds only project-specific guidance.

3D web studio for the aquascaping hobby: set a tank's real dimensions, design a
hardscape + planting layout by drag/transform and paint-to-fill, orbit around
it, then flood the tank for an underwater view with swaying plants and swimming
fish. Throwaway MVP — optimize for the "looks real enough to be compelling"
wow factor, not production hardening.

> **Heads-up:** this folder is also part of the `MVPs` workspace and inherits
> `../CLAUDE.md`. If you opened **this repo standalone**, that parent isn't
> loaded — the essentials are restated under "Environment" below.

## Environment
- **OS: Windows 11; default shell is PowerShell** — use PowerShell syntax
  (`$env:VAR`, `;` chaining, `2>&1 | Out-String`). A Bash tool is available for
  POSIX scripts, but `cd` doesn't persist between calls — use absolute paths.
- **Package manager: `pnpm`** (do not switch to npm/yarn).
- **Guardrails:** never commit `.env`/secrets; don't run destructive commands
  (`rm -rf`, `git reset --hard`, force-push) or `git push` without explicit
  confirmation; keep `README.md` + this file up to date as the app changes.
- **Git:** repo-local identity is set (Sarthak / trendnovayt@gmail.com).
  Remote `origin` → https://github.com/SarthakBisht/aquascape-studio (public).

## Stack
- **Next.js 16 (App Router) + React 19 + TypeScript (strict)**, Tailwind CSS v4.
- **3D:** `@react-three/fiber` v9 + `@react-three/drei` v10 + `three` 0.184
  (+ `@react-three/postprocessing` for the planned underwater effects).
- **State:** `zustand` v5 with the `persist` middleware (localStorage).
- **In-browser AI:** `@imgly/background-removal` (lazy-loaded) strips the
  background from dropped plant/hardscape photos; `@huggingface/transformers`
  (transformers.js, lazy-loaded) runs monocular depth (Depth-Anything v2 small,
  WebGPU→WASM) for **Photo → 3D** hardscape. Both client-side — no server.
- **No backend / db / auth.** Everything runs client-side; layouts persist to
  localStorage and export/import as `.aquascape.json`.

## Commands
- Install: `pnpm install`
- Dev: `pnpm dev` (http://localhost:3000)
- Build: `pnpm build` (must pass — runs `tsc` + prerender)
- Typecheck only: `pnpm exec tsc --noEmit`

## Units & conventions
- **1 three.js world unit == 1 cm.** All real measurements (tank, substrate,
  plant heights) are in cm; the only conversion point is `src/lib/units.ts`.
- Function components + hooks only. Keep R3F components small and single-purpose.
- **Data-driven libraries:** adding a rock/wood type is a new entry in
  `src/data/hardscapeMaterials.ts`; a **PBR surface** in
  `src/data/hardscapeTextures.ts`; a plant in `src/data/plants.ts`; a tank size
  in `src/data/tankPresets.ts`. The palette, pickers, and renderers all read from
  these lists — don't hardcode items in components.
- Share types via `src/lib/types.ts`. Single zustand store in
  `src/store/useStudioStore.ts`; transient editor state (`selectedId`,
  `transformMode`, `activePlantId`, `tool`) is **not** persisted (see
  `partialize`).
- **Dispose GPU resources:** geometries created in `useMemo` (e.g. procedural
  rocks) must be `.dispose()`d on unmount.

## Architecture / data flow
```
page.tsx (server) → <Studio/> (client, mounted-gate)
  └─ <Canvas> → <TankScene>
       ├─ Lighting (fixture-driven rig + baked fill) · LightFixtures (hardware)
       ├─ Backdrop · GlassTank · Substrate (sculptable height field)  (always)
       ├─ Hardscape  → HardscapeMesh: geometry by `source` (procedural rock /
       │               branching `drift` / generated `mesh` from a height field)
       │               OR .glb model; look = TriplanarMaterial (procedural PBR
       │               surface — ON BY DEFAULT via material.textureId) + per-piece
       │               color tint, or flat vertex-color fallback; + gizmo
       ├─ PlacementGhost (cursor-following rock ghost while placing)
       ├─ Plants     → Patch (instanced crossed-billboard cards, paint-to-fill)
       ├─ Caustics · Water · Bubbles · Fish                 (underwater mode)
       ├─ CompositionGuides   front-view thirds/golden grid drawn ON the glass
       │                       (front / back / both pane; design mode + toggle)
       ├─ ColorGrade (EffectComposer, mounted only when grade ≠ neutral)
       └─ OrbitControls(makeDefault); paint raycasts Substrate/Hardscape,
          deselect via Canvas onPointerMissed
  └─ UI overlay: Toolbar · TankPanel · HardscapePalette (+ DrawShapeModal,
     PhotoTo3DModal) · HardscapeEditPanel · DrawPanel · BackgroundPanel ·
     LightPanel · GradePanel ·
     (PlantBrowser in design / FishPanel underwater) · SelectionBar
```
- **`useStudioStore`** is the single source of truth: tank dims, substrate,
  style, `hardscape[]`, `plants[]`, `lights[]` (the overhead rig), plus view
  settings (`mode`, `quality`, `showGuides` + `guides` {face, ratio}, `growth`,
  `grade` — the global
  brightness/contrast/saturation/hue color grade) and the plant `brush`
  (`radius`/`density`/`scale` applied to newly painted patches). Transient,
  never persisted: `selectedId`, `transformMode`, `activePlantId`, `activeGround`,
  `tool` (now `select|plant|ground|place|sculpt`), `sculptDir` (+1 raise / −1
  carve), and the placement pair
  `placingMaterialId`/`placingSeed`. Also persisted: `customMeshes`
  (meshId → grayscale height PNG for generated pieces, mirrors
  `customPlantTextures`). A persist `version`/`migrate` (now v5) maps the legacy
  `grownIn` boolean → `growth`, seeds a default light rig, and defaults
  `customMeshes`. `getLayout()` prunes unreferenced `customMeshes` before export;
  `loadLayout()` restores them.
- **Hardscape geometry by `source`** — every `HardscapeItem` carries optional
  per-piece overrides (back-compat: undefined = legacy procedural). Edits all go
  through the existing `updateHardscape(id, patch)`; generated pieces are created
  with `addGeneratedHardscape(partial)`:
  - `procedural` (`src/lib/proceduralRock.ts`): seed → icosahedron (detail 3 for
    rock) deformed by layered 3D value noise — smooth `fbm3` bulges + a *ridged*
    `ridged3` term for the sharp angular crests + a fine octave; per-seed
    frequency/strength/anisotropy jitter so no two rocks are siblings. Sculpt
    overrides (`shape`/`jaggedness`/`detail`/`strata`/`veinColor`) win over the
    material default. Only seed+params persist, so layouts stay tiny.
  - `drift` (`src/lib/driftwood.ts`): `makeDriftwoodGeometry(seed, DriftParams)` —
    recursive tapered tubes (manually merged, no deps), bark vertex colors.
  - `mesh` (`src/lib/heightfieldMesh.ts`): rebuilt async from
    `customMeshes[meshId]` — a grayscale height PNG → `meshFromHeightfield`
    (front +H / back −H with a z=0 rim seam → a closed, orbitable volume). Fed by
    **Draw → 3D** (`src/lib/inflate.ts`: distance-transform "puff" of a sketched
    silhouette) or **Photo → 3D** (`src/lib/depthFromImage.ts`: Depth-Anything
    depth × bg-removal mask). `heightToDataUrl`/`loadHeightField` (de)serialize.
- **Per-piece look** (`HardscapeEditPanel` → `updateHardscape`): `color` tint,
  `roughness`, and a `textureId` into `HARDSCAPE_SURFACES`
  (`src/data/hardscapeTextures.ts`). **Every library material sets a default
  `textureId`**, so placed rocks/wood are PBR-textured out of the box (the flat
  vertex-color path is only the no-surface fallback); with a surface active the
  `color` tint defaults to white (multiply) so the texture's own colours show —
  set a colour in Customize to recolour. Surfaces are **procedurally generated**
  seamless PBR maps (`src/lib/hardscapeTextureGen.ts`, TEX=384: a periodic
  value-noise height field with **domain warp** [breaks the lattice grid] + a
  coarse **macro patch** field [non-repeating colour/brightness] + deeper crevice
  AO → albedo + normal + roughness CanvasTextures, cached per id — no bundled
  image files, sidesteps the CORS/404 texture gotcha), applied by
  `TriplanarMaterial` (MeshStandardMaterial patched via `onBeforeCompile` to
  sample world-space triplanar, since the generated/icosahedron UVs can't tile;
  `envMapIntensity 1.25` for wet-stone sheen, and a **per-piece seed → sample
  offset + shade** so two stones of the same surface aren't visibly cloned).
  Regenerate (SelectionBar) rolls a new seed (rock + drift).
- **Editing loop:** click a piece → `selectItem` → drei `TransformControls`
  (move/rotate/scale) writes the transform back to the store `onObjectChange`.
  `OrbitControls makeDefault` lets TransformControls auto-disable orbit mid-drag.
- **Backdrop** (`src/components/scene/Backdrop.tsx`): two independent things —
  (1) **scene ambience** = the room/clear-color behind everything (`ambience`
  hex in the store, dark→light swatches), and (2) the **tank backdrop**, a
  physical plane sized edge-to-edge to the back glass (`w+1 × h+1`, just behind
  it at `z=-(d/2+0.3)`) so it reads as a poster on the back panel, never a white
  "sky". Styles: `none` (transparent — ambience shows through) / `solid` /
  vertical `gradient` / `backlit` radial glow with controllable color, intensity
  (`glow`) and source position (`glowX`/`glowY`). Config in `background`, presets
  (white/black/blue/aqua/night/Lumen/Lagoon/Sunset) in `src/data/backgrounds.ts`.
- **Drawing / painting (the "pen"):** `tool` is `select | plant | ground | sculpt`.
  Pick a plant (`PlantBrowser` → `activePlantId`), a material (`DrawPanel` →
  `activeGround`), or **Sculpt slope** (Raise/Carve in `DrawPanel`), then
  press-drag on the tank. The stroke engine
  (`src/lib/surfaceInteraction.ts`: `beginStroke`/`moveStroke`/`endStroke`)
  raycasts the **paintable** surfaces (Substrate, Hardscape, GroundCover —
  tagged `userData.paintable`) so everything lands on the real surface. Plant
  blades are sampled per-blade onto the surface (slope/stone/wood); material
  patches (`ground[]`, rendered by `GroundCover`) are laid level. OrbitControls
  is disabled while a brush is active (`enabled={tool === "select"}`) so dragging
  draws; deselect/stop via `onPointerMissed` or the DrawPanel stop button.
- **Substrate terrain (sculptable height field):** the bed is no longer a flat
  front→back ramp. `SubstrateConfig.field` (`HeightField` = depth-cm per grid
  cell, `src/lib/terrain.ts`) drives the top surface, so free-form hills,
  valleys and terraces are possible. `Substrate.tsx` subdivides the slab top to
  `fieldGrid(w,d)` and samples the field per-vertex (geometry rebuilt + disposed
  each edit); plants/rocks raycast it, so they reseat on the new terrain
  automatically. The **Sculpt** brush calls `sculptSubstrate(x,z)` →
  `sculptField` (soft circular raise/carve) → `relax` (angle-of-repose slump per
  material: sand 32° / gravel 36° / aquasoil 42°), giving "behaves like soil"
  slumping. TankPanel Front/Back depths reseed a clean linear field (the base
  slope); a strokes' dabs collapse to one undo. `field` is optional — undefined
  = legacy linear ramp, so old layouts still load.
- **Custom plant images:** drop (or pick) a photo onto a plant row in
  `PlantBrowser` → `processPlantImage` (`src/lib/plantImage.ts`) removes the
  background with the in-browser AI model and returns a downscaled PNG data URL →
  stored per species in `customPlantTextures` (persisted) → `Plants.tsx` feeds it
  to `usePlantTexture`, rendering it **untinted** (`color="#fff"`) and
  aspect-correct. Built-in `species.texture` paths work the same way. Rows
  without an image highlight the "＋ img" affordance. Patches render as **crossed billboard
  cards** (`src/components/scene/Plants.tsx`) textured per plant *form* by
  `src/lib/plantTextures.ts` — procedurally drawn leaf silhouettes by default,
  auto-swapped for a real cutout PNG when a species sets `texture`. Heights are
  capped to the tank so tall stems don't pierce the glass.

## Known gotchas (project-specific)
- **pnpm 11 build approval:** native deps (`sharp`, `unrs-resolver`) need
  `allowBuilds` in `pnpm-workspace.yaml` or `pnpm install` aborts with
  `ERR_PNPM_IGNORED_BUILDS`. The package.json `pnpm` field is ignored in pnpm 11.
  transformers.js pulls **`onnxruntime-node`** (optional, Node-only) — set
  `onnxruntime-node: false` in `allowBuilds` so its native postinstall is skipped
  (we use the browser WASM path, `onnxruntime-web`).
- **Heavy AI is lazy:** `@huggingface/transformers` and `@imgly/background-removal`
  are only `import()`ed inside event handlers (Photo → 3D, plant photo), never at
  module top level — keeps them off SSR and the initial bundle. The depth model
  downloads on first Photo → 3D use (progress shown).
- **Triplanar shader:** `TriplanarMaterial` patches MeshStandardMaterial via
  `onBeforeCompile`; it samples textures with `texture2D` (three's GLSL3 compat
  macro) by **world position**, so generated/`mesh` geometries need no real UVs.
- **SSR / WebGL:** `<Studio>` returns a loader until `mounted` (client) so WebGL
  never runs on the server and persisted state can't cause hydration mismatch.
  The zustand store uses a `noopStorage` fallback when `window` is undefined.
- **Screenshots** require `gl={{ preserveDrawingBuffer: true }}` on `<Canvas>`.
- **Bundle assets locally** (see `public/ASSETS.md`) — third-party image hosts
  lack CORS headers and WebGL will reject the texture. Procedural/placeholder
  fallbacks exist for everything today.

## Scope
**In (current MVP):** tank presets + custom dims, **sculptable substrate**
(aquasoil/sand/gravel — raise/carve a free-form height field for hills/valleys/
terraces, slumping to each material's angle of repose), configurable **backdrop** (black/white/blue/gradient/backlit-glow,
painted into scene.background so it fills cleanly), a **researched procedural
rock library** (Seiryu/Dragon/Lava/Frodo/Elephant Skin/Pagoda/Petrified Wood —
distinct shape + surface via jaggedness/veins/strata/vertex-color mottling) +
driftwood (or drop-in `.glb` models), placed by **ghost-preview click-to-place**
(inside or outside the tank) then transform + stacking, **per-piece hardscape
customization** (color tint + a procedural-PBR **surface library** via triplanar +
**sculpt sliders**), and **make-your-own hardscape** — a **branching driftwood
generator**, **Draw → 3D** (sketch a silhouette, inflate to a 3D piece), and
**Photo → 3D** (in-browser AI depth turns a driftwood/rock photo into a real
mesh); a user-built **overhead
light rig** (add/remove Flood/Spot/RGB fixtures with intensity, warmth/color,
X/Z position, on-off; visible hardware + a baked ambient fill; replaces the old
hardcoded lights), plant browser with filters
+ **paint-onto-surface** billboards (blades seated on the slope/stones) +
**drop-your-own-photo** plants (AI background removal), a
freehand **draw tool** (drag to paint plants, level sand/gravel/soil patches, or
**sculpt the substrate** into hills/valleys that slump like real soil),
**composition guides** (rule-of-thirds / golden-ratio grid drawn on the front,
back, or both glass panes) + style presets, a **growth slider** (just-planted → grown-in,
scaling plant height + fullness), a global **color grade**
(brightness/contrast/saturation/tint post-process, captured in screenshots),
quality slider, orbit
camera, **underwater mode** (subtle tank-only water whose **god-ray shafts,
caustics, water tint + surface glare are all driven by the light rig** — per
fixture type/color/position/intensity, with depth-based warm absorption via
`src/lib/lightRig.ts`; animated caustics + bubbles, and **fish you control** — count/size/colour
palette/swim pattern [school·calm·dart·scatter]/speed — that flock and steer off
the glass), export/import + screenshot.

**Deferred (next milestones):**
1. Real scanned glTF hardscape + photoscanned PBR maps + HDRI environment — the
   procedural surfaces + triplanar pipeline are in place; swap `hardscapeTextureGen`
   for real `/public/textures/<id>/{albedo,normal,roughness}` and drop `.glb`s in.
   Ghost-preview placement for generated (drift/mesh) pieces (today they drop at
   center, then move). Optional: real image-to-3D (TripoSR-class) for closed meshes.
2. Snap-to-surface / light physics so stacked pieces rest naturally.
3. Underwater realism: caustics, god rays, refraction, animated surface,
   per-blade plant sway shader, submerged-camera waterline post-fx.
4. Full GPU/instanced **boids** (separation/alignment/cohesion) + hardscape
   avoidance for fish.
5. Real photographic plant cutouts (billboard pipeline is in place — just drop
   PNGs into `public/plants/` and set `texture` on the species). Optional:
   per-blade vertex-shader sway.
6. Back-glass background image/color; sketch-to-3D rock drawing; accounts/
   sharing gallery; mobile/touch.

## Status & product direction
- **Done so far:** full scaffold + the plant realism pass (cones → crossed
  photographic billboards with a paint brush and a drop-in PNG upgrade path).
  `pnpm build` + `tsc --noEmit` pass; pushed to GitHub (public).
- **Reference product:** [scape-it.io](https://scape-it.io/) — note it's a
  **2.5D** front-view photographic compositor (mirror button, "plant graphics",
  perspective tilt), *not* a real 3D engine. Our deliberate **differentiator** is
  true 3D: orbit + underwater + fish, which it can't do.
- **Chosen direction (locked):** stay 3D but use **photographic billboards** for
  plants and (next) **scanned glTF models** for hardscape — photoreal *and*
  walk-around. Assets are **CC0-curated first** (Poly Haven / Quaternius /
  Sketchfab CC0), bundled locally under `public/`.
- **Next focus (pick one):** hardscape customization (real scanned rock/wood +
  per-piece scale/texture/rotate + snap-stacking) **or** underwater realism
  (caustics, god rays, animated surface, schooling boids).
- **#1 asset unlock:** transparent-background cutout PNGs of real aquatic plants
  (drop into `public/plants/<id>.png`, set `texture` on the species). See
  `public/ASSETS.md`.
