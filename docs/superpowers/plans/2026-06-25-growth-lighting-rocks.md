# Growth Slider · Light Rig · Rock Library + Placement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global plant-growth slider, an add/remove overhead light rig (spot/flood/rgb fixtures), and an expanded procedural rock library with ghost-preview click-to-place — to the aquascape-studio 3D web app.

**Architecture:** Single zustand store stays the source of truth; data-driven libraries; small single-purpose R3F components. Growth becomes a `0..1` store value read by `Plants.tsx`. Lighting is rewritten to render one three.js light per persisted `LightFixture` plus a baked fill, with visible hardware and a control panel. Rocks gain per-material shape/surface params baked into geometry + vertex colors; picking a rock arms a cursor-following ghost that commits on click.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript strict, Tailwind v4, React Three Fiber v9 + drei v10 + three 0.184, zustand v5 (persist→localStorage). `pnpm` only.

## Global Constraints

- **Package manager: `pnpm`** — never npm/yarn. Dev: `pnpm dev`. Typecheck: `pnpm exec tsc --noEmit`. Build: `pnpm build`.
- **Units: 1 three.js world unit == 1 cm.** Tank is centered at `x=0, z=0`; substrate bottom at `y=0`, top at the substrate depth; tank rim ≈ `tank.height`.
- **No unit-test runner exists and none is added** (throwaway visual MVP; workspace CLAUDE.md "smallest thing that works"). Per-task verification = `pnpm exec tsc --noEmit` clean **plus** the stated manual visual observation in `pnpm dev`. The final task also runs `pnpm build`.
- **Data-driven:** a new rock = a new entry in `src/data/hardscapeMaterials.ts`; never hardcode items in components.
- **Dispose GPU resources:** geometries created in `useMemo` must be `.dispose()`d on unmount.
- **Transient editor state is never persisted** (see store `partialize`): `selectedId`, `transformMode`, `activePlantId`, `activeGround`, `tool`, and the new `placingMaterialId` / `placingSeed`.
- **Git:** before Task 1, create a feature branch (e.g. `git checkout -b feat/growth-lighting-rocks`). Commit per task. **Do not `git push` without explicit user confirmation.** Repo identity is already set.
- **Keep docs current:** `README.md` + `CLAUDE.md` updated in the final task.

---

## File Structure

**New files**
- `src/lib/lightColor.ts` — `kelvinToRgb(k)`: color-temperature → `THREE.Color`. Pure.
- `src/components/scene/LightFixtures.tsx` — visible fixture hardware above the tank.
- `src/components/ui/LightPanel.tsx` — add/remove + per-fixture controls.
- `src/components/scene/PlacementGhost.tsx` — cursor-following ghost rock + commit-on-click.

**Modified files**
- `src/lib/types.ts` — `FixtureType`, `LightFixture`; `HardscapeMaterial` gains `jaggedness?/veinColor?/strata?`; `tool` union gains `"place"`.
- `src/store/useStudioStore.ts` — `growth` (replaces `grownIn`); `lights[]` + actions; placement state + actions; `addHardscape(materialId, position?, seed?)`; persist `version`/`migrate`; `partialize`.
- `src/data/hardscapeMaterials.ts` — expanded stone set + per-stone params.
- `src/lib/proceduralRock.ts` — `jaggedness/veinColor/strata` + vertex-color baking.
- `src/components/scene/Plants.tsx` — growth-driven height + fullness.
- `src/components/scene/Lighting.tsx` — fixture-driven rewrite + baked fill.
- `src/components/scene/Hardscape.tsx` — pass new geo params; enable `vertexColors`.
- `src/components/scene/TankScene.tsx` — mount `LightFixtures` + `PlacementGhost`.
- `src/components/ui/Toolbar.tsx` — growth slider replaces grown-in toggle.
- `src/components/ui/HardscapePalette.tsx` — "Place" arms ghost placement + hint.
- `src/components/Studio.tsx` — add `LightPanel` to the left column.
- `README.md`, `CLAUDE.md` — document the three features.

---

## Task 1: Plant growth slider (store + Plants + Toolbar)

Replace the binary `grownIn` toggle with a continuous global `growth` (0..1) that drives plant height **and** fullness. Done as one task so the build stays green (all `grownIn` references removed together).

**Files:**
- Modify: `src/store/useStudioStore.ts`
- Modify: `src/components/scene/Plants.tsx`
- Modify: `src/components/ui/Toolbar.tsx`

**Interfaces:**
- Produces: store field `growth: number` and action `setGrowth(v: number): void`. Persist `version: 1` + a `migrate` (extended in Task 2).

- [ ] **Step 1: Store — swap `grownIn` for `growth`**

In `src/store/useStudioStore.ts`:

In the `StudioState` interface, replace `grownIn: boolean;` with:
```ts
  growth: number; // 0 = just planted, 1 = fully grown-in
```
and replace `setGrownIn: (on: boolean) => void;` with:
```ts
  setGrowth: (v: number) => void;
```

In the initial state object, replace `grownIn: false,` with:
```ts
      growth: 0.25,
```

Replace the action `setGrownIn: (on) => set({ grownIn: on }),` with:
```ts
      setGrowth: (v) => set({ growth: Math.max(0, Math.min(1, v)) }),
```

In `partialize`, replace `grownIn: s.grownIn,` with:
```ts
        growth: s.growth,
```

- [ ] **Step 2: Store — add persist version + migrate**

In `src/store/useStudioStore.ts`, in the persist options object (the one with `name: "aquascape-studio:layout"`), add these two fields next to `name`:
```ts
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        if (version < 1) {
          if (typeof s.growth !== "number") {
            s.growth = s.grownIn === true ? 1 : 0.25;
          }
          delete s.grownIn;
        }
        return s as StudioState;
      },
```

- [ ] **Step 3: Plants — growth-driven height + fullness**

In `src/components/scene/Plants.tsx`:

Replace `const grownIn = useStudioStore((s) => s.grownIn);` with:
```ts
  const growth = useStudioStore((s) => s.growth);
```

