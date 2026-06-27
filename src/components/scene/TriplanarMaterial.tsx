"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getTextureSet } from "@/lib/hardscapeTextureGen";
import type { HardscapeSurface } from "@/lib/types";

// Triplanar PBR material for hardscape. The procedural icosahedron / generated
// meshes have unusable UVs for tiling textures, so we project a seamless PBR set
// (albedo + optional normal + roughness) on the three world planes and blend by
// the surface normal. Implemented by patching MeshStandardMaterial via
// onBeforeCompile — no extra dependency. World-space projection keeps texel size
// constant (in cm) across pieces of any scale. Falls back to plain color when no
// texture set is given (handled by the caller).

// uTriScale = repeats per world-cm; uTriBlend sharpens the plane transition.
function patchShader(this: THREE.MeshStandardMaterial, shader: {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
}) {
  shader.uniforms.uTriScale = { value: this.userData.triScale ?? 0.05 };
  shader.uniforms.uTriBlend = { value: 6.0 };
  // Per-piece sample offset + shade so two rocks of the same surface differ and
  // visible tiling is broken (the cached texture is shared; only the lookup moves).
  shader.uniforms.uTriOffset = {
    value: (this.userData.triOffset as THREE.Vector3) ?? new THREE.Vector3(),
  };
  shader.uniforms.uTriShade = { value: (this.userData.triShade as number) ?? 1.0 };

  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
       varying vec3 vTriPos;
       varying vec3 vTriNrm;`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       vTriPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
       vTriNrm = mat3(modelMatrix) * objectNormal;`,
    );

  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
       varying vec3 vTriPos;
       varying vec3 vTriNrm;
       uniform float uTriScale;
       uniform float uTriBlend;
       uniform vec3 uTriOffset;
       uniform float uTriShade;
       vec3 triWeights(vec3 n){
         vec3 w = pow(abs(n), vec3(uTriBlend));
         return w / max(w.x + w.y + w.z, 1e-4);
       }`,
    )
    // Albedo: triplanar sample, manual sRGB->linear (texture2D skips the auto
    // colorspace conversion the generated UV path would do).
    .replace(
      "#include <map_fragment>",
      `#ifdef USE_MAP
         vec3 tp = (vTriPos + uTriOffset) * uTriScale;
         vec3 tw = triWeights(normalize(vTriNrm));
         vec4 triCol =
           texture2D(map, tp.zy) * tw.x +
           texture2D(map, tp.xz) * tw.y +
           texture2D(map, tp.xy) * tw.z;
         triCol.rgb = pow(triCol.rgb, vec3(2.2)) * uTriShade;
         diffuseColor *= triCol;
       #endif`,
    )
    .replace(
      "#include <roughnessmap_fragment>",
      `float roughnessFactor = roughness;
       #ifdef USE_ROUGHNESSMAP
         vec3 rp = (vTriPos + uTriOffset) * uTriScale;
         vec3 rw = triWeights(normalize(vTriNrm));
         float rg =
           texture2D(roughnessMap, rp.zy).g * rw.x +
           texture2D(roughnessMap, rp.xz).g * rw.y +
           texture2D(roughnessMap, rp.xy).g * rw.z;
         roughnessFactor *= rg;
       #endif`,
    )
    // Normal map: triplanar "whiteout" blend in world space, then to view space
    // (the space three's lighting expects for `normal`).
    .replace(
      "#include <normal_fragment_maps>",
      `#ifdef USE_NORMALMAP
         vec3 np = (vTriPos + uTriOffset) * uTriScale;
         vec3 nw = triWeights(normalize(vTriNrm));
         vec3 gN = normalize(vTriNrm);
         vec3 tnx = texture2D(normalMap, np.zy).xyz * 2.0 - 1.0;
         vec3 tny = texture2D(normalMap, np.xz).xyz * 2.0 - 1.0;
         vec3 tnz = texture2D(normalMap, np.xy).xyz * 2.0 - 1.0;
         tnx.xy *= normalScale; tny.xy *= normalScale; tnz.xy *= normalScale;
         vec3 wnx = vec3(tnx.xy + gN.zy, abs(tnx.z) * gN.x);
         vec3 wny = vec3(tny.xy + gN.xz, abs(tny.z) * gN.y);
         vec3 wnz = vec3(tnz.xy + gN.xy, abs(tnz.z) * gN.z);
         vec3 worldN = normalize(wnx.zyx * nw.x + wny.xzy * nw.y + wnz.xyz * nw.z);
         normal = normalize((viewMatrix * vec4(worldN, 0.0)).xyz);
       #endif`,
    );
}

export function TriplanarMaterial({
  surface,
  albedo,
  tileCm,
  color,
  roughness,
  seed = 0,
  doubleSide = false,
}: {
  /** Procedural PBR surface (generates albedo + normal + roughness). */
  surface?: HardscapeSurface;
  /** Render both faces — sculpted shells can be concave/self-intersecting, so
   *  FrontSide culling would read as a hollow "see-through" rock. */
  doubleSide?: boolean;
  /** OR an uploaded image used as the albedo (tiled triplanar); no normal/
   *  roughness map → the shader's #ifdefs fall back to flat normal + scalar
   *  roughness automatically. Same wet-stone shader, your photo. */
  albedo?: THREE.Texture | null;
  /** Triplanar repeat (cm) for an uploaded albedo. Default 20. */
  tileCm?: number;
  color: string;
  roughness: number;
  /** Per-piece seed → unique texture sample offset + brightness so identical
   *  surfaces don't look cloned. */
  seed?: number;
}) {
  const material = useMemo(() => {
    let map: THREE.Texture;
    let normalMap: THREE.Texture | undefined;
    let roughnessMap: THREE.Texture | undefined;
    let repeatCm: number;
    if (albedo) {
      map = albedo;
      repeatCm = tileCm ?? 20;
    } else if (surface) {
      const set = getTextureSet(surface); // cached singletons — don't dispose
      map = set.albedo;
      normalMap = set.normal;
      roughnessMap = set.roughness;
      repeatCm = surface.tileCm;
    } else {
      // No surface and no upload — a plain material; color/roughness applied by
      // the effect below. (Callers normally pass one or the other.)
      return new THREE.MeshStandardMaterial();
    }
    const mat = new THREE.MeshStandardMaterial({
      map,
      normalMap,
      roughnessMap,
      normalScale: new THREE.Vector2(1.15, 1.15),
      metalness: 0,
      envMapIntensity: 1.25, // wet-stone sheen off the studio env
    });
    mat.userData.triScale = 1 / repeatCm;
    // Hash the seed into a stable offset (cm) + a ±8% shade. An uploaded photo
    // keeps a neutral offset/shade (it's already unique to the piece).
    const r = (n: number) => {
      const t = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
      return t - Math.floor(t);
    };
    mat.userData.triOffset = albedo
      ? new THREE.Vector3()
      : new THREE.Vector3(r(1) * 200, r(2) * 200, r(3) * 200);
    mat.userData.triShade = albedo ? 1.0 : 0.92 + r(4) * 0.16;
    mat.onBeforeCompile = patchShader;
    return mat;
  }, [surface, albedo, tileCm, seed]);

  useEffect(() => {
    material.color.set(color);
    material.roughness = roughness;
    material.side = doubleSide ? THREE.DoubleSide : THREE.FrontSide;
  }, [material, color, roughness, doubleSide]);

  // Dispose the material program on unmount; the textures are shared/cached.
  useEffect(() => () => material.dispose(), [material]);

  return <primitive object={material} attach="material" />;
}
