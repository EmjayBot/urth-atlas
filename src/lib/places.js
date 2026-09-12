// Unified "places" index combining nations and cities so search and the map
// can treat them as one set of searchable, placeable points.

import nations from "../data/nations.json";
import cities from "../data/cities.json";

export const PLACES = [
  ...nations.map((n) => ({ ...n, kind: "nation" })),
  ...cities.map((c) => ({ ...c, kind: "city" })),
];

export function getPlace(name) {
  return PLACES.find((p) => p.name === name) || null;
}

// Position for a place: an override (calibrated pixel) wins, else base coords.
// Returns [y, x] latlng (Leaflet CRS.Simple uses lat=y, lng=x).
export function placeLatLng(place, override, mapSize) {
  if (!mapSize) return null;
  if (override) return [override.y, override.x];
  if (place.nx != null && place.ny != null)
    return [place.ny * mapSize.H, place.nx * mapSize.W];
  return null;
}

function normalize(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Search across nations + cities; nations sort above cities on equal match.
export function searchPlaces(query, limit = 8) {
  const q = normalize(query.trim());
  if (!q) return [];
  const scored = [];
  for (const p of PLACES) {
    const n = normalize(p.name);
    if (n === q) {
      scored.push({ p, score: 0 });
    } else if (n.startsWith(q)) {
      scored.push({ p, score: 1 });
    } else if (n.includes(q)) {
      scored.push({ p, score: 2 });
    }
  }
  scored.sort((a, b) => a.score - b.score || (a.p.kind === "nation" ? -1 : 1));
  return scored.slice(0, limit).map((s) => s.p);
}