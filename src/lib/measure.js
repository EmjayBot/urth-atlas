import {
  KM2_PER_PX2,
  KM_PER_PX,
  MI_PER_KM,
  NM_PER_KM,
  MI2_PER_KM2,
  ACRES_PER_KM2,
} from "./scale";
import { latFromPixel } from "./geo";

// Urth is flat (drawn without a sphere in mind), so the primary measurement
// is uniform Euclidean: km = pix × KM_PER_PX at every latitude.
//
// The cos(φ) figures alongside are the "if Urth were a sphere like Earth"
// hypothetical: on an equirectangular-mapped sphere (see lib/geo.js) pixels
// are evenly spaced in degrees, but a degree of longitude shrinks toward the
// poles as cos(lat) while a degree of latitude does not. East-west pixel
// deltas would then overstate ground distance off-equator and must be scaled
// by cos(lat) before applying KM_PER_PX. Kept for roleplay curiosity —
// not ground truth.
//
// Refinement: instead of a single cos(avgLat) snapshot per segment, integrate
// along the segment. For short segments this is numerically identical to the
// old formula; for long segments (large latitude span) it tracks the true
// line integral ∫√((k·cosφ(y)·dx′)² + (k·dy′)²) instead of freezing φ.
const STEP_PX = 25;
const MAX_STEPS = 256;

function cosDeg(latDeg) {
  return Math.cos((latDeg * Math.PI) / 180);
}

// Corrected length of one straight pixel-space leg under the spherical
// hypothesis (see header): from latitude latA to latB (degrees),
// subdividing so each substep spans <= STEP_PX.
function legCorrKm(dx, dy, latA, latB) {
  const pix = Math.hypot(dx, dy);
  if (pix === 0) return 0;
  const steps = Math.min(MAX_STEPS, Math.max(1, Math.ceil(pix / STEP_PX)));
  let total = 0;
  for (let i = 0; i < steps; i++) {
    const latMid = latA + ((latB - latA) * (i + 0.5)) / steps;
    total += Math.hypot(dx * cosDeg(latMid), dy);
  }
  return (total / steps) * KM_PER_PX;
}

// Straight-line distance between two points.
export function measureDistance(a, b, H) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const pix = Math.hypot(dx, dy);
  const km = pix * KM_PER_PX;
  const latA = latFromPixel(a.y, H);
  const latB = latFromPixel(b.y, H);
  const avgLat = (latA + latB) / 2;
  const cosAvg = cosDeg(avgLat);
  const kmCorr = legCorrKm(dx, dy, latA, latB);
  return {
    dx,
    dy,
    pix,
    km,
    kmCorr,
    mi: km * MI_PER_KM,
    miCorr: kmCorr * MI_PER_KM,
    nm: km * NM_PER_KM,
    nmCorr: kmCorr * NM_PER_KM,
    latA,
    latB,
    avgLat,
    cosAvg,
  };
}

// Summed distance along a multi-point path.
export function measurePath(points, H) {
  let totalPix = 0;
  let totalKm = 0;
  let totalKmCorr = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const seg = Math.hypot(dx, dy);
    totalPix += seg;
    totalKm += seg * KM_PER_PX;
    totalKmCorr += legCorrKm(
      dx,
      dy,
      latFromPixel(a.y, H),
      latFromPixel(b.y, H)
    );
  }
  return {
    totalPix,
    totalKm,
    totalKmCorr,
    totalMi: totalKm * MI_PER_KM,
    totalMiCorr: totalKmCorr * MI_PER_KM,
    totalNm: totalKm * NM_PER_KM,
    totalNmCorr: totalKmCorr * NM_PER_KM,
  };
}

// Shoelace polygon area.
export function measureArea(points, H) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    sum += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  const areaPx = Math.abs(sum) / 2;
  const areaKm2 = areaPx * KM2_PER_PX2;
  const avgLat = latFromPixel(
    points.reduce((s, p) => s + p.y, 0) / points.length,
    H
  );
  // Mean cos(φ) sampled at vertices + edge midpoints approximates the
  // interior mean better than a single centroid snapshot when the polygon
  // spans a large latitude range. Identical for small polygons.
  // (Spherical hypothesis only — the flat primary is areaKm2 et al.)
  let cosSum = 0;
  let cosN = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    cosSum += cosDeg(latFromPixel(points[i].y, H));
    cosSum += cosDeg(
      latFromPixel((points[i].y + points[j].y) / 2, H)
    );
    cosN += 2;
  }
  const cosAvg = cosN > 0 ? cosSum / cosN : cosDeg(avgLat);
  const areaKm2Corr = areaKm2 * cosAvg;
  return {
    areaPx,
    areaKm2,
    areaKm2Corr,
    areaMi2: areaKm2 * MI2_PER_KM2,
    areaMi2Corr: areaKm2Corr * MI2_PER_KM2,
    acres: areaKm2 * ACRES_PER_KM2,
    acresCorr: areaKm2Corr * ACRES_PER_KM2,
    avgLat,
    cosAvg,
  };
}