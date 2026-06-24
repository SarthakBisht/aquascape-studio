"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { BackgroundConfig, TankDimensions } from "@/lib/types";

// The panel behind the back glass. Solid (black/white/blue), vertical gradient,
// or a backlit frosted-white glow — the contest "gold standard" for depth. Uses
// an unlit basic material so it reads as a lit panel regardless of scene lights.

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
    c.width = 256;
    c.height = 256;
    const g = ctx.createRadialGradient(128, 116, 16, 128, 132, 190);
    g.addColorStop(0, bg.colorTop);
    g.addColorStop(0.6, bg.colorBottom);
    g.addColorStop(1, darken(bg.colorBottom, 0.35 + bg.glow * 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
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
  tex.generateMipmaps = false;
  return tex;
}

export function Backdrop({
  dims,
  background,
}: {
  dims: TankDimensions;
  background: BackgroundConfig;
}) {
  const solid = background.style === "solid";
  const texture = useMemo(
    () => (solid ? null : makeTexture(background)),
    [solid, background],
  );
  useEffect(() => () => texture?.dispose(), [texture]);

  const w = Math.max(dims.width * 2.6, 130);
  const h = Math.max(dims.height * 2.6, 110);
  const z = -dims.depth / 2 - 3;

  return (
    <mesh position={[0, dims.height * 0.45, z]}>
      <planeGeometry args={[w, h]} />
      {solid ? (
        <meshBasicMaterial color={background.colorTop} toneMapped={false} />
      ) : (
        <meshBasicMaterial map={texture} toneMapped={false} />
      )}
    </mesh>
  );
}
