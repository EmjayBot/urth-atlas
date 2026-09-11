export const MAP_URL = "https://urthmaps.com/maps/export/urth.png";
export const WIKI_URL = "https://tep.wiki";

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