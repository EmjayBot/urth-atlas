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

// Procedural cloud texture used over the satellite layer. Soft white blobs on
// a transparent canvas, tiled across the world like the base map.
export function makeCloudTexture(W = 4096, H = 2048) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  let seed = 987654;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const blobs = 64;
  for (let i = 0; i < blobs; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 90 + rnd() * 280;
    const a = 0.22 + rnd() * 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = "blur(30px)";
  ctx.drawImage(canvas, 0, 0);
  return canvas.toDataURL("image/png");
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