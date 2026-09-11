import {
  KM2_PER_PX2,
  KM_PER_PX,
  MI_PER_KM,
  NM_PER_KM,
  MI2_PER_KM2,
  ACRES_PER_KM2,
} from "./scale";
import { latFromPixel } from "./geo";

// Straight-line distance between two points.
export function measureDistance(a, b, H) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const pix = Math.hypot(dx, dy);
  const km = pix * KM_PER_PX;
  const latA = latFromPixel(a.y, H);
  const latB = latFromPixel(b.y, H);
  const avgLat = (latA + latB) / 2;
  const cosAvg = Math.cos((avgLat * Math.PI) / 180);
  const kmCorr = Math.hypot(dx * KM_PER_PX * cosAvg, dy * KM_PER_PX);
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
    const avgLat = (latFromPixel(a.y, H) + latFromPixel(b.y, H)) / 2;
    const cos = Math.cos((avgLat * Math.PI) / 180);
    totalKmCorr += Math.hypot(dx * KM_PER_PX * cos, dy * KM_PER_PX);
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
  const cosAvg = Math.cos((avgLat * Math.PI) / 180);
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