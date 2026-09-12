// Places utilities. Places are dynamic — sourced from the shared
// positions.json (community) merged with the user's local edits. Each
// place is `{ name, kind: "nation"|"city", href, x, y }` where x/y are
// map pixels (CRS.Simple) and may be absent until the place is placed.

export function searchPlaces(places, query, limit = 8) {
  const q = normalize(query.trim());
  if (!q) return [];
  const scored = [];
  for (const p of places) {
    const n = normalize(p.name);
    if (n === q) scored.push({ p, score: 0 });
    else if (n.startsWith(q)) scored.push({ p, score: 1 });
    else if (n.includes(q)) scored.push({ p, score: 2 });
  }
  scored.sort((a, b) => a.score - b.score || (a.p.kind === "nation" ? -1 : 1));
  return scored.slice(0, limit).map((s) => s.p);
}

// Convert a place to a Leaflet latlng ([y, x]) using mapSize, or null if
// the place has no position yet.
export function placeLatLng(place, mapSize) {
  if (!mapSize) return null;
  if (place.x == null || place.y == null) return null;
  return [place.y, place.x];
}

// Merge shared (community) + local (edits) place maps into an array of
// place objects. Local wins on name collision.
export function mergePlaces(shared = {}, local = {}) {
  const byName = new Map();
  for (const [name, v] of Object.entries(shared)) {
    if (typeof v !== "object" || v === null) continue;
    byName.set(name, { name, ...v });
  }
  for (const [name, v] of Object.entries(local)) {
    if (typeof v !== "object" || v === null) continue;
    byName.set(name, { name, ...v });
  }
  return [...byName.values()];
}

function normalize(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}