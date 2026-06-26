// Re-encode plant cutouts to web-served WebP.
//
//   PNG sources (high-res, alpha)  assets/plants-src/*.png
//        -> resize ≤768px, webp q82 -> public/plants/*.webp   (served + thumbs)
//
// Keeps the deployed bundle ~1 MB instead of ~18 MB of raw PNG. Run after adding
// or refreshing a cutout:  node scripts/encode-plants.mjs
//
// sharp is a transitive dep (via Next's image optimization), not declared in our
// package.json — resolve it leniently so a version bump doesn't break this.
import { createRequire } from "node:module";
import { readdirSync, statSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "noop.js"));

function loadSharp() {
  try {
    return require("sharp");
  } catch {
    // hoisted under pnpm's store as node_modules/.pnpm/sharp@<ver>/node_modules/sharp
    const pnpmDir = join(ROOT, "node_modules/.pnpm");
    const hit = readdirSync(pnpmDir).find((d) => /^sharp@/.test(d));
    if (!hit) throw new Error("sharp not found — run `pnpm install` first");
    return require(join(pnpmDir, hit, "node_modules/sharp"));
  }
}

const sharp = loadSharp();
const SRC = join(ROOT, "assets/plants-src");
const OUT = join(ROOT, "public/plants");
mkdirSync(OUT, { recursive: true });

const pngs = existsSync(SRC)
  ? readdirSync(SRC).filter((f) => f.toLowerCase().endsWith(".png"))
  : [];
if (!pngs.length) {
  console.log(`No PNG sources in ${SRC} — nothing to do.`);
  process.exit(0);
}

let before = 0;
let after = 0;
for (const f of pngs) {
  const src = join(SRC, f);
  const out = join(OUT, f.replace(/\.png$/i, ".webp"));
  before += statSync(src).size;
  await sharp(src)
    .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90, effort: 5 })
    .toFile(out);
  after += statSync(out).size;
}
console.log(
  `${pngs.length} files: ${(before / 1e6).toFixed(1)}MB png -> ${(after / 1e6).toFixed(1)}MB webp`,
);
