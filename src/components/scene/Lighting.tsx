"use client";

import type { ViewMode } from "@/lib/types";

// Explicit lights (no network/HDRI dependency so the first run is reliable).
// TODO: swap in a bundled HDRI environment map for richer glass reflections at
// the "high" quality tier — see public/ASSETS.md.
export function Lighting({ mode }: { mode: ViewMode }) {
  const underwater = mode === "underwater";
  return (
    <>
      <ambientLight intensity={underwater ? 0.35 : 0.55} />
      <hemisphereLight
        intensity={underwater ? 0.5 : 0.8}
        color={underwater ? "#9fd8ff" : "#ffffff"}
        groundColor={underwater ? "#0a2a3a" : "#cdbfae"}
      />
      <directionalLight
        position={[40, 80, 30]}
        intensity={underwater ? 1.1 : 1.4}
        color={underwater ? "#bfe9ff" : "#fff6e8"}
      />
      <directionalLight
        position={[-50, 40, -20]}
        intensity={0.4}
        color="#cfe8ff"
      />
    </>
  );
}
