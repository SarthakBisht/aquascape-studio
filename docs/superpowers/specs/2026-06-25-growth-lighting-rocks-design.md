# Growth Slider · Light Rig · Rock Library + Placement — Design

**Date:** 2026-06-25
**Project:** aquascape-studio (`c:\projects\MVPs\aquascape-studio\`)
**Status:** Approved, ready for implementation plan

Three independent features added to the 3D aquascaping studio:

1. A global **plant growth slider** (replaces the binary grown-in toggle).
2. An **overhead light rig** — add/remove configurable fixtures above the tank.
3. An **expanded procedural rock library** + **ghost-preview click-to-place**.

All three follow the project's existing patterns: a single zustand store as the
source of truth, data-driven libraries, small single-purpose R3F components, and
`1 three.js unit == 1 cm`. No backend, no new test runner — the existing gate is
`pnpm build` + `pnpm exec tsc --noEmit` plus a manual visual check.

---

## Feature 1 — Plant growth slider (global; height + fullness)

### Goal
Replace the all-or-nothing "Just planted / Grown-in" toggle with a continuous
global slider controlling how grown-in **all** plants look, affecting both
**height** and **fullness**.

### Data model (`src/store/useStudioStore.ts`, `src/lib/types.ts`)
- Remove `grownIn: boolean`; add `growth: number` (0..1, default `0.25`).
- Remove `setGrownIn`; add `setGrowth(v: number)`.
- Add to `partialize` (persisted).
- **Persist migration:** bump the persist `version` to `1` and add a `migrate`
  that maps legacy persisted state: `grownIn === true → growth: 1`,
  `grownIn === false → growth: 0.25`. Also guard for `growth === undefined`
  (default `0.25`) so older blobs without the field load cleanly.

### Rendering (`src/components/scene/Plants.tsx`)
- Replace `const grownIn = useStudioStore(s => s.grownIn)` with
  `const growth = useStudioStore(s => s.growth)`.
- **Height** (continuous lerp, replacing the binary branch):
  `targetH = (minH * 0.55 + (maxH - minH * 0.55) * growth) * userScale`
  — i.e. young sprout (~55% of min height) at `growth = 0`, full `maxH` at
  `growth = 1`. Heights stay capped to the tank as today (`capAt`).
- **Fullness** (reveal a fraction of the already-sampled blades):
  `const visible = Math.max(5, Math.round(count * (0.5 + 0.5 * growth)))`,
  then slice the blade list to `visible`. Because patches pre-sample blades at
  full density at paint time, this needs **no re-sampling** — low growth simply
  renders fewer blades (sparser, younger), high growth renders all of them.
  Applies to both the pre-sampled path and the legacy flat-scatter fallback.
- Add `growth` to the `blades` `useMemo` dependency array.

### UI (`src/components/ui/Toolbar.tsx`)
- Replace the grown-in `Btn` with a compact labeled **Growth** slider
  (`<input type="range" min=0 max=1 step=0.01>`), styled to match the existing
  Quality `<select>` (small, `text-stone`). Ends labeled young ↔ lush (or a `%`).
- Wire `value={growth}` / `onChange → setGrowth(Number(e.target.value))`.

### Out of scope
Per-patch growth, growth animation over time.

---

## Feature 2 — Overhead light rig (add / remove fixtures)

### Goal
Let the user build the lighting above the tank: add/remove fixtures, choose each
fixture's **type**, and tune its **intensity, color/warmth, and position**. The
rig drives the scene's main lighting in both design and underwater views.

### Data model (`src/lib/types.ts`, `src/store/useStudioStore.ts`)
```ts
export type FixtureType = "spot" | "flood" | "rgb";

export interface LightFixture {
  id: string;
  type: FixtureType;
  /** Position above the tank, cm offset from tank center along width (x) / depth (z). */
  x: number;
  z: number;
  /** Height of the fixture above the tank rim, in cm. */
  height: number;
  /** Brightness multiplier (~0..3, default 1). */
  intensity: number;
  /** Color temperature, warm 3000K .. cool 8000K. Drives spot/flood color. */
  kelvin: number;
  /** Hex color — used by the `rgb` accent type only. */
  color: string;
  /** Toggle a fixture off without deleting it. */
  on: boolean;
}
```
- Store: persisted `lights: LightFixture[]`.
- **Default rig:** one `flood` fixture, centered (`x:0, z:0`), `height ≈ tank.height * 0.5`,
  `intensity: 1`, `kelvin: 6500`, `on: true`. Seeded as the initial store value
  (and via the migration default for older persisted blobs that have no `lights`).
- Actions: `addLight(type: FixtureType)` (sensible defaults per type),
  `updateLight(id, patch: Partial<LightFixture>)`, `removeLight(id)`.
- Add `lights` to `partialize`. Reuse the persist `version`/`migrate` from
  Feature 1 to inject the default rig when `lights` is missing.

### Rendering (`src/components/scene/Lighting.tsx` — rewrite)
- **Baked fill (not user-editable):** a low `ambientLight` + low `hemisphereLight`
  (reduced from current values, keep the underwater cool tint) so the scene is
  never pitch-black even with all fixtures off.
- **Per fixture** → one three.js light positioned at `[x, tank.height + height, z]`,
  aimed straight down at `[x, 0, z]` (spotlight `target`):
  - `flood` → wide soft `spotLight` (`angle ≈ 0.9`, `penumbra ≈ 0.7`) — broad even wash.
  - `spot` → tight `spotLight` (`angle ≈ 0.35`, `penumbra ≈ 0.2`) — hard pool of light.
  - `rgb` → colored `spotLight` (`angle ≈ 0.6`, `penumbra ≈ 0.6`) using `color`,
    for mood / backlight accent.
  - Skip fixtures with `on === false`.
  - Effective `intensity` = base-per-type × `fixture.intensity` (× a small
    underwater factor so underwater isn't blown out, matching today's feel).
  - Color for `spot`/`flood` = `kelvinToRgb(kelvin)`; `rgb` uses `fixture.color`.
- **New helper** `src/lib/lightColor.ts`: `kelvinToRgb(k: number): THREE.Color`
  (standard black-body approximation; pure function, no deps).
- Remove the old hardcoded underwater overhead `spotLight` — it's a fixture now.
- `Lighting` reads `lights` + `tank` from the store (or via props from
  `TankScene`, matching how `dims`/`mode` are already passed).

### Visible hardware (`src/components/scene/LightFixtures.tsx` — new)
- Draws a simple fixture body above the back rim at each light's `[x, tank.height + height, z]`:
  - `flood` → thin wide box/bar.
  - `spot` → small downward cone/cylinder.
  - `rgb` → small block.
- Dark housing (`meshStandardMaterial`, dark color) with an **emissive underside**
  tinted to the fixture's light color and scaled by `intensity` when `on`, so the
  user can see which lights are active. `on === false` → no emissive.
- `userData.paintable` is **not** set (brushes ignore it); not selectable via the
  hardscape selection system. Position is controlled from the Light panel.
- Rendered from `TankScene` in both modes.

### UI (`src/components/ui/LightPanel.tsx` — new, left column)
- A `Panel` titled "Light" added to the left stack in `Studio.tsx`
  (after `HardscapePalette`, near `BackgroundPanel`).
- Header row: **+ Add** buttons (Flood / Spot / RGB) → `addLight(type)`.
- One row per fixture:
  - type label/icon,
  - **intensity** slider,
  - **warmth** slider (Kelvin) for spot/flood **or** a color swatch/picker for rgb,
  - **X** and **Z** position sliders (range derived from tank width/depth),
  - **on/off** toggle,
  - **remove** button.
- Empty state: a hint to add a light (the baked fill keeps the scene visible).

### Out of scope
Drag-gizmo positioning of fixtures, shadow casting from fixtures (perf),
animated/disco lighting, IES profiles.

---

## Feature 3 — Rock library expansion + ghost-preview placement

### 3a — Expanded procedural rock library

#### Goal
Offer a research-grounded set of real aquascaping stones, each reading
distinctly through procedural shape + surface, with **no image assets** (the
photo-as-texture path stays a deferred upgrade).

#### Stone set (data-driven, `src/data/hardscapeMaterials.ts`)
Grounded in aquascaping references (Seiryu/Dragon/Lava existing; Frodo, Elephant
Skin, Pagoda, Petrified Wood researched and added):

| id | label | shape bias | surface | base color | vein |
|---|---|---|---|---|---|
| `seiryu` | Seiryu Stone | tall, angular `[1.1,1.0,0.9]` | jagged | blue-grey `#6f7479` | white calcite `#d9dde0` |
| `dragon` | Dragon Stone (Ohko) | blocky `[1.0,1.05,1.0]` | deeply pitted | brown-red `#8a6f4e` | — |
| `lava` | Lava Rock | chunky `[1.0,0.9,1.0]` | very rough/porous | near-black `#3a3537` | — |
| `frodo` | Frodo Stone | angular slab `[1.15,0.95,0.9]` | deep furrows | grey-brown `#7c7468` | faint `#b9b2a6` |
| `elephant` | Elephant Skin Stone | rounded `[1.1,0.85,1.0]` | soft rugged ridges | light grey `#9a9690` | — |
| `pagoda` | Pagoda Stone | wide slab `[1.25,0.7,1.0]` | horizontal strata | anthracite-brown `#5a4f45` | band `#8a7b67` |
| `petrified` | Petrified Wood | elongated `[0.8,1.0,1.4]` | banded grain | warm brown `#6e5642` | band `#9a7b5a` |

(Wood entries `spiderwood` / `manzanita` unchanged.)

#### Type + generator changes
- Extend `HardscapeMaterial` (`src/lib/types.ts`) with optional:
  - `jaggedness?: number` (per-stone displacement amount),
  - `veinColor?: string` (secondary color baked into vertex colors),
  - `strata?: boolean` (horizontal banding for Pagoda/Petrified).
- Extend `RockOptions` + `makeRockGeometry` (`src/lib/proceduralRock.ts`):
  - accept `jaggedness`, `veinColor`, `strata`,
  - bake a **per-vertex color attribute**: base mottling (subtle ±brightness
    noise so the flat fill reads as stone) blended toward `veinColor` along
    high-curvature / banded regions; `strata` adds horizontal ridges to the
    displacement and aligns the color bands to `y`.
  - When `veinColor`/`strata` produce vertex colors, set the attribute on the
    geometry; otherwise still bake subtle mottling so every stone has texture.
- `Hardscape.tsx` `HardscapeMesh`: pass the material's `jaggedness`/`veinColor`/
  `strata` into `makeRockGeometry`, and enable `vertexColors` on the
  `meshStandardMaterial` (multiplies with the base `color`).

#### Performance note
Vertex-color baking happens once per geometry `useMemo` (already disposed on
unmount). No per-frame cost. Detail level unchanged (`detail: 2`).

### 3b — Ghost-preview click-to-place

#### Goal
Pick a rock type → a translucent ghost follows the cursor → click drops it
exactly there (inside the tank **or** outside on the ground), then it's selected
for move/rotate/scale.

#### State (`src/store/useStudioStore.ts`, `src/lib/types.ts`)
- Extend `tool` union to `"select" | "plant" | "ground" | "place"`.
- Add transient (NOT persisted) state:
  - `placingMaterialId: string | null`,
  - `placingSeed: number` (so the ghost and the committed rock share a shape).
- Actions:
  - `beginPlacing(materialId: string)` → sets `placingMaterialId`,
    fresh `placingSeed`, `tool:"place"`, clears `activePlantId`/`activeGround`/
    `selectedId`.
  - `cancelPlacing()` → clears placing state, `tool:"select"`.
  - Extend `addHardscape(materialId, position?: Vec3, seed?: number)` to accept an
    optional drop position (default `[0,0,0]`) and seed (default random). After a
    placement it selects the new piece and calls `cancelPlacing()`.
- `setTool("select")` and `selectItem(null)`/`onPointerMissed` also clear placing
  state.

#### Ghost component (`src/components/scene/PlacementGhost.tsx` — new)
- Active only when `tool === "place"` and `placingMaterialId` is set.
- On pointer move over the scene, raycast the paintable surfaces
  (Substrate/Hardscape/GroundCover — reuse the `paintable` tagging /
  `surfaceInteraction` target collection) **and** a fallback invisible ground
  plane at `y = 0` covering beyond the tank, so the user can place outside.
- Renders a rock built from `makeRockGeometry(placingSeed, material params)` at
  the hit point, at the default add-scale, semi-transparent
  (`transparent, opacity ≈ 0.45, depthWrite: false`).
- **Click** → `addHardscape(placingMaterialId, hitPoint, placingSeed)`.
- Dispose the ghost geometry on unmount / material change.
- Cancel via Esc (window keydown) or `onPointerMissed`.

#### Orbit handling (`src/components/scene/TankScene.tsx`)
- OrbitControls is already `enabled={tool === "select"}`; placement (`"place"`)
  therefore disables orbit so a click places instead of orbiting — same pattern
  as the paint brushes. No camera change otherwise.

#### UI (`src/components/ui/HardscapePalette.tsx`)
- Rock/wood rows: **"+ Add"** → **"Place"**, calling `beginPlacing(m.id)`.
- While placing: show a small hint ("Click in the tank to place · Esc to cancel")
  and a Cancel affordance. The empty-tank prompt ("Begin with a single stone")
  is unaffected.

### Out of scope
Photo/scanned textures, snap-to-surface physics, multi-place (hold-to-stamp),
freehand sketch-to-3D.

---

## Files touched (summary)

**New**
- `src/lib/lightColor.ts` — `kelvinToRgb`.
- `src/components/scene/LightFixtures.tsx` — visible hardware.
- `src/components/ui/LightPanel.tsx` — fixture controls.
- `src/components/scene/PlacementGhost.tsx` — ghost preview + commit.

**Modified**
- `src/lib/types.ts` — `growth` (remove `grownIn`); `FixtureType`/`LightFixture`;
  `HardscapeMaterial` (`jaggedness`/`veinColor`/`strata`); `tool` `"place"`.
- `src/store/useStudioStore.ts` — growth, lights + actions, placement state +
  actions, `addHardscape` position/seed, persist `version`/`migrate`, `partialize`.
- `src/data/hardscapeMaterials.ts` — new stones + per-stone params.
- `src/lib/proceduralRock.ts` — jaggedness/veinColor/strata + vertex-color baking.
- `src/components/scene/Plants.tsx` — growth height + fullness.
- `src/components/scene/Lighting.tsx` — fixture-driven rewrite + baked fill.
- `src/components/scene/Hardscape.tsx` — pass new geo params, `vertexColors`.
- `src/components/scene/TankScene.tsx` — mount `LightFixtures`, `PlacementGhost`.
- `src/components/ui/Toolbar.tsx` — growth slider replaces toggle.
- `src/components/ui/HardscapePalette.tsx` — "Place" arms ghost placement.
- `src/components/Studio.tsx` — add `LightPanel` to the left column.
- `README.md` + `CLAUDE.md` — document growth slider, light rig, rock library/placement.

## Verification
- `pnpm exec tsc --noEmit` clean.
- `pnpm build` passes (tsc + prerender).
- Manual visual check in `pnpm dev`:
  - Growth slider scales height + fullness smoothly; old saved scene migrates.
  - Add/remove/toggle fixtures; type/intensity/warmth/color/position all visibly
    change the scene; hardware shows above the tank; scene never goes fully dark.
  - Each new stone reads distinctly (veins on Seiryu, strata on Pagoda, pitting
    on Dragon/Lava); ghost follows cursor and drops on click inside and outside
    the tank, then is selected for transform.

## Notes / decisions
- Throwaway MVP → no test runner added (per workspace CLAUDE.md "smallest thing
  that works"); `build` + `tsc` + visual check is the gate.
- Photo/scanned rock textures and per-fixture drag-gizmos are deliberately
  deferred upgrades, consistent with the existing realism roadmap.
