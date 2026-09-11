// Persistent IndexedDB cache for the large map image, so repeat visits load
// instantly and the map still works offline once it has been seen.

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

function loadFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () =>
      resolve({ url, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("corrupt image"));
    };
    img.src = url;
  });
}

/**
 * Returns a blob URL + natural dimensions for the map image.
 * Tries IndexedDB first, then the network (also writing through to the cache).
 * Throws if the image is unavailable.
 */
export async function loadImageCached(url) {
  let db = null;
  try {
    db = await openDb();
  } catch {
    /* cache unavailable */
  }
  const key = keyFor(url);

  if (db) {
    try {
      const blob = await txGet(db, key);
      if (blob) {
        const hit = await loadFromBlob(blob);
        return { ...hit, fromCache: true };
      }
    } catch {
      /* fall through to network */
    }
  }

  const resp = await fetch(url, { cache: "force-cache" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  if (db) {
    try {
      await txPut(db, key, blob);
    } catch {
      /* non-fatal */
    }
  }
  const hit = await loadFromBlob(blob);
  return { ...hit, fromCache: false };
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