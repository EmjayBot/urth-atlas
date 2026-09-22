// Prototype tile pyramid generator (sharp).
//
// Usage:
//   node scripts/make-tiles.mjs <src.png> <outdir> [--min 0] [--max 0]
//     [--size 256] [--quality 80] [--bg #7399b5] [--jobs 8]
//
// Scheme matches the atlas CRS.Simple setup exactly: at zoom z, tile
// (x, y) shows source rect [x*S, (x+1)*S] x [y*S, (y+1)*S] with
// S = size / 2^z, scaled to a full tile. Same pixels the stretched
// imageOverlay shows at the same zoom — so pins/measurements keep working.
// XYZ orientation (y=0 at top), like Leaflet's default tileLayer.
//
// NOTE on zoom range: in this pixel-space CRS, z0 IS native 1:1, and higher
// zooms only magnify (Leaflet overzooms tiles automatically, pixel-identical
// to the overlay). So a z0-only pyramid already matches current sharpness
// everywhere while killing the 84MP decode; extend higher later only for
// beyond-native crispness.
//
// Skips tiles that are fully transparent (for future overlay layers).
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

function arg(name, def) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const src = process.argv[2];
const outdir = process.argv[3];
if (!src || !outdir) {
  console.error("usage: node scripts/make-tiles.mjs <src> <outdir> [opts]");
  process.exit(1);
}
const MIN = parseInt(arg("min", "0"), 10);
const MAX = parseInt(arg("max", "0"), 10);
const SIZE = parseInt(arg("size", "256"), 10);
const QUALITY = parseInt(arg("quality", "80"), 10);
const BG = arg("bg", "#7399b5");
const JOBS = parseInt(arg("jobs", "8"), 10);

const meta = await sharp(src).metadata();
const W = meta.width;
const H = meta.height;
const hasAlpha = meta.hasAlpha || meta.channels === 4;
console.log(`source ${W}x${H} alpha=${hasAlpha} zooms ${MIN}..${MAX}`);

// Build the full task list first, then run with bounded concurrency.
const tasks = [];
for (let z = MIN; z <= MAX; z++) {
  const S = SIZE / Math.pow(2, z); // source px per tile
  const nx = Math.ceil(W / S);
  const ny = Math.ceil(H / S);
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      tasks.push({ z, x, y, S });
    }
  }
}
console.log(`${tasks.length} tiles, ${JOBS} workers`);

async function makeTile({ z, x, y, S }) {
  const rx0 = Math.floor(x * S);
  const ry0 = Math.floor(y * S);
  const rx1 = Math.min(Math.ceil((x + 1) * S), W);
  const ry1 = Math.min(Math.ceil((y + 1) * S), H);
  const rw = rx1 - rx0;
  const rh = ry1 - ry0;
  if (rw <= 0 || rh <= 0) return "empty";
  const k = SIZE / S;
  const ox = Math.round((rx0 - x * S) * k);
  const oy = Math.round((ry0 - y * S) * k);
  const dw = Math.max(1, Math.round(rw * k));
  const dh = Math.max(1, Math.round(rh * k));
  let tile = sharp(src, { limitInputPixels: false }).extract({
    left: rx0, top: ry0, width: rw, height: rh,
  });
  if (hasAlpha) {
    const raw = await tile.clone().raw().toBuffer({ resolveWithObject: true });
    let opaque = false;
    const ch = raw.info.channels;
    for (let i = ch - 1; i < raw.data.length; i += ch) {
      if (raw.data[i] > 8) { opaque = true; break; }
    }
    if (!opaque) return "skipped";
  }
  const dir = join(outdir, String(z), String(x));
  mkdirSync(dir, { recursive: true });
  const needCanvas = ox !== 0 || oy !== 0 || dw !== SIZE || dh !== SIZE;
  let img = tile.resize(dw, dh, { fit: "fill", kernel: "lanczos3" });
  if (needCanvas) {
    const canvas = sharp({
      create: { width: SIZE, height: SIZE, channels: 3, background: BG },
    });
    const buf = await img.jpeg({ quality: 100 }).toBuffer();
    img = canvas.composite([{ input: buf, left: ox, top: oy }]);
  }
  await img.jpeg({ quality: QUALITY }).toFile(join(dir, `${y}.jpg`));
  return "kept";
}

let done = 0;
let kept = 0;
const t0 = Date.now();
async function worker() {
  while (tasks.length) {
    const t = tasks.pop();
    const r = await makeTile(t);
    if (r === "kept") kept++;
    done++;
    if (done % 200 === 0) {
      console.log(`  ${done}/${done + tasks.length} (${kept} kept, ${Math.round((Date.now() - t0) / 1000)}s)`);
    }
  }
}
await Promise.all(Array.from({ length: JOBS }, () => worker()));
console.log(`done: ${kept} tiles in ${Math.round((Date.now() - t0) / 1000)}s -> ${outdir}`);