Inside `Patch`, the `count` line stays as-is (it is the max allocation). The blade-building `useMemo` changes. Replace the whole `const blades = useMemo<RenderBlade[]>(() => { ... }, [ ... ]);` block with:
```ts
  const blades = useMemo<RenderBlade[]>(() => {
    const [minH, maxH] = species?.heightCm ?? [4, 8];
    const youngH = minH * 0.55;
    const targetH = (youngH + (maxH - youngH) * growth) * userScale;
    // Fullness: reveal more of the pre-sampled blades as the scape grows in.
    const visible = Math.max(5, Math.round(count * (0.5 + 0.5 * growth)));
    const capAt = (surfaceWorldY: number) =>
      Math.max(2, tankHeight * 0.96 - surfaceWorldY);

    // Preferred path: blades pre-sampled onto the real surface at paint time.
    if (placement.blades && placement.blades.length) {
      const n = Math.min(visible, placement.blades.length);
      return placement.blades.slice(0, n).map((b) => ({
        x: b.x,
        z: b.z,
        baseY: b.y - baseWorldY,
        h: Math.min(targetH * b.hMul, capAt(b.y)),
        yaw: b.yaw,
        lean: b.lean,
        tint: 0.82 + Math.abs(Math.sin(b.x * 12.9 + b.z * 4.7)) * 0.3,
      }));
    }

    // Fallback for legacy patches: flat scatter at the patch plane.
    const rand = mulberry32(hashSeed(placement.id));
    const cap = capAt(baseWorldY);
    return Array.from({ length: visible }, () => {
      const ang = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * placement.radius;
      return {
        x: Math.cos(ang) * r,
        z: Math.sin(ang) * r,
        baseY: 0,
        h: Math.min(targetH * (0.7 + rand() * 0.6), cap),
        yaw: rand() * Math.PI * 2,
        lean: (rand() - 0.5) * 0.25,
        tint: 0.82 + rand() * 0.32,
      };
    });
  }, [
    placement.blades,
    placement.id,
    placement.radius,
    baseWorldY,
    count,
    species?.heightCm,
    growth,
    userScale,
    tankHeight,
  ]);
```

(The `instancedMesh` keeps `args={[CROSS_GEO, undefined, count]}` and `key={count}` — allocation is the max count; `useLayoutEffect` already sets `mesh.count = blades.length`, so only `visible` blades render. No realloc on growth changes.)

- [ ] **Step 4: Toolbar — replace toggle with a Growth slider**

In `src/components/ui/Toolbar.tsx`:

Replace:
```ts
  const grownIn = useStudioStore((s) => s.grownIn);
  const setGrownIn = useStudioStore((s) => s.setGrownIn);
```
with:
```ts
  const growth = useStudioStore((s) => s.growth);
  const setGrowth = useStudioStore((s) => s.setGrowth);
```

Replace the grown-in button block:
```tsx
        <Btn
          active={grownIn}
          onClick={() => setGrownIn(!grownIn)}
          title="Preview plants grown-in"
        >
          {grownIn ? "Grown-in" : "Just planted"}
        </Btn>
```
with:
```tsx
        <label
          className="flex items-center gap-1.5 text-[11px] font-light text-stone"
          title="How grown-in the plants look"
        >
          Growth
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={growth}
            onChange={(e) => setGrowth(Number(e.target.value))}
            className="h-1 w-20 cursor-pointer accent-moss"
          />
        </label>
```

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (no remaining references to `grownIn` / `setGrownIn`).

- [ ] **Step 6: Visual check**

Run `pnpm dev`, paint a plant patch, drag the **Growth** slider in the toolbar. Expected: at low growth the patch is short and sparse; sliding up makes plants taller and denser (more blades) smoothly. Reload the page — a scene saved before this change still loads (migration), plants present.

- [ ] **Step 7: Commit**

```bash
git add src/store/useStudioStore.ts src/components/scene/Plants.tsx src/components/ui/Toolbar.tsx
git commit -m "feat: global plant growth slider (height + fullness)"
```

---

## Task 2: Light rig data layer (types + lightColor + store)

Add the fixture data model, the Kelvin→RGB helper, and store state/actions. Nothing renders yet, but the build stays green and the default rig exists in state.

**Files:**
- Create: `src/lib/lightColor.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/store/useStudioStore.ts`

**Interfaces:**
- Produces: `FixtureType = "spot" | "flood" | "rgb"`; `LightFixture` (see below); `kelvinToRgb(k: number): THREE.Color`; store `lights: LightFixture[]` + `addLight(type)`, `updateLight(id, patch)`, `removeLight(id)`.
- Consumes: nothing new.

- [ ] **Step 1: Types — fixture model**

In `src/lib/types.ts`, add (e.g. after the `BackgroundConfig` block):
```ts
export type FixtureType = "spot" | "flood" | "rgb";

/** One controllable light hung above the tank. */
export interface LightFixture {
  id: string;
  type: FixtureType;
  /** Position above the tank: cm offset from tank center along width (x) / depth (z). */
  x: number;
  z: number;
  /** Fixture height above the tank rim, in cm. */
  height: number;
  /** Brightness multiplier (~0..3). */
  intensity: number;
  /** Color temperature, warm 3000K .. cool 8000K — drives spot/flood color. */
  kelvin: number;
  /** Hex color — used by the `rgb` accent type only. */
  color: string;
  /** Toggle off without deleting. */
  on: boolean;
}
```

- [ ] **Step 2: lightColor helper**

Create `src/lib/lightColor.ts`:
```ts
import * as THREE from "three";

// Black-body color temperature → RGB (Tanner Helland approximation), as a
// THREE.Color. Warm (~3000K) is orange-white, ~6500K neutral, cool (8000K+)
// blue-white. Pure function — no deps beyond three.
export function kelvinToRgb(kelvin: number): THREE.Color {
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100;
  let r: number;
  let g: number;
  let b: number;

  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }
  if (t >= 66) {
    b = 255;
  } else if (t <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  }

  const norm = (x: number) => Math.max(0, Math.min(255, x)) / 255;
  return new THREE.Color(norm(r), norm(g), norm(b));
}
```

- [ ] **Step 3: Store — lights state, default rig, actions**

In `src/store/useStudioStore.ts`:

Add to the type imports from `@/lib/types`: `FixtureType`, `LightFixture`.

