import type { Position } from "../types/index.js";

const EARTH_RADIUS_KM = 6371;
const NM_TO_KM = 1.852;
const KM_TO_NM = 1 / NM_TO_KM;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** Haversine distance between two positions in km */
export function distanceKm(a: Position, b: Position): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLng = (b.lng - a.lng) * DEG_TO_RAD;
  const sinDlat = Math.sin(dLat / 2);
  const sinDlng = Math.sin(dLng / 2);
  const h =
    sinDlat * sinDlat +
    Math.cos(a.lat * DEG_TO_RAD) *
      Math.cos(b.lat * DEG_TO_RAD) *
      sinDlng *
      sinDlng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Distance in nautical miles */
export function distanceNm(a: Position, b: Position): number {
  return distanceKm(a, b) * KM_TO_NM;
}

/** True bearing from a to b in degrees (0–360) */
export function bearingDeg(a: Position, b: Position): number {
  const lat1 = a.lat * DEG_TO_RAD;
  const lat2 = b.lat * DEG_TO_RAD;
  const dLng = (b.lng - a.lng) * DEG_TO_RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * RAD_TO_DEG + 360) % 360;
}

/**
 * Move a position by a given distance (km) along a bearing (degrees).
 * Returns the new position.
 */
export function movePosition(
  pos: Position,
  distanceKm: number,
  bearingDegrees: number,
): Position {
  const d = distanceKm / EARTH_RADIUS_KM;
  const b = bearingDegrees * DEG_TO_RAD;
  const lat1 = pos.lat * DEG_TO_RAD;
  const lng1 = pos.lng * DEG_TO_RAD;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    lat: lat2 * RAD_TO_DEG,
    lng: ((lng2 * RAD_TO_DEG + 540) % 360) - 180,
  };
}

/**
 * Point-in-polygon test using ray casting.
 * polygon must be a closed array of positions.
 */
export function pointInPolygon(point: Position, polygon: Position[]): boolean {
  const { lat: px, lng: py } = point;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i]!.lat,
      yi = polygon[i]!.lng;
    const xj = polygon[j]!.lat,
      yj = polygon[j]!.lng;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Does segment (a1→a2) intersect segment (b1→b2)?
 * Used for path vs zone intersection checks.
 */
export function segmentsIntersect(
  a1: Position,
  a2: Position,
  b1: Position,
  b2: Position,
): boolean {
  const cross = (o: Position, u: Position, v: Position) =>
    (u.lat - o.lat) * (v.lng - o.lng) - (u.lng - o.lng) * (v.lat - o.lat);
  const d1 = cross(b1, b2, a1);
  const d2 = cross(b1, b2, a2);
  const d3 = cross(a1, a2, b1);
  const d4 = cross(a1, a2, b2);
  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }
  return false;
}

/** Does a path (array of positions) intersect a polygon? */
export function pathIntersectsPolygon(
  path: Position[],
  polygon: Position[],
): boolean {
  // Check if any path point is inside the polygon
  for (const pt of path) {
    if (pointInPolygon(pt, polygon)) return true;
  }
  // Check if any path segment intersects any polygon edge
  for (let i = 0; i < path.length - 1; i++) {
    for (let j = 0; j < polygon.length - 1; j++) {
      if (
        segmentsIntersect(path[i]!, path[i + 1]!, polygon[j]!, polygon[j + 1]!)
      ) {
        return true;
      }
    }
  }
  return false;
}

/** Convert knots × seconds to km */
export function knotsSecondsToKm(knots: number, seconds: number): number {
  return (knots * NM_TO_KM * seconds) / 3600;
}

/** Interpolate between two positions by fraction t ∈ [0,1] */
export function interpolatePosition(
  a: Position,
  b: Position,
  t: number,
): Position {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

/** Clamp a value between min and max */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
