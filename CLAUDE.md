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
  `src/data/hardscapeMaterials.ts`; a **rock form** (base primitive + sculpt
  defaults) in `src/data/rockForms.ts`; a **PBR surface** in
  `src/data/hardscapeTextures.ts`; a plant in `src/data/plants.ts`; a tank size
  in `src/data/tankPresets.ts`; a fertilizer salt / remin product / EI target /
  substrate density / light band in `src/data/dosing.ts` (calculator tables). The
  palette, pickers, renderers, and calculators all read from these lists — don't
  hardcode items in components.
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
       │               branching `drift` / generated `mesh` from a height field /
       │               hand-`sculpt`ed welded mesh + displacement) OR .glb model;
       │               look = TriplanarMaterial (procedural PBR surface — ON BY
       │               DEFAULT via material.textureId, or an uploaded image) +
       │               per-piece color tint, or flat vertex-color fallback; + gizmo
       │               / rock-sculpt brush (rocksculpt tool)
       ├─ PlacementGhost (spec-driven cursor ghost; commits via `commitPlacement`)
       ├─ PlantTools (tweezers + ghost sprig when planting / scissors when trimming)
       ├─ Plants     → Patch (instanced crossed-billboard cards, paint-to-fill)
       ├─ Caustics · Water · Bubbles · Fish                 (underwater mode)
       ├─ CompositionGuides   front-view thirds/golden grid drawn ON the glass
       │                       (front / back / both pane; design mode + toggle)
       ├─ ColorGrade (EffectComposer, mounted only when grade ≠ neutral)
       └─ OrbitControls(makeDefault, enabled only when tool==="select"); paint
          raycasts Substrate/Hardscape. **deselectAll** (clear selection + reset
          tool→select, re-enabling orbit) is wired to Escape, empty-space click
          (onPointerMissed), and SelectionBar "Done"/Move-Rotate-Scale — so a
          brush/sculpt mode never traps the camera.
  └─ UI overlay:
     · Toolbar — primary actions inline (Design/Underwater · undo/redo · Clean ·
       Save · Gallery · Calc) + two native `<details>` popovers: **View ▾** (Zen ·
       plants visibility · Guides + face/ratio · Growth · Quality) and **⋯ More**
       (Capture · Export · Import · Reset). Declutters ~18 controls into a calm row.
     · LeftRail (`ui/LeftRail.tsx`) — a thin vertical **icon tab rail** + ONE
       active section panel (replaces the old 7-panel scroll stack, killing the
       scroll-to-find problem). Sections: Tank (`TankPanel`) · Hardscape
       (`HardscapePalette`) · Plants (`PlantBrowser`) · Terrain (`DrawPanel`) · Scene
       (`BackgroundPanel`+`LightPanel`+`GradePanel`) · Fish (`FishPanel`,
       enabled only underwater). Active section = local `useState` in `Studio.tsx`
       (transient, mirrors `calcOpen`); an effect **auto-switches** to Fish on
       entering underwater. The right column is gone → more canvas.
     · SelectionBar (**right-docked panel**, when a piece is selected) —
       Move/Rotate/Scale · ✎ Customize toggle · Regenerate · Duplicate · Remove · ✕
       Done, with `HardscapeEditPanel` rendered **inline below** in the same right
       column (Customize defaults open). Right column = contextual/temporary
       (selection), left rail = always-available sections — keeping the per-piece
       look editor on the screen edge so it never covers the centered rock (the old
       bottom-center popover did).
     Shared atoms in `ui/primitives.tsx`: `Btn`/`Swatch` + `SectionLabel` ·
     `Field` · `Select` (dark `colorScheme`) · `Slider` (value readout) ·
     `IconTab` (rail, `role="tab"`) · `Disclosure` (the `<details>` popover).
     Global keyboard focus ring via `:focus-visible` in `globals.css`;
     `--color-aqua` token now defined (was referenced but missing → selection
     accents render).
     · Responsive: the editor is fluid down to **~768px** (`md`) — Toolbar &
       SelectionBar `flex-wrap`, modals & Disclosure popovers clamp to
       `calc(100vw-…)`, a `viewport` export locks zoom, and `@media (pointer:
       coarse)` gives ~44px touch targets. **Below `md`** a dismissible
       `MobileNotice` (`md:hidden`) points to the (responsive) Gallery — full
       phone editing / touch gizmo are deferred (ponytail: real 3D design wants a
       real screen).
  └─ Gallery (full-screen overlay, mounted when libraryStore.galleryOpen):
     Grid | Showroom views of saved scapes; open one → loadLayout, New → reset
  └─ CalculatorOverlay (full-screen overlay, local `calcOpen` state in Studio):
     manual aquascaping calculators, see "Calculators" below
