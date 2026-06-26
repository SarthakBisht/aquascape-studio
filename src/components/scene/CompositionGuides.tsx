"use client";

import { Line } from "@react-three/drei";
import type { TankDimensions, GuideConfig } from "@/lib/types";

// Front-view composition grids drawn ON the glass — the way aquascapers plan a
// hardscape: divide the pane by rule-of-thirds and/or the golden ratio and seat
// the focal stone on an intersection. Drawn on the front pane, back pane, or
// both (so the rear stones line up too).

const COLOR = "#c2a06a"; // driftwood — quiet, warm guide lines
const GOLD = "#d9b878"; // focal-point dots

// Fractions across an axis (0..1). Thirds = 1/3, 2/3; golden = 0.382, 0.618.
const RATIOS = {
  thirds: [1 / 3, 2 / 3],
  golden: [0.382, 0.618],
} as const;

function PaneGrid({
  w,
  h,
  z,
  fracs,
}: {
  w: number;
  h: number;
  z: number;
  fracs: number[];
}) {
  const hw = w / 2;
  // vertical lines (split width), full tank height
  const xs = fracs.map((f) => (f - 0.5) * w);
  // horizontal lines (split height), full tank width
  const ys = fracs.map((f) => f * h);
  return (
    <group>
      {xs.map((x, i) => (
        <Line
          key={`x${i}`}
          points={[
            [x, 0, z],
            [x, h, z],
          ]}
          color={COLOR}
          lineWidth={1}
          transparent
          opacity={0.45}
        />
      ))}
      {ys.map((y, i) => (
        <Line
          key={`y${i}`}
          points={[
            [-hw, y, z],
            [hw, y, z],
          ]}
          color={COLOR}
          lineWidth={1}
          transparent
          opacity={0.45}
        />
      ))}
      {xs.flatMap((x) =>
        ys.map((y) => (
          <mesh key={`d${x}_${y}`} position={[x, y, z]}>
            <sphereGeometry args={[Math.max(0.5, w * 0.01), 10, 10]} />
            <meshBasicMaterial color={GOLD} transparent opacity={0.85} />
          </mesh>
        )),
      )}
    </group>
  );
}

export function CompositionGuides({
  dims,
  config,
}: {
  dims: TankDimensions;
  config: GuideConfig;
}) {
  const { width: w, depth: d, height: h } = dims;

  // Sit the grid just inside the glass so it reads as drawn on the pane.
  const panes: number[] = [];
  if (config.face === "front" || config.face === "both") panes.push(d / 2 - 0.1);
  if (config.face === "back" || config.face === "both") panes.push(-d / 2 + 0.1);

  const fracs =
    config.ratio === "both"
      ? [...RATIOS.thirds, ...RATIOS.golden]
      : [...RATIOS[config.ratio]];

  return (
    <group>
      {panes.map((z) => (
        <PaneGrid key={z} w={w} h={h} z={z} fracs={fracs} />
      ))}
    </group>
  );
}
