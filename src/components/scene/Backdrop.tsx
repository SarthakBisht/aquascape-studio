"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { BackgroundConfig } from "@/lib/types";

// The tank backdrop is painted straight into scene.background so it fills the
// whole view seamlessly (a cyclorama) — no finite plane whose edges could show.
// Solid → a flat color; gradient / backlit → a fullscreen canvas texture.

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
    const g = ctx.createRadialGradient(256, 176, 24, 256, 200, 300);
    g.addColorStop(0, bg.colorTop);
    g.addColorStop(0.55, bg.colorBottom);
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
  underwater,
}: {
  background: BackgroundConfig;
  underwater: boolean;
}) {
  const texture = useMemo(
    () => (background.style === "solid" ? null : makeTexture(background)),
    [background],
  );
  useEffect(() => () => texture?.dispose(), [texture]);

  // NOTE: returns a scene.background attach directly (no wrapper group), so it
  // binds to the scene rather than a child object.
  if (underwater) return <color attach="background" args={["#08303c"]} />;
  if (background.style === "solid" || !texture)
    return <color attach="background" args={[background.colorTop]} />;
  return <primitive attach="background" object={texture} />;
}