```
- **`useStudioStore`** is the single source of truth: tank dims, substrate,
  style, `hardscape[]`, `plants[]`, `lights[]` (the overhead rig), plus view
  settings (`mode`, `quality`, `showGuides` + `guides` {face, ratio}, `growth`,
  `grade` — the global
  brightness/contrast/saturation/hue color grade) and the plant `brush`
  (`radius`/`density`/`scale` applied to newly painted patches). Transient,
  never persisted: `selectedId`, `transformMode`, `activePlantId`, `activeGround`,
  `tool` (now `select|plant|ground|place|sculpt|trim|rocksculpt`), `sculptDir`
  (+1 raise soil / push rock out, −1 carve), the **rock-sculpt brush** state
  (`sculptBrush` draw|smooth|grab|flatten|pinch, `sculptRadius` 0..1, `sculptStrength`
  0..1), and the placement pair
  `placing` (a `PlacementSpec` = what the cursor is armed to drop)/`placingSeed`.
  Also persisted: `customMeshes`
  (meshId → grayscale height PNG for generated pieces, mirrors
  `customPlantTextures`), `customSurfaces` (custom-id → uploaded surface image data
  URL, used by triplanar — mirrors `customPlantTextures`), and `customPlants`
  (user-created `PlantSpecies[]`, each
  paired with a `customPlantTextures` image — the "add your own plant" library).
  **Base rock model:** upload one `.glb` in the palette's **Yours** section
  (`setBaseRockModel`). It becomes a **placeable stamp** — placing it makes **that
  piece** a model rock (`source:"model"`); other rocks stay procedural. A persisted
  **`useModelForAllRocks`** toggle (opt-in, default false) additionally renders the
  glb for every procedural rock. The shared predicate **`isModelRock(item, hasModel,
  allRocks)`** (`src/lib/hardscapeModel.ts`) is the single source of truth for the
  render `useModel`, the Customize `usingModel`, and `convertToSculpt`. Placed rocks
  are varied by a Y-spin + ±15% scale jitter (in `addHardscape`/`addGeneratedHardscape`).
  The
  multi-MB `.glb` is **too big for localStorage**, so its bytes live in
  **IndexedDB** (`src/lib/modelStore.ts`, native API, one key); only a
  `hasBaseRockModel` flag persists, and `rehydrateBaseRockModel()` (called on
  mount in `Studio.tsx`) rebuilds the transient `baseRockModelUrl` object URL each
  session. **Per-piece customization on model rocks:** `ModelRock` (in
  `Hardscape.tsx`) extracts the glb's first mesh geometry (baked + normalized,
  cached per scene in a `WeakMap`) and renders it through the **same `<mesh>` +
  material branch as procedural rocks**, so each placed rock takes its own
  uploaded photo / library `surface` / color tint / roughness; a fresh model rock
  defaults to the glb's **own baked material** (cloned + tinted per piece). Model
  rocks resolve `textureId` from `item.textureId` only (ignoring the material
  default) so the boulder texture shows until explicitly overridden.
  **Shape of model rocks:** (1) **squash/stretch** — `item.shape` Vec3 (W/H/D
  sliders) applied as a non-uniform scale on `ModelRock`'s inner `<mesh>` (the
  group keeps a uniform scale so the transform gizmo stays uniform); (2)
  **hand-sculpt** — `convertToSculpt` on a model rock sets `source:"sculpt"` +
  `sculptBase:"model"`, and a shared `BaseSculptLoader`/`BaseSculptContext` builds
  the glb into a **`SimplifyModifier`-simplified** (~6k-vert) sculpt base **once**
  (cached per scene, lazy — only when a glb rock is first sculpted), which the
  existing rock-sculpt brush stack then drives unchanged (each rock clones the
  template; shares basePos/adj read-only). The base is **welded by POSITION only**
  (uv/normal/tangent dropped before `mergeVertices`) so the glb's UV/normal seams
  can't tear into cracks when brushed → a watertight surface; the boulder texture
  is then applied **triplanar** (world-space `albedoMap`, no UVs). `HardscapeEditPanel` shows W/H/D + the
  Sculpt button for model rocks (Form picker stays hidden). ponytail ceilings:
  `.glb` only (no `.obj`); ONE global base model (not per-scape — saved scapes/
  exports don't embed it); **single-mesh glb** (first mesh only); glb-sculpt base
  is **re-derived by deterministic simplify** each load (only the dense int16
  displacement persists, ~35 KB/rock) — a three.js upgrade could shift
  `SimplifyModifier` output and misalign a stored sculpt → re-sculpt if so. A persist `version`/`migrate` (now v7) maps the legacy
  `grownIn` boolean → `growth`, seeds a default light rig, and defaults
  `customMeshes`/`customSurfaces`. **Both `getLayout()` (export) and `partialize`
  (the localStorage autosave) prune custom assets to referenced-only** via
  `pruneCustomAssets()` — unreferenced uploads/meshes would otherwise pile up and
  exceed the ~5 MB quota; `loadLayout()` restores them. The debounced persist
  `flush` swallows a `QuotaExceededError` (warns once) so a full disk can't crash
  the editor — the in-memory scape + undo are unaffected; Export to save off-device.
- **Gallery / saved scapes** (`useLibraryStore`, separate persist key
  `aquascape-studio:library`): a local library of `SavedScape` {id, name, thumb
  (downscaled JPEG data URL), layout, dates} kept out of the editor's
  snapshot/undo. `Toolbar` **Save** → `captureThumbnail(canvas)` +
  `getLayout()` → `createScape`/`updateScape` (updates the open `currentId`, else
  prompts a name); **Save floods the tank first** (`setMode("underwater")`, ~500ms
  settle) so tiles read like contest-gallery photos. **Gallery** opens a
  full-screen `Gallery` overlay (`galleryOpen`, transient) with two views (header
  toggle): **Grid** (dark contest-style tile grid) and **Showroom** (a single
  **navigable 3D gallery** — `Showroom3D`, one `<Canvas>`: a premium **ADA Nature
  Aquarium Gallery** where the tanks are museum pieces, not décor. A long, **dark**
  off-white hall over a **polished-concrete reflector floor** (`MeshReflectorMaterial`),
  minimal ceiling with **recessed emissive light strips** (streak in the floor) and
  a dim procedural IBL (`Environment` + `Lightformer`s — studio env for glass/metal
  Fresnel, **no external HDRI**, sidesteps the CORS gotcha). Tanks sit on **identical
  matte-charcoal cabinets** (recessed doors + brushed-alloy trim), aligned in one row
  with **generous gaps** (`GAP`); once ≥5 scapes exist the largest-volume scape is
  pulled forward as a **freestanding hero centrepiece**. Each tank is **flooded + lit
  by its own saved light rig** behind the **same backdrop it was designed with**
  (`BackdropPanel`) with its **own fish** (per-scape `FishConfig`, `ambient` fill off).
  Above every tank a **suspended anodized pendant** (near-invisible cables, emissive
  bar, `spotLight` + soft **volumetric cone**); the room stays dark and **each exhibit
  brightens as the camera approaches** (per-`ExhibitView` `useFrame` lerps its
  spot/fill/emitter/cone by camera distance + a faint pendant flicker). Atmosphere:
  **floating dust** (`Sparkles`), `fog`, `ContactShadows`, and a postprocessing stack
  (`EffectComposer`: subtle **DoF** focused on the featured exhibit so the background
  softly blurs, **Bloom** on the bright water/emitters, **Vignette**, default
  `ToneMapping`). Curated **framed prints** (saved thumbnails) hang above alternating
  exhibits; minimal benches in the open hall. **Camera = a museum walk, not orbit**:
  damped `CameraControls` (inertia via `smoothTime`, slow dolly/truck); clicking a
  tank glides to its viewing **waypoint** and shows a plaque (name + **Open scape** /
  **Step back**). **Showcase mode** (header toggle) auto-features one exhibit every
  ~17s, slowly transitioning the camera between them — a luxury archviz walkthrough.
  ponytail ceilings: every tank renders its own lights/fish (fine for dozens, add
  LOD/instancing for hundreds); no hand-rolled head-bob (CameraControls inertia
  carries the feel)).
  Both: click → `loadLayout` + `setCurrent`, **New scape** → `reset()`. Grid
  tiles are **live 3D** (`LiveTank` in `src/components/scene/LiveTank.tsx`): an
  IntersectionObserver mounts a small `<Canvas>` per on-screen tile that renders
  that scape from its `Layout` (slow turntable, underwater tint if saved
  underwater) and unmounts off-screen — bounding WebGL contexts; the captured
  thumbnail is the off-screen fallback (canvas is pointer-transparent so the tile
  still handles click-to-open). The shared, **store-free** scene graph is
  `ScapeContent` (exported from `LiveTank.tsx`) — re-renders a scape from layout
  props using the same pure helpers as the editor (`makeRockGeometry`,
  `makeDriftwoodGeometry`, `meshFromHeightfield`, `TriplanarMaterial`,
  `usePlantTexture`, `terrain.sampleField`), so a preview can never mutate the
  working scape; both the grid tiles and the `Showroom3D` room mount it.
  ponytail ceiling: `Showroom3D` renders **all** scapes at once in one canvas
  (no culling beyond three's frustum) — fine for dozens, add LOD/instancing if a
  room holds hundreds. **Layout is now
  v2**: `getLayout()` captures the full look (lights/fish/grade/ambience/growth/
  guides/mode + referenced `customPlantTextures`) so a reopened scape — incl. its
  underwater settings — restores exactly; `loadLayout()` defaults each field so v1
  files still load, and `importLayoutFile` accepts v1|v2. `reset()` now clears the
  whole look (blank slate), not just contents. ponytail ceiling: thumbnails live
  in localStorage (~5 MB) — fine for dozens of scapes, move to IndexedDB for
  hundreds.
- **Add-hardscape flow (unified "Browse → Place → Tweak"):** `HardscapePalette`
  is one **stamp gallery** — sections **Rocks** (library materials + Slab/Spire/
  Arch/Bowl forms) · **Wood** (materials + Driftwood generator) · **Yours** (the
  uploaded `.glb` as a placeable stamp + the upload control + "Use for all rocks")
  · **Create** (Draw→3D / Photo→3D modals). **Every stamp arms the SAME
  ghost-place gesture**: a click calls `beginPlacing(spec: PlacementSpec)`
  (`material`/`form`/`drift`/`model`), `PlacementGhost` previews + tracks the
  cursor, and a scene click runs **`commitPlacement(pos)`** (dispatches to
  `addHardscape`/`addGeneratedHardscape` with the cursor position + a fresh seed).
  Placement **stays armed** so you can drop several (Esc/Done cancels); the gizmo
  is hidden while `tool==="place"` so repeat clicks aren't intercepted. (Draw/Photo
  stay modal create-then-drop — the AI mesh doesn't exist until processing ends.)
- **Hardscape geometry by `source`** — every `HardscapeItem` carries optional
  per-piece overrides (back-compat: undefined = legacy procedural). Edits all go
  through the existing `updateHardscape(id, patch)`; generated pieces are created
  with `addGeneratedHardscape(partial)`:
  - `procedural` (`src/lib/proceduralRock.ts`): a **base primitive chosen by
    `form`** displaced by layered 3D value noise — smooth `fbm3` bulges + a
    *ridged* `ridged3` term for sharp angular crests + a fine octave + an optional
    **`worley3` cellular pitting** term that carves rounded craters (inward at cell
    centres) with thin sharp walls — the **Dragon-stone "scale" look** (`pitting`
    strength + `pitScale` density; clamped ≤0.25·R so faces can't invert; `pitting:0`
    ⇒ legacy rocks unchanged); per-seed
    frequency/strength/anisotropy jitter so no two rocks are siblings. **Forms**
    (`src/data/rockForms.ts`, `ROCK_FORMS`): boulder/cobble/slab/plate/spire/shard/
    **dragon** (icosa + baked pitting; the Dragon Stone material points at it)
    use an `IcosahedronGeometry` (displaced **radially** — duplicated polyhedron
    verts share a direction → gap-free); **arch** uses a half-`TorusGeometry` and
    **bowl** a `LatheGeometry` U-profile (displaced along the shared **normal**) so
    they're genuinely **non-convex**, not lumpy spheres. Post-transforms: `shape`
    axis scale → `taper` (radius by height) → `flat` (planar cleave → flat faces)
    → `tilt`. Per-piece overrides (`form`/`shape`/`jaggedness`/`detail`/`strata`/
    `veinColor`/`taper`/`flat`/`tilt`/`pitting`/`pitScale`) win over the form
    default, then the
    material. Only seed+params persist, so layouts stay tiny. The lib is data-free
    (the render layer resolves `form`→`primitive`) so its `node`-runnable
    self-check works.
  - `drift` (`src/lib/driftwood.ts`): `makeDriftwoodGeometry(seed, DriftParams)` —
    recursive tapered tubes (manually merged, no deps), bark vertex colors.
  - `mesh` (`src/lib/heightfieldMesh.ts`): rebuilt async from
    `customMeshes[meshId]` — a grayscale height PNG → `meshFromHeightfield`
    (front +H / back −H with a z=0 rim seam → a closed, orbitable volume). Fed by
    **Draw → 3D** (`src/lib/inflate.ts`: distance-transform "puff" of a sketched
    silhouette, then `roughenHeight` stamps 2D fbm + ridged relief so it reads as
    stone not a pillow; `DrawShapeModal` shows a live R3F preview + mirror is off
    by default) or **Photo → 3D** (`src/lib/depthFromImage.ts`: Depth-Anything
    depth × bg-removal mask). `heightToDataUrl`/`loadHeightField` (de)serialize.
  - `sculpt` (`src/lib/rockSculpt.ts`): the **Blender-style hand-sculpt** path.
    `convertToSculpt(id)` freezes a procedural rock's effective params (so the
    welded vertex order is stable) and bumps detail to a sculpt resolution; the
    render rebuilds the deterministic base, **welds it** (`mergeVertices` →
    indexed, smooth normals, no cracks), and adds a **per-vertex vec3 displacement**
    from `item.sculptD` (quantized int16 base64 — the only thing that persists, a
    few KB). The `rocksculpt` tool drives a clay brush set — **draw** (push/pull
    along the normal, ±`sculptDir`), **smooth**, **grab** (camera-plane drag, rides
    a window listener so it tracks off-silhouette), **flatten**, **pinch** — each
    mutating the live geometry + `disp` in lockstep during a drag, then committing
    `encodeDisp(disp)` via `updateHardscape` on stroke-end (one undo). The lib is
    pure array math (no three/DOM) with a `node`-runnable self-check; the editor
    (`Hardscape.tsx`) and gallery (`LiveTank.tsx` `PreviewPiece`) both weld+apply.
    ponytail ceiling: welded `detail:4` (~2.5k verts) + a dense int16 buffer
    (~15–20 KB/rock) — fine for dozens, sparse-encode / IndexedDB for hundreds.
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
  Regenerate (SelectionBar) rolls a new seed (rock + drift). **Bring-your-own
  texture:** the Surface row's **＋ Upload** runs `loadSurfaceImage` (downscale →
  WebP data URL, no bg-removal — it tiles), stores it in `customSurfaces` under a
  `"custom:"`-prefixed id, and points `item.textureId` at it. `TriplanarMaterial`
  takes an `albedo` texture instead of a `surface` (the shader's `#ifdef` map
  guards drop normal/roughness → flat fallback), `useSurfaceTexture` loads it as a
  `RepeatWrapping` texture, and `item.textureScaleCm` (Tex scale slider) sets the
  triplanar repeat.
