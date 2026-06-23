# Aquascape Studio — stack-specific rules

Inherits `../CLAUDE.md`. This file adds only project-specific guidance.

3D web studio for the aquascaping hobby: set a tank's real dimensions, design a
hardscape + planting layout by drag/transform and paint-to-fill, orbit around
it, then flood the tank for an underwater view with swaying plants and swimming
fish. Throwaway MVP — optimize for the "looks real enough to be compelling"
wow factor, not production hardening.

## Stack
- **Next.js 16 (App Router) + React 19 + TypeScript (strict)**, Tailwind CSS v4.
- **3D:** `@react-three/fiber` v9 + `@react-three/drei` v10 + `three` 0.184
  (+ `@react-three/postprocessing` for the planned underwater effects).
- **State:** `zustand` v5 with the `persist` middleware (localStorage).
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
       ├─ Lighting · GlassTank · Substrate                 (always)
       ├─ Hardscape  → HardscapeMesh (procedural rock geo + TransformControls)
       ├─ Plants     → Patch (instanced billboard blades, paint-to-fill)
       ├─ Water · Fish                                      (underwater mode)
       ├─ CompositionGuides                                 (design mode + toggle)
       └─ ground click-catcher (deselect / paint) + OrbitControls(makeDefault)
  └─ UI overlay: Toolbar · TankPanel · HardscapePalette · PlantBrowser · SelectionBar
```
- **`useStudioStore`** is the single source of truth: tank dims, substrate,
  style, `hardscape[]`, `plants[]`, plus view settings (`mode`, `quality`,
  `showGuides`, `grownIn`). `getLayout()`/`loadLayout()` back export/import.
- **Procedural hardscape** (`src/lib/proceduralRock.ts`): a seed → a deformed
  icosahedron. Only the `seed` is persisted, so layouts stay tiny. "Regenerate"
  just rolls a new seed.
- **Editing loop:** click a piece → `selectItem` → drei `TransformControls`
  (move/rotate/scale) writes the transform back to the store `onObjectChange`.
  `OrbitControls makeDefault` lets TransformControls auto-disable orbit mid-drag.
- **Plant painting:** select a species in `PlantBrowser` (`activePlantId`, tool
  → `paint`) → click the substrate → `addPlantPatch` drops a scaled, colored
  instanced patch at the hit point.

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
sand/gravel), procedural rocks + driftwood with transform + stacking, plant
browser with filters + paint-to-fill, composition guides + style presets,
grown-in toggle, quality slider, orbit camera, basic underwater mode (water +
wandering fish + patch sway), export/import + screenshot.

**Deferred (next milestones):**
1. Real scanned glTF hardscape + PBR textures + HDRI environment (realism).
2. Snap-to-surface / light physics so stacked pieces rest naturally.
3. Underwater realism: caustics, god rays, refraction, animated surface,
   per-blade plant sway shader, submerged-camera waterline post-fx.
4. Full GPU/instanced **boids** (separation/alignment/cohesion) + hardscape
   avoidance for fish.
5. Alpha-textured billboard foliage (replace cone "blades").
6. Back-glass background image/color; sketch-to-3D rock drawing; accounts/
   sharing gallery; mobile/touch.
