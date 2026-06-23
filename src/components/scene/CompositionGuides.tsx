"use client";

import { Line } from "@react-three/drei";
import type { TankDimensions } from "@/lib/types";

// Rule-of-thirds grid + golden-ratio focal markers floating just above the
// substrate. Helps users seat the main stone like the pros do.
export function CompositionGuides({ dims }: { dims: TankDimensions }) {
  const { width: w, depth: d } = dims;
  const y = 0.4;
  const hw = w / 2;
  const hd = d / 2;
  const color = "#38bdf8";

  // thirds
  const thirdsX = [-w / 6, w / 6];
  const thirdsZ = [-d / 6, d / 6];

  // golden-ratio intersections (0.382 / 0.618 of each axis, centered)
  const gx = [(0.382 - 0.5) * w, (0.618 - 0.5) * w];
  const gz = [(0.382 - 0.5) * d, (0.618 - 0.5) * d];
  const goldenPoints = gx.flatMap((x) => gz.map((z) => [x, y, z] as const));

  return (
    <group>
      {thirdsX.map((x, i) => (
        <Line
          key={`vx${i}`}
          points={[
            [x, y, -hd],
            [x, y, hd],
          ]}
          color={color}
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      ))}
      {thirdsZ.map((z, i) => (
        <Line
          key={`vz${i}`}
          points={[
            [-hw, y, z],
            [hw, y, z],
          ]}
          color={color}
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      ))}
      {goldenPoints.map((p, i) => (
        <mesh key={`g${i}`} position={[p[0], p[1], p[2]]}>
          <sphereGeometry args={[Math.max(0.6, w * 0.012), 12, 12]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      ))}
    </group>
  );
}
