// Persistent IndexedDB cache for the large map image, so repeat visits load
// instantly and the map still works offline once it has been seen.
//
// Display path: overlays load the image directly via an <img> URL (works even
// in legacy/IE-mode browsers where blob: URLs can be unreliable). IndexedDB is
// only used as an offline cache written in the background.

const DB_NAME = "urth-atlas";
const STORE = "images";

function keyFor(url) {
  const name = url.split("/").pop() || "map";
  return `${name}.v1`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => reject(r.error);
  });
}

function txPut(db, key, blob) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function loadDimsFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = url;
  });
}

// Best-effort background write-through so the image is available offline later.
function cacheToIndexedDb(db, key, url) {
  if (!db) return;
  fetch(url, { cache: "no-store" })
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("HTTP " + r.status))))
    .then((blob) => txPut(db, key, blob))
    .catch(() => {});
}

/**
 * Resolve a layer to something Leaflet can display.
 * Returns { url, w, h, fromCache } where url is either a cached blob URL or the
 * direct source URL (preferred for maximum compatibility).
 */
export async function loadLayer(def) {
  let db = null;
  try {
    db = await openDb();
  } catch {
    /* cache unavailable */
  }
  const key = keyFor(def.url);

  if (db) {
    try {
      const blob = await txGet(db, key);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const dims = await loadDimsFromUrl(url);
        return { url, w: dims.w, h: dims.h, fromCache: true };
      }
    } catch {
      /* fall through to network */
    }
  }

  for (const src of [def.url, def.fallbackUrl].filter(Boolean)) {
    try {
      const dims = await loadDimsFromUrl(src);
      cacheToIndexedDb(db, key, def.url);
      return { url: src, w: dims.w, h: dims.h, fromCache: false };
    } catch {
      /* try next source */
    }
  }
  throw new Error("image unavailable");
}

