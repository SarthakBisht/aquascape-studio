"use client";

import type { TankDimensions, ViewMode } from "@/lib/types";

// Explicit lights (no network/HDRI dependency so the first run is reliable).
// Underwater adds an overhead spot — the aquarium light is "hung" above the
// tank, so its glare comes straight down. The fixture itself is never drawn.
export function Lighting({
  mode,
  dims,
}: {
  mode: ViewMode;
  dims: TankDimensions;
}) {
  const underwater = mode === "underwater";
  return (
    <>
      <ambientLight intensity={underwater ? 0.42 : 0.55} />
      <hemisphereLight
        intensity={underwater ? 0.55 : 0.8}
        color={underwater ? "#cfeffb" : "#ffffff"}
        groundColor={underwater ? "#15303a" : "#cdbfae"}
      />
      <directionalLight
        position={[40, 80, 30]}
        intensity={underwater ? 0.8 : 1.4}
        color={underwater ? "#eaf6ff" : "#fff6e8"}
      />
      <directionalLight position={[-50, 40, -20]} intensity={0.4} color="#cfe8ff" />

      {underwater && (
        <spotLight
          position={[0, dims.height * 2.2, 0]}
          angle={0.7}
          penumbra={0.85}
          decay={0}
          intensity={2.6}
          color="#fff6e6"
        />
      )}
    </>
  );
}