After the `DEFAULT_SUBSTRATE` constant, add the default rig:
```ts
const DEFAULT_LIGHTS: LightFixture[] = [
  {
    id: "default-flood",
    type: "flood",
    x: 0,
    z: 0,
    height: Math.round(DEFAULT_TANK.height * 0.5),
    intensity: 1,
    kelvin: 6500,
    color: "#7fd4ff",
    on: true,
  },
];
```

In the `StudioState` interface, add (near `fish`):
```ts
  lights: LightFixture[];
```
and in the actions section:
```ts
  addLight: (type: FixtureType) => void;
  updateLight: (id: string, patch: Partial<LightFixture>) => void;
  removeLight: (id: string) => void;
```

In the initial state, add (near `fish: {...}`):
```ts
      lights: DEFAULT_LIGHTS,
```

Add the actions (near `setFish`):
```ts
      addLight: (type) =>
        set((s) => {
          const base = {
            id: genId(),
            type,
            x: 0,
            z: 0,
            height: Math.round(s.tank.height * 0.5),
            intensity: 1,
            on: true,
          };
          const fixture: LightFixture =
            type === "rgb"
              ? { ...base, kelvin: 6500, color: "#48e0c0" }
              : { ...base, kelvin: type === "spot" ? 5200 : 6500, color: "#ffffff" };
          return { lights: [...s.lights, fixture] };
        }),
      updateLight: (id, patch) =>
        set((s) => ({
          lights: s.lights.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),
      removeLight: (id) =>
        set((s) => ({ lights: s.lights.filter((l) => l.id !== id) })),
```

In `partialize`, add:
```ts
        lights: s.lights,
```

In the `migrate` from Task 1, add a `lights` default so old persisted blobs get the rig. Replace the migrate body with:
```ts
      migrate: (persisted: unknown, version: number) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        if (version < 1) {
          if (typeof s.growth !== "number") {
            s.growth = s.grownIn === true ? 1 : 0.25;
          }
          delete s.grownIn;
          if (!Array.isArray(s.lights)) {
            s.lights = DEFAULT_LIGHTS;
          }
        }
        return s as StudioState;
      },
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lightColor.ts src/lib/types.ts src/store/useStudioStore.ts
git commit -m "feat: light fixture data model + store (kelvinToRgb, default rig)"
```

---

## Task 3: Fixture-driven Lighting rewrite

Rewrite `Lighting.tsx` so each `on` fixture becomes a downward three.js light, with a low baked ambient/hemisphere fill so the scene is never pitch-black. Removes the hardcoded directional + underwater spot.

**Files:**
- Modify: `src/components/scene/Lighting.tsx`

**Interfaces:**
- Consumes: store `lights`, `kelvinToRgb` (Task 2); props `mode`, `dims` (unchanged call site in `TankScene`).

- [ ] **Step 1: Rewrite Lighting.tsx**

Replace the entire contents of `src/components/scene/Lighting.tsx` with:
```tsx
"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useStudioStore } from "@/store/useStudioStore";
import { kelvinToRgb } from "@/lib/lightColor";
import type { LightFixture, TankDimensions, ViewMode } from "@/lib/types";

// Per-type spotlight shape + base intensity. Each fixture is hung above the tank
// and aimed straight down at the substrate below it.
const TYPE_PARAMS: Record<
  FixtureKind,
  { angle: number; penumbra: number; base: number }
> = {
  flood: { angle: 0.9, penumbra: 0.7, base: 1.6 }, // broad even wash
  spot: { angle: 0.35, penumbra: 0.2, base: 2.2 }, // hard pool of light
  rgb: { angle: 0.6, penumbra: 0.6, base: 1.4 }, // colored accent
};
type FixtureKind = LightFixture["type"];

function FixtureLight({
  light,
  rimY,
  uw,
}: {
  light: LightFixture;
  rimY: number;
  uw: number;
}) {
  const color = useMemo(
    () =>
      light.type === "rgb" ? new THREE.Color(light.color) : kelvinToRgb(light.kelvin),
    [light.type, light.color, light.kelvin],
  );
  const target = useMemo(() => new THREE.Object3D(), []);
  target.position.set(light.x, 0, light.z);

  const p = TYPE_PARAMS[light.type];
  return (
    <>
      <primitive object={target} />
      <spotLight
        position={[light.x, rimY + light.height, light.z]}
        target={target}
        angle={p.angle}
        penumbra={p.penumbra}
        decay={0}
        intensity={p.base * light.intensity * uw}
        color={color}
      />
    </>
  );
}

// User-built light rig + a small baked fill (ambient + hemisphere) so the scape
// is never fully dark even with every fixture off.
export function Lighting({ mode, dims }: { mode: ViewMode; dims: TankDimensions }) {
  const lights = useStudioStore((s) => s.lights);
  const underwater = mode === "underwater";
  const uw = underwater ? 0.7 : 1;
  return (
    <>
      <ambientLight intensity={underwater ? 0.25 : 0.3} />
      <hemisphereLight
        intensity={underwater ? 0.3 : 0.38}
        color={underwater ? "#cfeffb" : "#ffffff"}
        groundColor={underwater ? "#15303a" : "#cdbfae"}
      />
      {lights
        .filter((l) => l.on)
        .map((l) => (
          <FixtureLight key={l.id} light={l} rimY={dims.height} uw={uw} />
        ))}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Visual check**

`pnpm dev`. Expected: the scene is lit from a single overhead flood (default rig) in both Design and Underwater modes; with no fixtures the scene dims to a soft fill but is never black. Rocks/plants are clearly visible.

- [ ] **Step 4: Commit**

```bash
git add src/components/scene/Lighting.tsx
git commit -m "feat: fixture-driven scene lighting with baked fill"
```

---

## Task 4: Visible light fixtures (hardware) + mount

Draw a simple fixture body above the tank at each light's position, with an emissive underside tinted to its color when on.

**Files:**
- Create: `src/components/scene/LightFixtures.tsx`
- Modify: `src/components/scene/TankScene.tsx`

**Interfaces:**
- Consumes: store `lights`, `tank.height`, `kelvinToRgb`.
- Produces: `<LightFixtures />`.

- [ ] **Step 1: Create LightFixtures.tsx**

Create `src/components/scene/LightFixtures.tsx`:
```tsx
"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useStudioStore } from "@/store/useStudioStore";
import { kelvinToRgb } from "@/lib/lightColor";
import type { LightFixture } from "@/lib/types";

