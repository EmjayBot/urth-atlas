import { IS_LOW_MEM } from "./device";

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
    label: "Political",
    sub: "Blank political map",
    url: `${import.meta.env.BASE_URL}blank-political.webp`,
    fallbackUrl: `${import.meta.env.BASE_URL}blank-political.png?v=2`,
    // 2048px variant for low-memory devices (see scripts/make-mobile-images.mjs).
    // fullW/fullH keep the app in full-res pixel coordinates — Leaflet
    // stretches the small image across the full bounds.
    mobileUrl: `${import.meta.env.BASE_URL}blank-political-mobile.webp`,
    chip: "bg-gradient-to-br from-sky-300 via-sky-600 to-cyan-800",
  },
  {
    id: "satellite",
    label: "Satellite",
    sub: "Real-world imagery",
    url: `${import.meta.env.BASE_URL}satellite.webp`,
    fallbackUrl: `${import.meta.env.BASE_URL}satellite.jpg?v=2`,
    chip: "bg-gradient-to-br from-sky-800 via-teal-700 to-emerald-900",
  },
  {
    id: "topo",
    label: "Topographic",
    sub: "Elevation & relief",
    stale: true,
    overlay: true,
    url: `${MAP_BASE}/topo.png`,
    fallbackUrl: `${MAP_BASE_RAW}/topo.png`,
    chip: "bg-gradient-to-br from-emerald-200 via-lime-400 to-amber-700",
  },
  {
    id: "climate",
    label: "Climate",
    sub: "Climate zones",
    stale: true,
    overlay: true,
    url: `${MAP_BASE}/climate.png`,
    fallbackUrl: `${MAP_BASE_RAW}/climate.png`,
    chip: "bg-gradient-to-br from-yellow-200 via-orange-400 to-rose-600",
  },
  {
    id: "currents",
    label: "Ocean Currents",
    sub: "Surface circulation",
    stale: true,
    overlay: true,
    url: `${MAP_BASE}/currents.png`,
    fallbackUrl: `${MAP_BASE_RAW}/currents.png`,
    chip: "bg-gradient-to-br from-blue-400 via-cyan-300 to-indigo-500",
  },
  {
    id: "hydro",
    label: "Hydrology",
    sub: "Rivers & basins",
    overlay: true,
    url: `${MAP_BASE}/hydro.png`,
    fallbackUrl: `${MAP_BASE_RAW}/hydro.png`,
    chip: "bg-gradient-to-br from-sky-400 to-blue-600",
  },
  {
    id: "timezones",
    label: "Time Zones",
    sub: "Time zone boundaries",
    overlay: true,
    // Local crop of the upstream export, re-windowed to the base 11232x7525
    // grid (dateline overlap trimmed, coastline-verified to ~4px). The raw
    // upstream file is 11860px wide and would misalign pins/measurements.
    url: `${import.meta.env.BASE_URL}timezones.webp`,
    fallbackUrl: `${import.meta.env.BASE_URL}timezones.png`,
    mobileUrl: `${import.meta.env.BASE_URL}timezones-mobile.webp`,
    chip: "bg-gradient-to-br from-violet-400 via-purple-500 to-indigo-700",
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

// Full-resolution pixel dimensions shared by all base layers. Mobile
// variants are stretched across these bounds so coordinates, pins, wrap,
// and KM_PER_PX math stay identical on both tiers.
export const FULL_W = 11232;
export const FULL_H = 7525;

// Resolve a layer to displayable URLs for this device. On low-memory
// devices, layers with a mobile variant serve the downscaled image
// (~2.8MP decode instead of ~338MB); layers without one (remote full-res
// overlays, satellite) resolve to null and must be hidden by callers.
export function resolveLayer(id) {
  const def = getLayer(id);
  if (IS_LOW_MEM) {
    // Fallback stays on the mobile tier too — falling back to the full-res
    // file would reintroduce the 84MP decode that crashes phone browsers.
    if (def.mobileUrl) return { ...def, url: def.mobileUrl, fallbackUrl: def.mobileUrl, mobile: true };
    return null;
  }
  return { ...def, mobile: false };
}

// Markers overlay (full-res PNG + downscaled mobile webp with alpha).
export const MARKERS_URL = `${import.meta.env.BASE_URL}cities-subnational-markers.png`;
export const MARKERS_MOBILE_URL = `${import.meta.env.BASE_URL}cities-subnational-markers-mobile.webp`;

// Base maps are mutually exclusive; data overlays stack on top of them.
export const BASE_MAPS = BASE_LAYERS.filter((l) => !l.overlay);
export const DATA_OVERLAYS = BASE_LAYERS.filter((l) => l.overlay);

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