- **Editing loop:** click a piece → `selectItem` → drei `TransformControls`
  (move/rotate/scale) writes the transform back to the store `onObjectChange`.
  `OrbitControls makeDefault` lets TransformControls auto-disable orbit mid-drag.
- **Clean** (Toolbar **✨ Clean** → `cleanScape` action → pure
  `src/lib/autoScape.ts`): one-click trim — **removes only** any hardscape/plant/
  ground piece whose center sits outside the glass (`|x|>w/2 || |z|>d/2`); they're
  deleted, not relocated inside. Nothing is added, reseated, or nudged — every
  piece inside the tank is left exactly as placed (same object refs). The lib is
  dependency-free (only `./types`) so it has a `node`-runnable self-check and never
  touches GPU/store state. Wrapped in `beginTxn`/`endTxn` → one undo step.
- **Calculators** (Toolbar **🧮 Calc** → `CalculatorOverlay`, full-screen overlay
  via a local `calcOpen` useState in `Studio.tsx` — **no store flag**, mirrors the
  Gallery shell): a manual aquascaping reference. **Pure math** lives in
  `src/lib/aquacalc.ts` (dependency-free, `node`-runnable self-check like
  `autoScape.ts` — functions take looked-up numbers as args so the lib stays pure),
  **reference tables** in `src/data/dosing.ts` (salts + element mass fractions, EI
  targets, remin products with editable dose rates, substrate densities, light
  bands). Tabs grouped Water&volume / Dosing&chemistry / Equipment / Composition:
  volume (gross/net + gal), substrate (vol/bags/weight), water-change & dilution,
  unit converter, dry-salt↔ppm + EI, CO₂ from pH/KH, GH/KH remin, filter turnover,
  heater wattage, lighting W/lm per L, composition focal points, rough stocking.
  Pre-fills inputs from the **live `tank`/`substrate`** (net-volume estimate
  `estNet` shared to chemistry/equipment tabs). **Two-way:** the Volume and
  Substrate tabs have **Apply** buttons that call the existing `setTank` /
  `setSubstrate` (no new store actions). Inputs are kept as **strings** (parsed via
  `num()`) so decimals type cleanly; state is transient (reopen reseeds from live
  values). ponytail ceilings: lighting is W/L & lm/L ballpark (real PAR needs a
  meter), stocking is a rough cm-per-L guide, heater `K` + remin rate are editable
  calibration knobs — all flagged in-UI.
