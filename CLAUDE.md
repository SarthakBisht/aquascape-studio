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
  background from dropped plant photos client-side — no server.
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
  `src/data/hardscapeMaterials.ts`; a plant is an entry in `src/data/plants.ts`;
  a tank size in `src/data/tankPresets.ts`. The palette, pickers, and renderers
  all read from these lists — don't hardcode items in components.
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
       ├─ Backdrop · GlassTank · Substrate                  (always)
       ├─ Hardscape  → HardscapeMesh (procedural rock geo OR .glb model + gizmo)
       ├─ PlacementGhost (cursor-following rock ghost while placing)
       ├─ Plants     → Patch (instanced crossed-billboard cards, paint-to-fill)
       ├─ Caustics · Water · Bubbles · Fish                 (underwater mode)
       ├─ CompositionGuides                                 (design mode + toggle)
       └─ OrbitControls(makeDefault); paint raycasts Substrate/Hardscape,
          deselect via Canvas onPointerMissed
  └─ UI overlay: Toolbar · TankPanel · HardscapePalette · DrawPanel ·
     BackgroundPanel · LightPanel ·
     (PlantBrowser in design / FishPanel underwater) · SelectionBar
```
- **`useStudioStore`** is the single source of truth: tank dims, substrate,
  style, `hardscape[]`, `plants[]`, `lights[]` (the overhead rig), plus view
  settings (`mode`, `quality`, `showGuides`, `growth`) and the plant `brush`
  (`radius`/`density`/`scale` applied to newly painted patches). Transient,
  never persisted: `selectedId`, `transformMode`, `activePlantId`, `activeGround`,
  `tool` (now `select|plant|ground|place`), and the placement pair
  `placingMaterialId`/`placingSeed`. A persist `version`/`migrate` maps the legacy
  `grownIn` boolean → `growth` and seeds a default light rig.
  `getLayout()`/`loadLayout()` back export/import.
- **Procedural hardscape** (`src/lib/proceduralRock.ts`): a seed → a deformed
  icosahedron. Only the `seed` is persisted, so layouts stay tiny. "Regenerate"
  just rolls a new seed.
- **Editing loop:** click a piece → `selectItem` → drei `TransformControls`
  (move/rotate/scale) writes the transform back to the store `onObjectChange`.
  `OrbitControls makeDefault` lets TransformControls auto-disable orbit mid-drag.
- **Backdrop** (`src/components/scene/Backdrop.tsx`): the panel behind the back
  glass — solid / vertical gradient / backlit frosted-white glow (the contest
  depth trick). Config in the store (`background`), presets in
  `src/data/backgrounds.ts`; the scene clear-color follows the backdrop edge, and
  a bright backdrop eases off the dark gallery vignette/glow in `Studio`.
- **Drawing / painting (the "pen"):** `tool` is `select | plant | ground`.
  Pick a plant (`PlantBrowser` → `activePlantId`) or a material (`DrawPanel` →
  `activeGround`), then press-drag on the tank. The stroke engine
  (`src/lib/surfaceInteraction.ts`: `beginStroke`/`moveStroke`/`endStroke`)
  raycasts the **paintable** surfaces (Substrate, Hardscape, GroundCover —
  tagged `userData.paintable`) so everything lands on the real surface. Plant
  blades are sampled per-blade onto the surface (slope/stone/wood); material
  patches (`ground[]`, rendered by `GroundCover`) are laid level. OrbitControls
  is disabled while a brush is active (`enabled={tool === "select"}`) so dragging
  draws; deselect/stop via `onPointerMissed` or the DrawPanel stop button.
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
- **SSR / WebGL:** `<Studio>` returns a loader until `mounted` (client) so WebGL
  never runs on the server and persisted state can't cause hydration mismatch.
  The zustand store uses a `noopStorage` fallback when `window` is undefined.
- **Screenshots** require `gl={{ preserveDrawingBuffer: true }}` on `<Canvas>`.
- **Bundle assets locally** (see `public/ASSETS.md`) — third-party image hosts
  lack CORS headers and WebGL will reject the texture. Procedural/placeholder
  fallbacks exist for everything today.

## Scope
**In (current MVP):** tank presets + custom dims, sloped substrate (aquasoil/
sand/gravel), configurable **backdrop** (black/white/blue/gradient/backlit-glow,
painted into scene.background so it fills cleanly), a **researched procedural
rock library** (Seiryu/Dragon/Lava/Frodo/Elephant Skin/Pagoda/Petrified Wood —
distinct shape + surface via jaggedness/veins/strata/vertex-color mottling) +
driftwood (or drop-in `.glb` models), placed by **ghost-preview click-to-place**
(inside or outside the tank) then transform + stacking, a user-built **overhead
light rig** (add/remove Flood/Spot/RGB fixtures with intensity, warmth/color,
X/Z position, on-off; visible hardware + a baked ambient fill; replaces the old
hardcoded lights), plant browser with filters
+ **paint-onto-surface** billboards (blades seated on the slope/stones) +
**drop-your-own-photo** plants (AI background removal), a
freehand **draw tool** (drag to paint plants or level sand/gravel/soil patches),
composition guides + style presets, a **growth slider** (just-planted → grown-in,
scaling plant height + fullness), quality slider, orbit
camera, **underwater mode** (subtle tank-only water whose **god-ray shafts,
caustics, water tint + surface glare are all driven by the light rig** — per
fixture type/color/position/intensity, with depth-based warm absorption via
`src/lib/lightRig.ts`; animated caustics + bubbles, and **fish you control** — count/size/colour
palette/swim pattern [school·calm·dart·scatter]/speed — that flock and steer off
the glass), export/import + screenshot.

**Deferred (next milestones):**
1. Real scanned glTF hardscape + PBR textures + HDRI environment (realism).
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
