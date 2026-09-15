// Generates downscaled mobile variants of the full-resolution map images.
//
// Why: the base layers are 11232x7525 (~84MP). One decode is ~338MB of RGBA
// bitmap — desktop browsers survive it, but mobile Safari has hard per-image
// decode limits and Android Chrome tabs get OOM-killed. The mobile variants
// (2048px wide, ~2.8MP, ~11MB decoded) are served to low-memory devices via
// resolveLayer() in src/lib/scale.js. The app keeps the FULL coordinate
// space (11232x7525) and lets Leaflet stretch the small image across it, so
// pixel math, pins, and measurements are identical on both tiers.
//
// Usage: npm run images:mobile
import sharp from "sharp";
import { statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

// Base map carries the visual detail: 4096px (11MP, ~45MB decoded) stays
// far below phone decode/memory limits while looking sharp at phone zooms.
// Line/dot overlays get 3072px — plenty for vector-ish art.
const JOBS = [
  { src: "blank-political.webp", out: "blank-political-mobile.webp", width: 4096 },
  { src: "timezones.webp", out: "timezones-mobile.webp", width: 3072 },
  // Markers overlay carries alpha — webp preserves it.
  { src: "cities-subnational-markers.png", out: "cities-subnational-markers-mobile.webp", width: 3072 },
];

for (const { src, out, width } of JOBS) {
  const input = join(root, src);
  const output = join(root, out);
  const meta = await sharp(input).metadata();
  const h = Math.round((meta.height / meta.width) * width);
  await sharp(input).resize(width, h, { fit: "fill" }).webp({ quality: 82, effort: 6 }).toFile(output);
  const bytes = statSync(output).size;
  console.log(`${src} ${meta.width}x${meta.height} -> ${out} ${width}x${h} (${(bytes / 1024).toFixed(0)} KB)`);
}
