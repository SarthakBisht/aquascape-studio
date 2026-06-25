"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { BackgroundConfig, TankDimensions } from "@/lib/types";
import { useStudioStore } from "@/store/useStudioStore";

// The backdrop is a physical plane behind the back glass — not scene.background.
// This keeps the dark gallery ambiance outside the tank (overhead, sides) while
// the colored/gradient/backlit panel is visible only through the glass, which is
// physically correct and prevents a white "sky" when the user picks white.

function darken(hex: string, amount: number): string {
  const m = hex.replace("#", "");
  const f = Math.max(0, 1 - amount);
  const r = Math.round(parseInt(m.slice(0, 2), 16) * f);
  const g = Math.round(parseInt(m.slice(2, 4), 16) * f);
  const b = Math.round(parseInt(m.slice(4, 6), 16) * f);
  return `rgb(${r},${g},${b})`;
}

function makeTexture(bg: BackgroundConfig): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  if (bg.style === "backlit") {
    c.width = 512;
    c.height = 384;
    ctx.fillStyle = darken(bg.colorBottom, 0.3 + bg.glow * 0.5);
    ctx.fillRect(0, 0, c.width, c.height);
    const cx = (bg.glowX ?? 0.5) * c.width;
    const cy = (bg.glowY ?? 0.45) * c.height;
    const outerR = Math.max(c.width, c.height) * 0.85;
    const g = ctx.createRadialGradient(cx, cy, 16, cx, cy, outerR);
    g.addColorStop(0, bg.colorTop);
    g.addColorStop(0.5, bg.colorBottom);
    g.addColorStop(1, darken(bg.colorBottom, 0.3 + bg.glow * 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
  } else {
    c.width = 8;
    c.height = 256;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, bg.colorTop);
    g.addColorStop(1, bg.colorBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

export function Backdrop({
  background,
  dims,
}: {
  background: BackgroundConfig;
  dims: TankDimensions;
}) {
  const ambience = useStudioStore((s) => s.ambience);

  const texture = useMemo(
    () =>
      background.style === "solid" || background.style === "none"
        ? null
        : makeTexture(background),
    [background],
  );
  useEffect(() => () => texture?.dispose(), [texture]);

  const { width: w, depth: d, height: h } = dims;
  // Edge-to-edge on the back panel: match the back glass (w × h) with a hair of
  // bleed so no dark sliver shows at the seams. Sits just behind the back glass.
  const planeW = w + 1;
  const planeH = h + 1;
  const dimKey = `${w}-${d}-${h}`;

  return (
    <>
      {/* Scene/room ambience — sky and surroundings outside the tank. */}
      <color attach="background" args={[ambience]} />

      {/* Physical tank backdrop plane — only when a style is chosen. */}
      {background.style !== "none" && (
        <mesh key={dimKey} position={[0, h / 2, -(d / 2 + 0.3)]} renderOrder={-1}>
          <planeGeometry args={[planeW, planeH]} />
          {background.style === "solid" || !texture ? (
            <meshBasicMaterial color={background.colorTop} side={THREE.DoubleSide} />
          ) : (
            <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
          )}
        </mesh>
      )}
    </>
  );
}