// Realistic procedural clouds (Google-Earth vibe).
// Fractal Brownian motion value-noise with domain warping, seamless in X so
// world copies tile perfectly. Latitude-banded coverage (ITCZ + storm tracks),
// elongated westerly streaks, soft puffy edges, and subtle gray shading for
// thickness. Rendered small then upscaled for soft, non-pixelated puffs.
//
// opts: { coverage (0..1, higher = more clouds), softness, seed, alpha }
// Returns a dataURL sized W x H (default 2048x1024 — plenty since clouds are
// soft; keeps memory + GPU cheap vs the old 4096x2048 blob field).
const _cloudMemo = new Map();
export function makeCloudTexture(W = 2048, H = 1024, opts = {}) {
  const { coverage = 0.52, softness = 0.32, seed = 20260913, alpha = 235 } = opts;
  const memoKey = `${W}x${H}:${coverage}:${softness}:${seed}:${alpha}`;
  if (_cloudMemo.has(memoKey)) return _cloudMemo.get(memoKey);

  // Work at half res for speed, upscale at the end for softness.
  const w = Math.max(256, W >> 1);
  const h = Math.max(128, H >> 1);

  let s = seed >>> 0 || 1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  // Permutation-free hashed lattice: deterministic, wraps in X via modulo.
  const hash = (ix, iy) => {
    let n = (ix * 374761393 + iy * 668265263 + seed * 974634211) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n = n ^ (n >>> 16);
    return (n >>> 0) / 4294967296;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  function valueNoise(x, y, px, py) {
    // px/py = lattice periods (px wraps for seamless tiling)
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const x0 = ((xi % px) + px) % px;
    const x1 = (x0 + 1) % px;
    const y0 = yi;
    const y1 = yi + 1;
    const a = hash(x0, y0);
    const b = hash(x1, y0);
    const c = hash(x0, y1);
    const d = hash(x1, y1);
    const u = smooth(xf);
    const v = smooth(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  // fbm with x-stretch for westerly streaks; wraps every `basePx` cells.
  function fbm(nx, ny, octaves, basePx, basePy, stretchX = 2.6) {
    let amp = 0.5;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      const px = basePx * freq;
      const py = basePy * freq;
      sum += amp * valueNoise(nx * freq * stretchX, ny * freq, Math.max(1, Math.round(px * stretchX)), Math.max(1, py));
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }

  const field = new Float32Array(w * h);
  const warpAmt = 0.55;
  for (let y = 0; y < h; y++) {
    const v = y / h; // 0 top (north pole) .. 1 bottom
    const lat = Math.abs(v - 0.5) * 2; // 0 equator .. 1 pole
    // Latitude bands: ITCZ bump near equator + mid-latitude storm tracks,
    // thinner at poles (avoids polar pinch artifacts too).
    const bands =
      0.72 +
      0.28 * Math.exp(-Math.pow((lat - 0.08) / 0.16, 2)) +
      0.22 * Math.exp(-Math.pow((lat - 0.55) / 0.22, 2)) -
      0.3 * Math.pow(lat, 3);
    for (let x = 0; x < w; x++) {
      const u = x / w;
      // Domain warp for swirls / fronts instead of round blobs.
      const qx = fbm(u * 6, v * 3, 4, 6, 3);
      const qy = fbm(u * 6 + 5.2, v * 3 + 1.3, 4, 6, 3);
      const wx = u * 9 + warpAmt * qx;
      const wy = v * 4.5 + warpAmt * qy;
      let d = fbm(wx, wy, 6, 9, 5);
      // Ridged detail for wispy cirrus streaks mixed in.
      const r = 1 - Math.abs(2 * fbm(u * 14 + 3.7, v * 7 + 9.1, 4, 14, 7) - 1);
      d = d * 0.82 + r * r * 0.18;
      field[y * w + x] = d * bands + (rnd() - 0.5) * 0.012;
    }
  }

  const smoothstep = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  const lo = coverage - softness * 0.5;
  // Small canvas first.
  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const sctx = small.getContext("2d");
  const img = sctx.createImageData(w, h);
  const px = img.data;
  const lightX = -0.55;
  const lightY = -0.83;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = field[i];
      const a01 = smoothstep(lo, lo + softness, d);
      if (a01 <= 0.003) continue;
      // Thickness shading from local gradient (light from upper-left).
      const xm = field[y * w + ((x - 1 + w) % w)];
      const xp = field[y * w + ((x + 1) % w)];
      const ym = field[Math.max(0, y - 1) * w + x];
      const yp = field[Math.min(h - 1, y + 1) * w + x];
      const gx = (xp - xm) * 8;
      const gy = (yp - ym) * 8;
      const shade = Math.max(-1, Math.min(1, -(gx * lightX + gy * lightY)));
      // Bright tops (~255), gray-blue bellies (~218) for depth.
      const v = Math.round(255 - (1 - Math.max(0, shade)) * 0 + (1 - a01) * 0 - Math.max(0, -shade) * 26 - (1 - smoothstep(lo, 1, d)) * 10);
      const o = i * 4;
      px[o] = Math.max(218, Math.min(255, v));
      px[o + 1] = Math.max(222, Math.min(255, v + 2));
      px[o + 2] = Math.max(228, Math.min(255, v + 5));
      px[o + 3] = Math.round(a01 * alpha);
    }
  }
  sctx.putImageData(img, 0, 0);

  // Seamless fix-up: blend left/right edge columns (kills any residual seam).
  const edge = Math.max(4, (w / 256) | 0);
  const strip = sctx.getImageData(0, 0, w, h);
  const sd = strip.data;
  for (let y = 0; y < h; y++) {
    for (let e = 0; e < edge; e++) {
      const t = e / edge;
      const li = (y * w + e) * 4;
      const ri = (y * w + (w - 1 - e)) * 4;
      for (let c = 0; c < 4; c++) {
        const m = (sd[li + c] * t + sd[ri + c] * (1 - t) + sd[ri + c] * t + sd[li + c] * (1 - t)) / 2;
        sd[li + c] = sd[ri + c] = m;
      }
    }
  }
  sctx.putImageData(strip, 0, 0);

  // Upscale with smoothing → soft puffy edges, then wrap-blur to hide tiling.
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(small, 0, 0, W, H);
  // Draw wrapped copies offset by half to soften any repetition, very faint.
  try {
    ctx.globalAlpha = 0.35;
    ctx.drawImage(canvas, -W / 2, 0, W, H);
    ctx.drawImage(canvas, W / 2, 0, W, H);
    ctx.globalAlpha = 1;
  } catch {}
  try {
    ctx.filter = "blur(1.5px)";
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
  } catch {}

  const url = canvas.toDataURL("image/png");
  _cloudMemo.set(memoKey, url);
  // Bound cache.
  if (_cloudMemo.size > 6) {
    const first = _cloudMemo.keys().next().value;
    _cloudMemo.delete(first);
  }
  return url;
}

export function clearCloudCache() {
  _cloudMemo.clear();
}

// Fallback placeholder grid used when the live map cannot be fetched.
export function makeFallbackGrid(W, H) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#e5e3df";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(14,116,144,0.14)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 256) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 256) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(14,116,144,0.08)";
  ctx.fillRect(W * 0.2, H * 0.25, W * 0.15, H * 0.3);
  ctx.fillRect(W * 0.45, H * 0.2, W * 0.2, H * 0.5);
  ctx.fillRect(W * 0.7, H * 0.3, W * 0.18, H * 0.25);
  return canvas.toDataURL();
}