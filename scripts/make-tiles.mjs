// Prototype tile pyramid generator (sharp).
//
// Usage:
//   node scripts/make-tiles.mjs <src.png> <outdir> [--min 0] [--max 0]
//     [--size 256] [--quality 80] [--bg #7399b5] [--jobs 8]
//     [--format jpeg|png|webp]
//
// --format jpeg (default) is for opaque base layers. Overlay layers with
// transparency (cities, subnational) need --format png (pixel-perfect
// labels) or --format webp (smaller, lossy): edge padding becomes
// transparent instead of the --bg color, and skipped-tile detection uses
// the alpha channel either way.
//
// Scheme matches the atlas CRS.Simple setup exactly: at zoom z, tile
// (x, y) shows source rect [x*S, (x+1)*S] x [H-(y+1)*S, H-y*S] with
// S = size / 2^z, scaled to a full tile. Same pixels the stretched
// imageOverlay shows at the same zoom — so pins/measurements keep working.
//
// Rows are BOTTOM-anchored (TMS orientation, y=0 at the bottom), NOT
// top-down: Leaflet's tile grid is anchored at layer origin (lat 0 = the
// image BOTTOM edge), and 7525 is not a multiple of 256 (7525 = 29*256 +
// 101). Top-anchored files would sit 101px off the tile grid — visible as
// hard seams where rows meet. Columns stay left-anchored (x=0 at lng 0)
// because that edge IS grid-aligned.
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
const FORMAT = arg("format", "jpeg");
if (!["jpeg", "png", "webp"].includes(FORMAT)) {
  console.error("--format must be jpeg, png, or webp");
  process.exit(1);
}
const EXT = FORMAT === "jpeg" ? "jpg" : FORMAT;
const HAS_ALPHA_OUT = FORMAT !== "jpeg";

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
  const rx1 = Math.min(Math.ceil((x + 1) * S), W);
  // Bottom-anchored row: y=0 is the bottom row (see header). srcTop can go
  // negative for the topmost partial row — it is clamped and saved narrow
  // (no padding; the ocean backdrop shows past the map edge).
  const srcTop = H - (y + 1) * S;
  const srcBottom = H - y * S;
  const ry0 = Math.max(0, Math.floor(srcTop));
  const ry1 = Math.min(H, Math.ceil(srcBottom));
  const rw = rx1 - rx0;
  const rh = ry1 - ry0;
  if (rw <= 0 || rh <= 0) return "empty";
  const k = SIZE / S;
  const ox = Math.round((rx0 - x * S) * k);
  const oy = Math.round((ry0 - srcTop) * k);
  const dw = Math.max(1, Math.round(rw * k));
  const dh = Math.max(1, Math.round(rh * k));
  let tile = sharp(src, { limitInputPixels: false }).extract({
    left: rx0, top: ry0, width: rw, height: rh,
  });
  const hasOpaque = async (pipeline) => {
    const raw = await pipeline.clone().raw().toBuffer({ resolveWithObject: true });
    const ch = raw.info.channels;
    for (let i = ch - 1; i < raw.data.length; i += ch) {
      if (raw.data[i] > 8) return true;
    }
    return false;
  };
  if (hasAlpha && !(await hasOpaque(tile))) return "skipped";
  const dir = join(outdir, String(z), String(x));
  mkdirSync(dir, { recursive: true });
  let img = tile.resize(dw, dh, { fit: "fill", kernel: "lanczos3" });
  // Encode helper matching the output format (keeps alpha for png/webp).
  const encode = (pipeline, q) =>
    FORMAT === "png" ? pipeline.png() :
    FORMAT === "webp" ? pipeline.webp({ quality: q }) :
    pipeline.jpeg({ quality: q });
  // Partial edge tiles: the dateline (right) column is saved at NATURAL
  // size with NO padding, so the neighboring world copy shows through the
  // rest of the slot — any padding there is wrong (flat color notches
  // through dateline land; wrapped content double-draws against the copy
  // that owns those pixels). The top partial row keeps ocean/transparent
  // padding (oy > 0 path below): nothing exists past the map's top edge,
  // so padding there can never double-draw. Only fractional-S levels
  // (unused by our -2..0 pyramids) need positioning for other offsets.
  if (ox !== 0 || oy !== 0) {
    // Narrow canvas: only as wide as the content (ox == 0 for our integer
    // grids), so a dateline-corner tile never paints flat color over the
    // neighboring copy's pixels. Full height: the top pad is ocean/void.
    const cw = ox === 0 ? dw : SIZE;
    const canvas = sharp({
      create: HAS_ALPHA_OUT
        ? { width: cw, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
        : { width: cw, height: SIZE, channels: 3, background: BG },
    });
    const buf = await encode(img, 100).toBuffer();
    img = canvas.composite([{ input: buf, left: ox, top: oy }]);
  }
  await encode(img, QUALITY).toFile(join(dir, `${y}.${EXT}`));
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
