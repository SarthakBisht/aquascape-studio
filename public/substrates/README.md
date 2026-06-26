# Substrate textures

Drop a seamless-ish, top-down, **square** tile per substrate variant here, named
by its id (see `src/data/substrates.ts`):

```
public/substrates/<id>.jpg     # e.g. nature-sand.jpg
```

- One **color photo** per id is enough — the app derives normal + roughness from
  it and mirror-tiles it (hides the repeat seam). ≥512px JPG/PNG.
- To use a photo, set `image: "/substrates/<id>.jpg"` on that variant in
  `src/data/substrates.ts` (and `tileCm` = how many cm of real sand the photo
  shows, default 8 — smaller makes the grains look bigger).
- No file / `image` unset → the variant falls back to the procedural granular
  look. Nothing breaks if the file is missing.

## Have a file
- `nature-sand.jpg` — warm beige fine sand (wired: `image` + `tileCm: 6`).