- **Backdrop** (`src/components/scene/Backdrop.tsx`): two independent things —
  (1) **scene ambience** = the room/clear-color behind everything (`ambience`
  hex in the store, dark→light swatches), and (2) the **tank backdrop**, a
  physical plane sized edge-to-edge to the back glass (`w+1 × h+1`, just behind
  it at `z=-(d/2+0.3)`) so it reads as a poster on the back panel, never a white
  "sky". Styles: `none` (transparent — ambience shows through) / `solid` /
  vertical `gradient` / `backlit` radial glow with controllable color, intensity
  (`glow`) and source position (`glowX`/`glowY`). Config in `background`, presets
  (white/black/blue/aqua/night/Lumen/Lagoon/Sunset) in `src/data/backgrounds.ts`.
- **Drawing / painting (the "pen"):** `tool` is `select | plant | ground | sculpt | trim`.
  Pick a plant (`PlantBrowser` → `activePlantId`), a material (`DrawPanel` →
  `activeGround`), **Sculpt slope** (Raise/Carve in `DrawPanel`), or **✂ Trim &
  shape** (`PlantBrowser`), then press-drag on the tank. The stroke engine
  (`src/lib/surfaceInteraction.ts`: `beginStroke`/`moveStroke`/`endStroke`)
  raycasts the **paintable** surfaces (Substrate, Hardscape, GroundCover —
  tagged `userData.paintable`) so everything lands on the real surface. Plant
  blades are sampled per-blade onto the surface (slope/stone/wood); material
  patches (`ground[]`, rendered by `GroundCover`) are laid level; **trim** cuts
  the `hMul` of every blade within the brush radius of the cursor shorter
  (`trimPlants` in the store — drag the scissors to sculpt the canopy; one undo
  per stroke). OrbitControls is disabled while a brush is active
  (`enabled={tool === "select"}`) so dragging draws; deselect/stop via
  `onPointerMissed` or the panel stop button.
