# Bundled assets

Drop CC0 / self-made assets here and load them with relative paths (e.g.
`/models/seiryu.glb`). **Always bundle assets locally** rather than hotlinking —
third-party hosts often lack CORS headers and WebGL will refuse to use the
texture.

Suggested layout:

```
public/
  models/    # .glb / .gltf rocks, driftwood, fish
  plants/    # cutout PNGs for plant billboards (transparent background)
  textures/  # PBR maps for hardscape + substrate (basecolor/normal/roughness)
  hdri/      # .hdr / .exr environment maps for glass reflections
```

## Plants — drop-in photoreal upgrade

Plants render as crossed billboard cards. By default they use a **procedurally
drawn** leaf silhouette per form (no download needed). To make a species
photoreal, drop a transparent-background cutout PNG in `public/plants/` and set
its path on the species in `src/data/plants.ts`:

```ts
{ id: "anubias-nana", /* … */ texture: "/plants/anubias-nana.png" }
```

That's the whole upgrade — `usePlantTexture` swaps the procedural texture for
the image automatically. Good cutouts: front-on, single plant/tuft, alpha
edges, ~512–1024px tall, leaves filling most of the frame.

## Good CC0 sources

- **Poly Haven** (polyhaven.com) — CC0 scanned rocks, branches, plants, HDRIs.
- **Quaternius** (quaternius.com) — CC0 low-poly nature & fish packs.
- **Sketchfab** — filter by CC0; rigged low-poly fish available.

## Current state

The MVP ships with **procedural** rocks/driftwood and **billboard-blade** plants
so it runs with zero downloaded assets. Replacing them with real scanned glTF
models + PBR textures is the main realism upgrade — see the milestones in
`../CLAUDE.md`.
