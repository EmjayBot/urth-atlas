// Tiled base + overlays are the default (faster loads, no giant decodes);
// ?tiles=0 opts back out to the legacy stretched overlays. Bare ?tiles=1
// links from the prototype era keep working. Shared by MapView (renderer)
// and App (layer defaults: tiled overlays are cheap enough for phones).
export const TILES_ON =
  typeof window === "undefined" ||
  new URLSearchParams(window.location.search).get("tiles") !== "0";
