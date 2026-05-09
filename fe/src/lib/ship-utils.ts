import { Ship } from './mock-data';

/**
 * Interpolates a ship's position between two timestamps using linear interpolation
 * Ensures physically plausible movement without position jumps
 */
export function interpolateShipPosition(
  ship: Ship,
  previousPosition: { lat: number; lng: number; timestamp: Date },
  currentPosition: { lat: number; lng: number; timestamp: Date },
  currentTime: Date
): { lat: number; lng: number } {
  const totalDuration = currentPosition.timestamp.getTime() - previousPosition.timestamp.getTime();
  const elapsedTime = currentTime.getTime() - previousPosition.timestamp.getTime();

  // Clamp elapsed time between 0 and total duration
  const progress = Math.min(Math.max(elapsedTime / totalDuration, 0), 1);

  return {
    lat: previousPosition.lat + (currentPosition.lat - previousPosition.lat) * progress,
    lng: previousPosition.lng + (currentPosition.lng - previousPosition.lng) * progress,
  };
}

/**
 * Calculates the distance between two lat/lng coordinates in kilometers
 * Uses the Haversine formula for accurate great-circle distances
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Checks if a ship is within a restricted zone defined by coordinates
 */
export function isShipInRestrictedZone(
  shipLat: number,
  shipLng: number,
  zoneBounds: [number, number][]
): boolean {
  // Simple bounding box check (can be enhanced with point-in-polygon algorithm)
  if (zoneBounds.length < 2) return false;

  const lats = zoneBounds.map((coord) => coord[0]);
  const lngs = zoneBounds.map((coord) => coord[1]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return shipLat >= minLat && shipLat <= maxLat && shipLng >= minLng && shipLng <= maxLng;
}

/**
 * Detects proximity warnings when two ships are within 2km of each other
 */
export function detectProximityWarnings(ships: Ship[]): Array<{ shipId1: string; shipId2: string; distance: number }> {
  const warnings: Array<{ shipId1: string; shipId2: string; distance: number }> = [];
  const PROXIMITY_THRESHOLD = 2; // 2 km

  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const ship1 = ships[i];
      const ship2 = ships[j];

      const distance = calculateDistance(ship1.lat, ship1.lng, ship2.lat, ship2.lng);

      if (distance < PROXIMITY_THRESHOLD) {
        warnings.push({
          shipId1: ship1.id,
          shipId2: ship2.id,
          distance,
        });
      }
    }
  }

  return warnings;
}

/**
 * Calculates bearing (heading) between two points
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

  const bearing = Math.atan2(y, x);
  return ((bearing * 180) / Math.PI + 360) % 360;
}

/**
 * Validates if a ship's new position is physically plausible based on max speed
 */
export function isPositionPlausible(
  previousPosition: { lat: number; lng: number; timestamp: Date },
  newPosition: { lat: number; lng: number; timestamp: Date },
  maxSpeedKnots: number
): boolean {
  const distance = calculateDistance(
    previousPosition.lat,
    previousPosition.lng,
    newPosition.lat,
    newPosition.lng
  );

  const timeDiffHours =
    (newPosition.timestamp.getTime() - previousPosition.timestamp.getTime()) / (1000 * 60 * 60);
  const maxDistanceKm = (maxSpeedKnots * 1.852 * timeDiffHours) * 1.5; // 1.5x buffer for turns

  return distance <= maxDistanceKm;
}
