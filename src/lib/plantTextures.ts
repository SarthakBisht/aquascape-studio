"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { PlantForm } from "./types";

// Procedurally drawn foliage billboards. Each plant "form" gets a near-white
// alpha silhouette (real leaf shapes, not cones); the per-species color tints
// it via material.color. Generating textures on a canvas sidesteps the WebGL
// CORS problem entirely and gives a drop-in slot for real cutout PNGs later
// (see usePlantTexture). Cached per form so we draw each only once.

const W = 256;
const H = 512;
const cache = new Map<PlantForm, THREE.Texture>();

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Vertical gradient: lighter at the tip, slightly darker at the base. */
function leafGradient(ctx: CanvasRenderingContext2D, topY: number, botY: number) {
  const g = ctx.createLinearGradient(0, topY, 0, botY);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.6, "rgba(232,238,228,1)");
  g.addColorStop(1, "rgba(176,188,170,1)");
  return g;
}

/** A single tapered blade/leaf from a base point up to a (possibly bent) tip. */
function blade(
  ctx: CanvasRenderingContext2D,
  cx: number,
  height: number,
  width: number,
  lean: number,
) {
  const baseY = H - 4;
  const tipX = cx + lean;
  const tipY = baseY - height;
  ctx.beginPath();
  ctx.moveTo(cx - width / 2, baseY);
  ctx.quadraticCurveTo(cx - width / 2 + lean * 0.4, baseY - height * 0.5, tipX, tipY);
  ctx.quadraticCurveTo(cx + width / 2 + lean * 0.4, baseY - height * 0.5, cx + width / 2, baseY);
  ctx.closePath();
  ctx.fillStyle = leafGradient(ctx, tipY, baseY);
  ctx.fill();
}

/** A broad leaf (ellipse-ish) growing from a base point at an angle. */
function broadLeaf(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  length: number,
  width: number,
  angle: number,
) {
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(width, -length * 0.5, 0, -length);
  ctx.quadraticCurveTo(-width, -length * 0.5, 0, 0);
  ctx.closePath();
  ctx.fillStyle = leafGradient(ctx, -length, 0);
  ctx.fill();
  // midrib
  ctx.strokeStyle = "rgba(150,165,145,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -length);
  ctx.stroke();
  ctx.restore();
}

function draw(form: PlantForm): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  const r = rng(form.length * 9973 + form.charCodeAt(0) * 131);
  const cx = W / 2;

  switch (form) {
    case "blade": {
      for (let i = 0; i < 18; i++) {
        const t = i / 17;
        const x = cx + (t - 0.5) * W * 0.7;
        const h = H * (0.78 + r() * 0.2) - Math.abs(t - 0.5) * 60;
        blade(ctx, x, h, 9 + r() * 5, (r() - 0.5) * 90);
      }
      break;
    }
    case "stem": {
      // central stalk
      ctx.strokeStyle = "rgba(150,170,140,1)";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(cx, H - 4);
      ctx.quadraticCurveTo(cx + 16, H * 0.5, cx + 6, 20);
      ctx.stroke();
      for (let i = 0; i < 11; i++) {
        const t = i / 11;
        const y = H - 10 - t * (H - 40);
        const x = cx + Math.sin(t * Math.PI * 2) * 14;
        const side = i % 2 ? 1 : -1;
        broadLeaf(ctx, x, y, 60 + r() * 30, 22, side * (0.9 + r() * 0.3));
      }
      break;
    }
    case "rosette": {
      const leaves = 9;
      for (let i = 0; i < leaves; i++) {
        const a = (i / (leaves - 1) - 0.5) * 2.2; // fan
        const len = H * (0.55 + (1 - Math.abs(a) / 1.2) * 0.4);
        broadLeaf(ctx, cx + (r() - 0.5) * 10, H - 6, len, 26 + r() * 8, a);
      }
      break;
    }
    case "broadleaf": {
      const leaves = 6;
      for (let i = 0; i < leaves; i++) {
        const a = (i / (leaves - 1) - 0.5) * 1.8;
        broadLeaf(ctx, cx + (r() - 0.5) * 24, H - 6, H * (0.5 + r() * 0.35), 46 + r() * 16, a);
      }
      break;
    }
    case "moss": {
      // irregular fuzzy clump in the lower portion
      for (let i = 0; i < 900; i++) {
        const ang = r() * Math.PI * 2;
        const rad = r() * W * 0.42;
        const x = cx + Math.cos(ang) * rad;
        const y = H - 10 - Math.abs(Math.sin(ang)) * rad * 0.9 - r() * 60;
        const v = 200 + r() * 55;
        ctx.strokeStyle = `rgba(${v - 30},${v},${v - 40},${0.5 + r() * 0.4})`;
        ctx.lineWidth = 1 + r() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * 8, y - 4 - r() * 8);
        ctx.stroke();
      }
      break;
    }
    case "floating": {
      for (let i = 0; i < 9; i++) {
        const x = cx + (r() - 0.5) * W * 0.7;
        const y = H - 40 - r() * 80;
        const rad = 26 + r() * 16;
        ctx.beginPath();
        ctx.ellipse(x, y, rad, rad * 0.78, r() * Math.PI, 0, Math.PI * 2);
        ctx.fillStyle = leafGradient(ctx, y - rad, y + rad);
        ctx.fill();
      }
      break;
    }
  }
  return c;
}

function getPlantTexture(form: PlantForm): THREE.Texture {
  const cached = cache.get(form);
  if (cached) return cached;
  const tex = new THREE.CanvasTexture(draw(form));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(form, tex);
  return tex;
}

/**
 * Returns the billboard texture for a species form, transparently swapping in a
 * real cutout PNG when `url` is provided (and loaded). This is the photoreal
 * upgrade path: set `texture` on a species → it just works.
 */
export function usePlantTexture(form: PlantForm, url?: string): THREE.Texture {
  const base = useMemo(() => getPlantTexture(form), [form]);
  const [loaded, setLoaded] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) {
      setLoaded(null);
      return;
    }
    let active = true;
    const tex = new THREE.TextureLoader().load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        if (active) setLoaded(t);
      },
      undefined,
      () => {}, // on error keep procedural
    );
    return () => {
      active = false;
      tex.dispose();
    };
  }, [url]);

  return loaded ?? base;
}
