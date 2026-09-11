// Coordinate helpers for the atlas' equirectangular-style mapping.
// Leaflet CRS.Simple uses [lat = image row (down positive), lng = image col].
// The atlas defines latitude as:  lat = 90 - (row / H) * 180   (top = +90, bottom = -90).

export function latFromPixel(y, H) {
  return 90 - (y / H) * 180;
}

export function pixelFromLat(lat, H) {
  return ((90 - lat) / 180) * H;
}

export function wrapX(x, W) {
  return ((x % W) + W) % W;
}

export function latLngToPixel(lat, lng, H) {
  return { x: wrapX(lng, 2 * H), y: pixelFromLat(lat, H) };
}

export function pixelToLatLng(x, y, H) {
  return { lat: latFromPixel(y, H), lng: x };
}

// Distance in km/mi for a pixel distance at an average latitude (cos correction).
export function correctedKm(dxPx, dyPx, avgLatDeg) {
  const cos = Math.cos((avgLatDeg * Math.PI) / 180);
  return Math.hypot(dxPx * cos, dyPx);
}