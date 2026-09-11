export const WIKI_URL = "https://tep.wiki";

// Base map layers from urth-rp/urthmaps (maps/export). All share the same
// full-resolution dimensions (11232x7525) so they swap cleanly on the atlas.
// jsDelivr is the primary mirror (global CDN, reliable CORS); the GitHub raw
// URL is kept as a fallback if the CDN is unreachable.
export const MAP_BASE = "https://cdn.jsdelivr.net/gh/urth-rp/urthmaps@main/maps/export";
export const MAP_BASE_RAW =
  "https://raw.githubusercontent.com/urth-rp/urthmaps/main/maps/export";

export const BASE_LAYERS = [
  {
    id: "map",
    label: "Standard",
    sub: "Political map",
    url: `${MAP_BASE}/urth.png`,
    fallbackUrl: `${MAP_BASE_RAW}/urth.png`,
    chip: "bg-gradient-to-br from-sky-300 via-sky-600 to-cyan-800",
  },
  {
    id: "topo",
    label: "Topographic",
    sub: "Elevation & relief",
    url: `${MAP_BASE}/topo.png`,
    fallbackUrl: `${MAP_BASE_RAW}/topo.png`,
    chip: "bg-gradient-to-br from-emerald-200 via-lime-400 to-amber-700",
  },
  {
    id: "climate",
    label: "Climate",
    sub: "Climate zones",
    url: `${MAP_BASE}/climate.png`,
    fallbackUrl: `${MAP_BASE_RAW}/climate.png`,
    chip: "bg-gradient-to-br from-yellow-200 via-orange-400 to-rose-600",
  },
  {
    id: "currents",
    label: "Ocean Currents",
    sub: "Surface circulation",
    url: `${MAP_BASE}/currents.png`,
    fallbackUrl: `${MAP_BASE_RAW}/currents.png`,
    chip: "bg-gradient-to-br from-blue-400 via-cyan-300 to-indigo-500",
  },
  {
    id: "hydro",
    label: "Hydrology",
    sub: "Rivers & basins",
    url: `${MAP_BASE}/hydro.png`,
    fallbackUrl: `${MAP_BASE_RAW}/hydro.png`,
    chip: "bg-gradient-to-br from-sky-400 to-blue-600",
  },
  {
    id: "blank",
    label: "Blank",
    sub: "Coastlines only",
    url: `${MAP_BASE}/blank.png`,
    fallbackUrl: `${MAP_BASE_RAW}/blank.png`,
    chip: "bg-gradient-to-br from-zinc-100 to-zinc-300",
  },
];

export const MAP_URL = BASE_LAYERS[0].url;

export function getLayer(id) {
  return BASE_LAYERS.find((l) => l.id === id) ?? BASE_LAYERS[0];
}

// World constants (calibrated to the full-resolution urth.png export).
// 1 image pixel = sqrt(6.34126) km.
export const KM2_PER_PX2 = 6.34126;
export const KM_PER_PX = Math.sqrt(KM2_PER_PX2);
export const MI_PER_KM = 0.621371;
export const NM_PER_KM = 0.539957;
export const MI2_PER_KM2 = 0.386102;
export const ACRES_PER_KM2 = 247.105;

export const MI_PER_PX = KM_PER_PX * MI_PER_KM;
export const NM_PER_PX = KM_PER_PX * NM_PER_KM;
export const MI2_PER_PX2 = KM2_PER_PX2 * MI2_PER_KM2;

// Fallback grid used if the live map image cannot be fetched.
export const FALLBACK_W = 4096;
export const FALLBACK_H = 2048;

// Leaflet map options for the Simple CRS atlas.
export const MAP_OPTIONS = {
  crs: undefined, // filled in by caller (needs L)
  minZoom: -2,
  maxZoom: 6,
  zoomSnap: 0.25,
  zoomDelta: 0.5,
  inertia: true,
  inertiaDeceleration: 3000,
  doubleClickZoom: false,
  attributionControl: false,
};