function Fixture({ light, rimY }: { light: LightFixture; rimY: number }) {
  const color = useMemo(
    () =>
      light.type === "rgb" ? new THREE.Color(light.color) : kelvinToRgb(light.kelvin),
    [light.type, light.color, light.kelvin],
  );
  const y = rimY + light.height;
  const glow = light.on ? Math.min(1, light.intensity / 2) : 0;
  const panel: [number, number] = light.type === "flood" ? [20, 6] : [6, 6];
  return (
    <group position={[light.x, y, light.z]}>
      <mesh rotation={light.type === "spot" ? [Math.PI, 0, 0] : [0, 0, 0]}>
        {light.type === "spot" ? (
          <coneGeometry args={[3, 5, 16]} />
        ) : light.type === "rgb" ? (
          <boxGeometry args={[8, 3, 8]} />
        ) : (
          <boxGeometry args={[22, 3, 8]} />
        )}
        <meshStandardMaterial color="#1c1a18" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, -1.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={panel} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2 + 0.7 * glow}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export function LightFixtures() {
  const lights = useStudioStore((s) => s.lights);
  const rimY = useStudioStore((s) => s.tank.height);
  return (
    <group>
      {lights.map((l) => (
        <Fixture key={l.id} light={l} rimY={rimY} />
      ))}
    </group>
  );
}
```

- [ ] **Step 2: Mount in TankScene**

In `src/components/scene/TankScene.tsx`, add the import:
```ts
import { LightFixtures } from "./LightFixtures";
```
and render it right after `<Lighting mode={mode} dims={tank} />`:
```tsx
      <Lighting mode={mode} dims={tank} />
      <LightFixtures />
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Visual check**

`pnpm dev`. Expected: a dark flood-bar fixture is visible floating above the tank with a faint colored glow underneath. Orbit to confirm it sits above the rim, centered.

- [ ] **Step 5: Commit**

```bash
git add src/components/scene/LightFixtures.tsx src/components/scene/TankScene.tsx
git commit -m "feat: visible light fixture hardware above the tank"
```

---

## Task 5: Light panel UI

Add a left-column panel to add/remove fixtures and tune each one (intensity, warmth/color, X/Z position, on/off).

**Files:**
- Create: `src/components/ui/LightPanel.tsx`
- Modify: `src/components/Studio.tsx`

**Interfaces:**
- Consumes: store `lights`, `addLight`, `updateLight`, `removeLight`, `tank`.
- Produces: `<LightPanel />`.

- [ ] **Step 1: Create LightPanel.tsx**

Create `src/components/ui/LightPanel.tsx`:
```tsx
"use client";

import { useStudioStore } from "@/store/useStudioStore";
import { Panel, Btn } from "./primitives";
import type { FixtureType, LightFixture } from "@/lib/types";

const ADD: { type: FixtureType; label: string }[] = [
  { type: "flood", label: "Flood" },
  { type: "spot", label: "Spot" },
  { type: "rgb", label: "RGB" },
];

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  suffix,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  return (
    <label className="mt-1 flex items-center gap-2 text-[10px] text-stone">
      <span className="w-10 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-moss"
      />
      <span className="w-12 text-right tabular-nums text-mist/80">{suffix}</span>
    </label>
  );
}

function Row({ light }: { light: LightFixture }) {
  const update = useStudioStore((s) => s.updateLight);
  const remove = useStudioStore((s) => s.removeLight);
  const tank = useStudioStore((s) => s.tank);
  const xMax = Math.round(tank.width * 0.6);
  const zMax = Math.round(tank.depth * 0.6);
  return (
    <div className="rounded-md bg-mist/[0.05] p-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex-1 text-xs font-medium capitalize">{light.type}</span>
        <button
          onClick={() => update(light.id, { on: !light.on })}
          className={`rounded px-1.5 py-0.5 text-[10px] ${
            light.on ? "bg-moss text-sumi" : "bg-mist/10 text-stone"
          }`}
        >
          {light.on ? "On" : "Off"}
        </button>
        <button
          onClick={() => remove(light.id)}
          title="Remove fixture"
          className="rounded px-1.5 py-0.5 text-[10px] text-[#cc9988] hover:bg-mist/10"
        >
          ✕
        </button>
      </div>

      <Slider
        label="Power"
        min={0}
        max={3}
        step={0.05}
        value={light.intensity}
        onChange={(v) => update(light.id, { intensity: v })}
        suffix={light.intensity.toFixed(1)}
      />

      {light.type === "rgb" ? (
        <label className="mt-1 flex items-center gap-2 text-[10px] text-stone">
          <span className="w-10 shrink-0">Color</span>
          <input
            type="color"
            value={light.color}
            onChange={(e) => update(light.id, { color: e.target.value })}
            className="h-5 w-full cursor-pointer rounded bg-transparent"
          />
        </label>
      ) : (
        <Slider
          label="Warmth"
          min={3000}
          max={8000}
          step={100}
          value={light.kelvin}
          onChange={(v) => update(light.id, { kelvin: v })}
          suffix={`${Math.round(light.kelvin)}K`}
        />
      )}

      <Slider
        label="X"
        min={-xMax}
        max={xMax}
        step={1}
        value={light.x}
        onChange={(v) => update(light.id, { x: v })}
        suffix={`${light.x}`}
      />
      <Slider
        label="Z"
        min={-zMax}
        max={zMax}
        step={1}
        value={light.z}
        onChange={(v) => update(light.id, { z: v })}
        suffix={`${light.z}`}
      />
    </div>
  );
}

export function LightPanel() {
  const lights = useStudioStore((s) => s.lights);
  const addLight = useStudioStore((s) => s.addLight);
  return (
    <Panel title="Light">
      <div className="mb-2 flex gap-1.5">
        {ADD.map((a) => (
          <Btn key={a.type} onClick={() => addLight(a.type)}>
            + {a.label}
          </Btn>
        ))}
      </div>
      <div className="space-y-2">
        {lights.map((l) => (
          <Row key={l.id} light={l} />
        ))}
        {lights.length === 0 && (
          <p className="text-[10px] leading-snug text-stone/70">
            No fixtures — add one above. A soft ambient fill keeps the scape visible.
          </p>
        )}
      </div>
    </Panel>
  );
}
```

- [ ] **Step 2: Mount in Studio left column**

In `src/components/Studio.tsx`, add the import:
```ts
import { LightPanel } from "./ui/LightPanel";
```
In the left column `<div className="calm-scroll ...">`, add `<LightPanel />` after `<BackgroundPanel />`:
```tsx
            <TankPanel />
            <HardscapePalette />
            <DrawPanel />
            <BackgroundPanel />
            <LightPanel />
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Visual check**

`pnpm dev`. In Design mode the **Light** panel shows the default flood. Verify: Power changes brightness; Warmth shifts the light warm↔cool; X/Z move the fixture (hardware + lit pool follow); On/Off toggles it (scene falls back to fill); **+ Spot** / **+ RGB** add fixtures (RGB shows a color picker and casts colored light); ✕ removes a fixture.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/LightPanel.tsx src/components/Studio.tsx
git commit -m "feat: light panel — add/remove and tune overhead fixtures"
```

---

## Task 6: Rock generator — shape/surface params + vertex colors

Extend the procedural generator with per-stone `jaggedness`, `veinColor`, and `strata`, and bake per-vertex color (mottling + veins/bands) so each stone reads as textured. Enable `vertexColors` on the hardscape material. Existing 3 stones immediately gain surface variation.

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/proceduralRock.ts`
- Modify: `src/components/scene/Hardscape.tsx`

**Interfaces:**
- Produces: `makeRockGeometry(seed, { jaggedness?, detail?, shape?, veinColor?, strata? })` that also sets a `color` vertex attribute; `HardscapeMaterial` optional `jaggedness?/veinColor?/strata?`.
- Consumes: nothing new.

- [ ] **Step 1: Types — extend HardscapeMaterial**

In `src/lib/types.ts`, inside `HardscapeMaterial`, after the `shape: Vec3;` field add:
```ts
  /** Per-stone surface roughness of the silhouette (higher = more jagged). */
  jaggedness?: number;
  /** Secondary color streaked into the surface as vertex colors (e.g. calcite veins). */
  veinColor?: string;
  /** Horizontal stratification — layered sedimentary look (Pagoda / petrified wood). */
  strata?: boolean;
```

- [ ] **Step 2: Generator — params + vertex colors**

In `src/lib/proceduralRock.ts`:

Replace the `RockOptions` interface with:
```ts
export interface RockOptions {
  /** Higher = lumpier / more jagged (Seiryu-like vs smooth river stone). */
  jaggedness?: number;
  /** Base detail of the icosahedron (0-3). */
  detail?: number;
  /** Non-uniform shape bias [x, y, z]; e.g. flat slab vs tall spire. */
  shape?: [number, number, number];
  /** Secondary color streaked into the surface as vertex colors (veins). */
  veinColor?: string;
  /** Horizontal stratification (layered slabs). */
  strata?: boolean;
}
```

Replace the `makeRockGeometry` function with:
```ts
export function makeRockGeometry(
  seed: number,
  {
    jaggedness = 0.35,
    detail = 2,
    shape = [1, 0.8, 1],
    veinColor,
    strata = false,
  }: RockOptions = {},
): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  const offsets = Array.from({ length: 6 }, () => rand() * Math.PI * 2);

  const geo = new THREE.IcosahedronGeometry(0.5, detail);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let n = lumpNoise(v, offsets);
    if (strata) {
      // accentuate horizontal bands → layered slabs
      n += Math.sin(v.y * 14 + offsets[0]) * 0.12;
    }
    const displace = 1 + n * jaggedness + (rand() - 0.5) * jaggedness * 0.4;
    v.multiplyScalar(displace);
    v.x *= shape[0];
    v.y *= shape[1];
    v.z *= shape[2];
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  geo.computeBoundingBox();
  // Seat the rock so its lowest point rests at y = 0.
  const minY = geo.boundingBox!.min.y;
  geo.translate(0, -minY, 0);

  // Bake per-vertex color: subtle mottling so the flat fill reads as stone,
  // blended toward veinColor along horizontal bands. Multiplies the material
  // base color at render time (material must enable vertexColors).
  geo.computeBoundingBox();
  const bbox = geo.boundingBox!;
  const height = Math.max(1e-3, bbox.max.y - bbox.min.y);
  const colors = new Float32Array(pos.count * 3);
  const vein = veinColor ? new THREE.Color(veinColor) : null;
  const c = new THREE.Color();
  const cr = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const mottle = Math.min(1.15, 0.82 + cr() * 0.3);
    c.setScalar(mottle);
    if (vein) {
      const band = Math.abs(Math.sin((v.y / height) * Math.PI * 6 + offsets[1]));
      const streak = band > 0.86 ? (band - 0.86) / 0.14 : 0;
      const amt = Math.min(1, streak * (strata ? 1 : 0.7));
      c.lerp(vein, amt * 0.9);
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return geo;
}
```

- [ ] **Step 3: Hardscape — pass params + enable vertexColors**

In `src/components/scene/Hardscape.tsx`:

Replace the geometry `useMemo`:
```ts
  const geometry = useMemo(() => {
    const isWood = item.kind === "wood";
    return makeRockGeometry(item.seed, {
      jaggedness: isWood ? 0.22 : 0.45,
      detail: isWood ? 1 : 2,
      shape: material?.shape ?? [1, 1, 1],
    });
  }, [item.seed, item.kind, material?.shape]);
```
with:
```ts
  const geometry = useMemo(() => {
    const isWood = item.kind === "wood";
    return makeRockGeometry(item.seed, {
      jaggedness: material?.jaggedness ?? (isWood ? 0.22 : 0.45),
      detail: isWood ? 1 : 2,
      shape: material?.shape ?? [1, 1, 1],
      veinColor: material?.veinColor,
      strata: material?.strata,
    });
  }, [
    item.seed,
    item.kind,
    material?.shape,
    material?.jaggedness,
    material?.veinColor,
    material?.strata,
  ]);
```

In the procedural `<meshStandardMaterial>` (the one with `flatShading`), add the `vertexColors` prop:
```tsx
            <meshStandardMaterial
              color={material?.color ?? "#7a7a7a"}
              roughness={material?.roughness ?? 0.9}
              metalness={material?.metalness ?? 0}
              vertexColors
              flatShading
            />
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Visual check**

`pnpm dev`, add a Seiryu and a Lava rock. Expected: surfaces now show subtle color mottling (no longer a single flat tone); Seiryu shows faint lighter banding (veins). Shapes still seat on the substrate.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/proceduralRock.ts src/components/scene/Hardscape.tsx
git commit -m "feat: rock generator surface params (jaggedness/veins/strata + vertex colors)"
```

---

## Task 7: Expanded rock library

Add the researched stones (Frodo, Elephant Skin, Pagoda, Petrified Wood) and tune the existing three with the new params. Purely data — the palette/picker/renderer already read this list.

**Files:**
- Modify: `src/data/hardscapeMaterials.ts`

**Interfaces:**
- Consumes: `HardscapeMaterial` with `jaggedness?/veinColor?/strata?` (Task 6).

- [ ] **Step 1: Replace the materials array**

In `src/data/hardscapeMaterials.ts`, replace the `HARDSCAPE_MATERIALS` array with:
```ts
export const HARDSCAPE_MATERIALS: HardscapeMaterial[] = [
  {
    id: "seiryu",
    kind: "rock",
    label: "Seiryu Stone",
    blurb: "Jagged blue-grey limestone with white calcite veins. Raises pH.",
    color: "#6f7479",
    roughness: 0.85,
    metalness: 0.04,
    shape: [1.1, 1.0, 0.9],
    jaggedness: 0.5,
    veinColor: "#d9dde0",
  },
  {
    id: "dragon",
    kind: "rock",
    label: "Dragon Stone (Ohko)",
    blurb: "Porous reddish-brown clay rock, pitted like dragon scales. Inert.",
    color: "#8a6f4e",
    roughness: 0.95,
    metalness: 0.0,
    shape: [1.0, 1.05, 1.0],
    jaggedness: 0.55,
  },
  {
    id: "lava",
    kind: "rock",
    label: "Lava Rock",
    blurb: "Dark, lightweight, highly porous. Great biological filtration.",
    color: "#3a3537",
    roughness: 1.0,
    metalness: 0.0,
    shape: [1.0, 0.9, 1.0],
    jaggedness: 0.6,
  },
  {
    id: "frodo",
    kind: "rock",
    label: "Frodo Stone",
    blurb: "Grey-brown stone with deep furrows. Dense, compact, hardy.",
    color: "#7c7468",
    roughness: 0.9,
    metalness: 0.02,
    shape: [1.15, 0.95, 0.9],
    jaggedness: 0.5,
    veinColor: "#b9b2a6",
  },
  {
    id: "elephant",
    kind: "rock",
    label: "Elephant Skin Stone",
    blurb: "Light grey, rounded and rugged — weathered mountain-range grain.",
    color: "#9a9690",
    roughness: 0.9,
    metalness: 0.0,
    shape: [1.1, 0.85, 1.0],
    jaggedness: 0.3,
  },
  {
    id: "pagoda",
    kind: "rock",
    label: "Pagoda Stone",
    blurb: "Anthracite-to-brown sedimentary stone in weathered layers.",
    color: "#5a4f45",
    roughness: 0.92,
    metalness: 0.0,
    shape: [1.25, 0.7, 1.0],
    jaggedness: 0.32,
    strata: true,
    veinColor: "#8a7b67",
  },
  {
    id: "petrified",
    kind: "rock",
    label: "Petrified Wood",
    blurb: "Fossilised wood — dense, banded warm-brown grain. Inert.",
    color: "#6e5642",
    roughness: 0.8,
    metalness: 0.02,
    shape: [0.8, 1.0, 1.4],
    jaggedness: 0.28,
    strata: true,
    veinColor: "#9a7b5a",
  },
  {
    id: "spiderwood",
    kind: "wood",
    label: "Spider Wood",
    blurb: "Branchy root-like wood. Lightens then darkens with age.",
    color: "#7a5a3a",
    roughness: 0.9,
    metalness: 0.0,
    shape: [0.45, 1.6, 0.45],
  },
  {
    id: "manzanita",
    kind: "wood",
    label: "Manzanita",
    blurb: "Dense, intricate branching. Prized for tree-style scapes.",
    color: "#6b4f34",
    roughness: 0.85,
    metalness: 0.0,
    shape: [0.4, 1.8, 0.4],
  },
];
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Visual check**

`pnpm dev`. The Hardscape palette now lists 7 rocks. Add Pagoda (visible horizontal layering), Elephant Skin (rounded, pale), Petrified Wood (elongated, banded), Frodo (angular, furrowed). Each reads distinctly.

- [ ] **Step 4: Commit**

```bash
git add src/data/hardscapeMaterials.ts
git commit -m "feat: expand rock library (frodo, elephant skin, pagoda, petrified wood)"
```

---

## Task 8: Placement state plumbing

Add the store state/actions for ghost placement and extend `addHardscape` to accept a drop position + seed. The palette still works unchanged (it calls `addHardscape(id)` → defaults to center) so the build stays green; the ghost UX lands in Task 9.

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/store/useStudioStore.ts`

**Interfaces:**
- Produces: `tool` now includes `"place"`; store `placingMaterialId: string | null`, `placingSeed: number`, `beginPlacing(materialId)`, `cancelPlacing()`; `addHardscape(materialId: string, position?: Vec3, seed?: number)`.

- [ ] **Step 1: Types — tool union**

In `src/lib/types.ts`, the `tool` type lives only in the store today, but confirm there is no separate `tool` type export to change. (The store defines `tool: "select" | "plant" | "ground"` inline.) No change needed in `types.ts` for `tool`. Skip if absent.

- [ ] **Step 2: Store — placement state + actions**

In `src/store/useStudioStore.ts`:

In `StudioState`, change the `tool` field type:
```ts
  tool: "select" | "plant" | "ground" | "place";
```
and add after it:
```ts
  placingMaterialId: string | null; // rock armed for ghost placement (transient)
  placingSeed: number; // shape seed shared by ghost + committed rock (transient)
```

Change the `addHardscape` action signature in the interface:
```ts
  addHardscape: (materialId: string, position?: Vec3, seed?: number) => void;
```
and add to the actions list:
```ts
  beginPlacing: (materialId: string) => void;
  cancelPlacing: () => void;
```
Also update the `setTool` signature to include `"place"`:
```ts
  setTool: (tool: "select" | "plant" | "ground" | "place") => void;
```

In the initial state, after `tool: "select",` add:
```ts
      placingMaterialId: null,
      placingSeed: 0,
```

Replace the `addHardscape` action with the position/seed-aware version (also exits placement on commit):
```ts
      addHardscape: (materialId, position = [0, 0, 0], seed) => {
        const mat = getMaterial(materialId);
        if (!mat) return;
        const item: HardscapeItem = {
          id: genId(),
          materialId,
          kind: mat.kind,
          position,
          rotation: [0, 0, 0],
          scale: mat.kind === "wood" ? 14 : 10,
          seed: seed ?? Math.floor(Math.random() * 1e9),
        };
        set((s) => ({
          hardscape: [...s.hardscape, item],
          selectedId: item.id,
          placingMaterialId: null,
          tool: s.tool === "place" ? "select" : s.tool,
        }));
      },
```

Add the placement actions (near `setActivePlant`):
```ts
      beginPlacing: (materialId) =>
        set({
          placingMaterialId: materialId,
          placingSeed: Math.floor(Math.random() * 1e9),
          tool: "place",
          activePlantId: null,
          activeGround: null,
          selectedId: null,
        }),
      cancelPlacing: () =>
        set((s) => ({
          placingMaterialId: null,
          tool: s.tool === "place" ? "select" : s.tool,
        })),
```

Update `setTool` to also clear placement when returning to select:
```ts
      setTool: (tool) =>
        set({
          tool,
          ...(tool === "select"
            ? { activePlantId: null, activeGround: null, placingMaterialId: null }
            : {}),
        }),
```

Update `setActivePlant` and `setActiveGround` to also clear `placingMaterialId` (add `placingMaterialId: null,` to each `set` object) so arming a brush cancels a pending placement:
```ts
      setActivePlant: (speciesId) =>
        set((s) => ({
          activePlantId: speciesId,
          activeGround: null,
          placingMaterialId: null,
          tool: speciesId ? "plant" : "select",
          selectedId: speciesId ? null : s.selectedId,
        })),
      setActiveGround: (type) =>
        set((s) => ({
          activeGround: type,
          activePlantId: null,
          placingMaterialId: null,
          tool: type ? "ground" : "select",
          selectedId: type ? null : s.selectedId,
        })),
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. (`HardscapePalette` still calls `addHardscape(m.id)` — valid with optional params.)

- [ ] **Step 4: Visual check**

`pnpm dev`. Existing "+ Add" in the Hardscape palette still drops a rock at center and selects it (unchanged behavior). No regressions.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/store/useStudioStore.ts
git commit -m "feat: placement state + addHardscape(position, seed)"
```

---

## Task 9: Ghost-preview click-to-place

A translucent rock follows the cursor when a type is armed; clicking commits it at that point (inside the tank or outside on the ground); Esc / the palette Cancel aborts. Palette "+ Add" becomes "Place".

**Files:**
- Create: `src/components/scene/PlacementGhost.tsx`
- Modify: `src/components/scene/TankScene.tsx`
- Modify: `src/components/ui/HardscapePalette.tsx`

**Interfaces:**
- Consumes: store `tool`, `placingMaterialId`, `placingSeed`, `addHardscape`, `cancelPlacing`, `beginPlacing`; `getMaterial`; `makeRockGeometry`.

- [ ] **Step 1: Create PlacementGhost.tsx**

Create `src/components/scene/PlacementGhost.tsx`:
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useStudioStore } from "@/store/useStudioStore";
import { getMaterial } from "@/data/hardscapeMaterials";
import { makeRockGeometry } from "@/lib/proceduralRock";
import type { Vec3 } from "@/lib/types";

const _down = new THREE.Vector3(0, -1, 0);
const _ray = new THREE.Raycaster();
const _origin = new THREE.Vector3();

function sceneRoot(o: THREE.Object3D): THREE.Object3D {
  let r = o;
  while (r.parent) r = r.parent;
  return r;
}

function paintableTargets(from: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  sceneRoot(from).traverse((o) => {
    const m = o as THREE.Mesh;
    let p: THREE.Object3D | null = o;
    let paint = false;
    while (p) {
      if (p.userData?.paintable) {
        paint = true;
        break;
      }
      p = p.parent;
    }
    if (m.isMesh && paint) out.push(m);
  });
  return out;
}

// A translucent rock that tracks the cursor while a rock type is armed, then
// commits on click. An invisible catcher plane covers the tank and beyond so the
// cursor is tracked even over empty space (place "outside" the tank).
export function PlacementGhost() {
  const tool = useStudioStore((s) => s.tool);
  const materialId = useStudioStore((s) => s.placingMaterialId);
  const seed = useStudioStore((s) => s.placingSeed);
  const addHardscape = useStudioStore((s) => s.addHardscape);
  const cancelPlacing = useStudioStore((s) => s.cancelPlacing);

  const material = materialId ? getMaterial(materialId) : undefined;
  const active = tool === "place" && !!material;
  const [hit, setHit] = useState<Vec3 | null>(null);

  const geometry = useMemo(() => {
    if (!material) return null;
    const isWood = material.kind === "wood";
    return makeRockGeometry(seed, {
      jaggedness: material.jaggedness ?? (isWood ? 0.22 : 0.45),
      detail: isWood ? 1 : 2,
      shape: material.shape,
      veinColor: material.veinColor,
      strata: material.strata,
    });
  }, [material, seed]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelPlacing();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, cancelPlacing]);

  if (!active || !geometry || !material) return null;

  const scale = material.kind === "wood" ? 14 : 10;

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const targets = paintableTargets(e.object);
    _origin.set(e.point.x, e.point.y + 60, e.point.z);
    _ray.set(_origin, _down);
    const surf = _ray.intersectObjects(targets, false)[0];
    const y = surf ? surf.point.y : 0;
    setHit([e.point.x, y, e.point.z]);
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const pos = (hit ?? [e.point.x, 0, e.point.z]) as Vec3;
    addHardscape(material.id, pos, seed);
  };

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onPointerMove={onMove}
        onClick={onClick}
      >
        <planeGeometry args={[4000, 4000]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {hit && (
        <group position={hit} scale={scale}>
          <mesh geometry={geometry}>
            <meshStandardMaterial
              color={material.color}
              vertexColors
              transparent
              opacity={0.45}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}
    </>
  );
}
```

- [ ] **Step 2: Mount in TankScene**

In `src/components/scene/TankScene.tsx`, add the import:
```ts
import { PlacementGhost } from "./PlacementGhost";
```
and render it right after `<Hardscape />`:
```tsx
      <Hardscape />
      <PlacementGhost />
```

- [ ] **Step 3: Palette — "Place" arms the ghost + hint**

In `src/components/ui/HardscapePalette.tsx`:

In the `Group` component, replace `const addHardscape = useStudioStore((s) => s.addHardscape);` with:
```ts
  const beginPlacing = useStudioStore((s) => s.beginPlacing);
  const placingId = useStudioStore((s) => s.placingMaterialId);
```
and replace the add button:
```tsx
            <Btn onClick={() => addHardscape(m.id)}>+ Add</Btn>
```
with:
```tsx
            <Btn active={placingId === m.id} onClick={() => beginPlacing(m.id)}>
              {placingId === m.id ? "Placing…" : "Place"}
            </Btn>
```

In the `HardscapePalette` component, add the placement hint. Add the imports/selectors at the top of the component:
```ts
  const tool = useStudioStore((s) => s.tool);
  const cancelPlacing = useStudioStore((s) => s.cancelPlacing);
```
(Add `import { useStudioStore } from "@/store/useStudioStore";` if not already imported — it is.)

Replace the closing helper paragraph block:
```tsx
      <p className="mt-2 text-[10px] leading-snug text-stone/70">
        Each piece is procedurally generated — every &ldquo;Add&rdquo; is unique.
        Select it in the tank to move, rotate, scale, stack, or regenerate.
      </p>
```
with:
```tsx
      {tool === "place" ? (
        <button
          onClick={() => cancelPlacing()}
          className="mt-2 w-full rounded-md bg-moss/20 px-2 py-1.5 text-[11px] text-moss ring-1 ring-moss/40 transition-colors hover:bg-moss/30"
        >
          ✦ Click in the scene to place · Esc / here to cancel
        </button>
      ) : (
        <p className="mt-2 text-[10px] leading-snug text-stone/70">
          Pick a stone, then click in the scene to place it — inside the tank or
          outside. Select it to move, rotate, scale, stack, or regenerate.
        </p>
      )}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Visual check**

`pnpm dev`. Click **Place** on Seiryu. Expected: a translucent Seiryu follows the cursor; moving over the substrate it sits on the slope, moving outside the tank it rests on the ground (y=0). Click drops a solid rock there, auto-selected (SelectionBar appears) for move/rotate/scale. Press **Place** again then **Esc** → ghost disappears, back to orbit. Confirm orbit is disabled while placing and returns after.

- [ ] **Step 6: Commit**

```bash
git add src/components/scene/PlacementGhost.tsx src/components/scene/TankScene.tsx src/components/ui/HardscapePalette.tsx
git commit -m "feat: ghost-preview click-to-place for rocks"
```

---

## Task 10: Docs + full build gate

Update `README.md` and `CLAUDE.md` for the three features and run the production build.

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update README.md**

In `README.md`, in the features/controls section, add bullets (match the file's existing tone/format):
- **Growth slider** (toolbar): one global control from just-planted → fully grown-in, scaling plant height *and* fullness.
- **Light rig** (Light panel): add/remove overhead fixtures — Flood / Spot / RGB — each with intensity, warmth (Kelvin) or color, X/Z position, and on/off. Visible hardware above the tank; a soft ambient fill keeps the scape lit when all are off.
- **Rock library + placement:** 7 researched stones (Seiryu, Dragon/Ohko, Lava, Frodo, Elephant Skin, Pagoda, Petrified Wood) with distinct procedural shape + surface (veins/strata/mottling). Pick a stone → a ghost follows the cursor → click to place it anywhere (inside or outside the tank) → move/rotate/scale.

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md`:
- In the **Architecture / data flow** UI-overlay line, add `LightPanel` to the left-column list.
- In the scene list, note `LightFixtures` (visible hardware) and `PlacementGhost` (cursor-following placement).
- In **Scope → In (current MVP)**, update: grown-in is now a **growth slider** (height + fullness); lighting is a **user-built overhead rig** (add/remove spot/flood/rgb fixtures, replacing the old hardcoded lights, with a baked fill); rocks are an **expanded researched library** placed via **ghost-preview click-to-place**.
- In the store summary, replace `grownIn` with `growth`, and add `lights[]` plus transient `placingMaterialId` / `placingSeed` to the not-persisted list.

- [ ] **Step 3: Typecheck + build**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

Run: `pnpm build`
Expected: build succeeds (tsc + prerender), no errors.

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: growth slider, light rig, rock library + placement"
```

---

## Self-Review

**Spec coverage**
- Growth slider (global, height + fullness, migration) → Task 1. ✓
- Light rig data model + default rig + kelvinToRgb → Task 2; rendering + baked fill → Task 3; visible hardware → Task 4; panel (add/remove/type/intensity/warmth/color/position/on-off) → Task 5. ✓
- Rock generator params + vertex colors → Task 6; expanded researched library → Task 7. ✓
- Ghost-preview click-to-place (state + addHardscape position/seed → Task 8; ghost + palette → Task 9). ✓
- Docs + build gate → Task 10. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows complete code; verification uses typecheck + concrete visual observations (no unit-test harness exists — stated in Global Constraints).

**Type consistency:** `growth`/`setGrowth`; `FixtureType`/`LightFixture` fields used identically across `lightColor`/`Lighting`/`LightFixtures`/`LightPanel`; `addLight`/`updateLight`/`removeLight`; `beginPlacing`/`cancelPlacing`/`placingMaterialId`/`placingSeed`; `addHardscape(materialId, position?, seed?)`; `makeRockGeometry` options `jaggedness/detail/shape/veinColor/strata`; `tool` union includes `"place"` everywhere it's set. Consistent.