- **Hand-tool cursors** (`src/components/scene/PlantTools.tsx`): while the plant
  tool is armed, a pair of **tweezers** lowers a translucent **ghost sprig** of
  the chosen species onto the surface; while trimming, a pair of **scissors**
  snips over the canopy. Both follow a shared `hover` point (exported from
  `surfaceInteraction.ts`, written on paintable-surface `onPointerMove`, cleared
  `onPointerOut`) updated **imperatively in `useFrame`** (no React renders), face
  the camera by azimuth, and are non-raycastable (`raycast={()=>null}`) so they
  never block the paint stroke beneath them. A footprint **ring** shows the brush
  area. ponytail ceiling: procedural box/torus tools (not real models), animated
  by sine — swap for a `.glb` if you want photoreal hardware.
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
- **Add-your-own plant (new species):** `PlantBrowser`'s **"＋ Add custom plant"**
  opens `AddPlantModal` (`src/components/ui/AddPlantModal.tsx`) — pick a photo
  (same `processPlantImage` cutout, shown on a checker bg) + fill name / category /
  leaf form / difficulty / default height range / color, then **Add plant** →
  `addCustomPlant({...})` mints a `PlantSpecies` (store-generated id always wins)
  into `customPlants[]` (persisted) + stashes the cutout in
  `customPlantTextures[id]`, and arms it for painting (`setActivePlant`). It shows
  in the browser list alongside the built-in species (✎ reopens the same modal to
  **edit** it via `updateCustomPlant`; 🗑 deletes the species, its image, and any
  placed patches). The modal mounts inside `PlantBrowser` (fixed-position works
  even under the blurred panel, like `DrawShapeModal`) and uses `colorScheme:dark`
  selects so the native dropdowns stay readable on the dark theme. Species
  lookup is `getSpecies(id) ?? customPlants.find(...)` in both the editor
  (`Plants.tsx`) and the gallery (`LiveTank` PreviewPatch, via `layout.customPlants`).
  `getLayout()` prunes `customPlants`/`customPlantTextures` to referenced ids;
  `loadLayout()`/`reset()` treat them like `customPlantTextures` (replace/clear) —
  ponytail: switching scapes/reset wipes the custom palette; lift to a persistent
  asset library if that's annoying.

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
- **Persist is debounced (perf):** `useStudioStore`'s `storage` is
  `debouncedPersistStorage()` (not raw `createJSONStorage`) — it defers BOTH the
  `JSON.stringify(layout)` and the `localStorage.setItem` to a ~400ms trailing
  edge. Editor gestures (transform drag ~60Hz, paint/sculpt strokes, sliders)
  each call `set()`, and the layout carries base64 `customMeshes`/
  `customPlantTextures`, so writing per-`set` melted the main thread. Flushes on
  `pagehide` + `visibilitychange`→hidden so a tab close mid-window isn't lost
  (worst case <400ms of edits; in-memory undo history is unaffected).
- **Screenshots** require `gl={{ preserveDrawingBuffer: true }}` on `<Canvas>`.
- **Bundle assets locally** (see `public/ASSETS.md`) — third-party image hosts
  lack CORS headers and WebGL will reject the texture. Procedural/placeholder
  fallbacks exist for everything today.
- **Plant cutouts are served as WebP (perf):** `public/plants/*.webp` (≤768px,
  ~1 MB total) — they double as 3D billboard textures AND the plant-browser
  thumbnails, so the served files must stay small. High-res PNG **sources** live
  in `assets/plants-src/` (in git, **not** served/deployed). Add/refresh a cutout:
  drop `<id>.png` there → `node scripts/encode-plants.mjs` (sharp resize→WebP q82)
  → reference `/plants/<id>.webp` in `src/data/plants.ts`. The browser `<img>` thumb
  is `loading="lazy"`. (Was ~18 MB of raw PNG fetched on first plant-panel open.)

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
**sculpt sliders** + **upload-your-own texture** image), **Blender-style hand
sculpting** of any rock (welded mesh + a clay brush set — push/pull, smooth, grab,
flatten, pinch — that reshapes it from all angles, persisted as a small per-vertex
displacement), and **make-your-own hardscape** — a **branching driftwood
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
back, or both glass panes) + style presets, a one-click **✨ Clean** (remove
only the pieces left outside the tank — nothing added or moved), a **growth slider** (just-planted → grown-in,
scaling plant height + fullness), a global **color grade**
(brightness/contrast/saturation/tint post-process, captured in screenshots),
quality slider, orbit
camera, **underwater mode** (tank-only water whose **god-ray shafts,
caustics, water tint + surface glare are all driven by the light rig** — per
fixture type/color/position/intensity, with depth-based warm absorption via
`src/lib/lightRig.ts`; animated caustics [floor + mid-water sheets] + bubbles +
**suspended particulate** (drei `Sparkles`), an **animated/shimmering surface**, an
**orbit-tracking depth-haze fog** (`HazeFog` in `Water.tsx` — linear fog whose near/far
ramp across the tank's depth from the camera so the back reads murkier than the front)
and **underwater post-FX** (`ColorGrade` mounts one EffectComposer with Bloom on bright
glints + Vignette; Bloom skipped on low quality), plus **fish you control** —
count/size/colour palette/swim pattern [school·calm·dart·scatter]/speed — that flock and
steer off the glass. **Fish interactions** (`fishInteract` transient store flag, set from
the Fish panel **Interact** toggles): **🍤 Feed** (a food-box cursor; click the tank →
`addFood` drops sinking pellets and a random **60–70%** of fish swarm + "eat" them) and
**👆 Follow** (a random 60–70% trail the cursor). Both reuse the `hover`-style singleton
pattern in `src/lib/fishInteraction.ts` (`pointer`/`food` mutated on events, read in
`useFrame` — no React renders) + an opacity-0 raycast box in `FishInteraction.tsx`; the
participant subset is **re-rolled per event** (new drop / Follow-on) so it's never the same
fish. Orbit is paused while a fish interaction is armed (`tool === "select" &&
fishInteract === "none"`)), a **saved-scape gallery** (Save the current scape — auto-flooded
underwater for the tile — into a local, dark contest-style gallery grid; reopen
restores its full look, New starts a blank slate), export/import + screenshot.

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
