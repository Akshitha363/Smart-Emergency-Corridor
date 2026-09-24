import { haversineDistance } from './hospitalMatcher.js';

/**
 * Calculates vector projections and distance along a route polyline
 * @param {Array<[number, number]>} routePolyline Array of [lat, lng] coordinates
 * @param {[number, number]} currentPos Current ambulance [lat, lng]
 * @returns {Object} Route progress, direction vector, and cumulative distances
 */
export function getRouteProgress(routePolyline, currentPos) {
  if (!routePolyline || routePolyline.length < 2) {
    return {
      closestIndex: 0,
      distanceFromRoute: 0,
      directionVector: { dLat: 0, dLng: 0 },
      routeDistancesKm: [0],
    };
  }

  // Calculate cumulative distances along polyline
  const routeDistancesKm = [0];
  for (let i = 1; i < routePolyline.length; i++) {
    const prev = routePolyline[i - 1];
    const curr = routePolyline[i];
    const segmentDist = haversineDistance(prev[0], prev[1], curr[0], curr[1]);
    routeDistancesKm.push(routeDistancesKm[i - 1] + segmentDist);
  }

  // Find closest segment to current ambulance position
  let minDistance = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < routePolyline.length; i++) {
    const dist = haversineDistance(currentPos[0], currentPos[1], routePolyline[i][0], routePolyline[i][1]);
    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }

  // Direction vector (heading) along route
  const nextIdx = Math.min(routePolyline.length - 1, closestIndex + 1);
  const prevIdx = Math.max(0, closestIndex - 1);

  const dLat = routePolyline[nextIdx][0] - routePolyline[prevIdx][0];
  const dLng = routePolyline[nextIdx][1] - routePolyline[prevIdx][1];

  return {
    closestIndex,
    distanceFromRoute: minDistance,
    directionVector: { dLat, dLng },
    routeDistancesKm,
    currentProgressKm: routeDistancesKm[closestIndex],
    totalRouteKm: routeDistancesKm[routeDistancesKm.length - 1],
  };
}

/**
 * Creates a route-aware search corridor polygon ahead of the ambulance
 * @param {Array<[number, number]>} routePolyline
 * @param {[number, number]} currentPos
 * @param {number} startKmDistance Distance ahead to start (e.g. 0km)
 * @param {number} endKmDistance Distance ahead to end (e.g. 1km, 2km)
 * @param {number} widthMeters Corridor width (e.g. 200m buffer)
 */
export function buildAheadCorridor(routePolyline, currentPos, startKmDistance, endKmDistance, widthMeters = 250) {
  const { closestIndex, routeDistancesKm, currentProgressKm } = getRouteProgress(routePolyline, currentPos);

  const minRangeKm = currentProgressKm + startKmDistance;
  const maxRangeKm = currentProgressKm + endKmDistance;

  // Extract polyline points falling within [minRangeKm, maxRangeKm]
  const corridorPoints = [];
  for (let i = closestIndex; i < routePolyline.length; i++) {
    const distFromStart = routeDistancesKm[i];
    if (distFromStart >= minRangeKm - 0.1 && distFromStart <= maxRangeKm + 0.1) {
      corridorPoints.push(routePolyline[i]);
    }
  }

  if (corridorPoints.length === 0) {
    corridorPoints.push(currentPos);
  }

  return {
    startKm: startKmDistance,
    endKm: endKmDistance,
    corridorPoints,
    centerLat: corridorPoints[0][0],
    centerLng: corridorPoints[0][1],
  };
}

/**
 * Checks if a point (lat, lng) lies ahead of the ambulance along the route polyline
 * Returns distance along route ahead in KM, or -1 if behind or off-route
 */
export function getAheadRouteDistance(routePolyline, currentPos, targetLat, targetLng) {
  const progress = getRouteProgress(routePolyline, currentPos);
  const ambulanceKm = progress.currentProgressKm;

  // Find target position's closest point on route
  let targetMinDist = Infinity;
  let targetClosestIdx = 0;

  for (let i = 0; i < routePolyline.length; i++) {
    const d = haversineDistance(targetLat, targetLng, routePolyline[i][0], routePolyline[i][1]);
    if (d < targetMinDist) {
      targetMinDist = d;
      targetClosestIdx = i;
    }
  }

  // If target is too far off-route (> 800 meters), return null
  if (targetMinDist > 0.8) {
    return { isAhead: false, distAlongRouteKm: Infinity, perpDistKm: targetMinDist };
  }

  const targetKm = progress.routeDistancesKm[targetClosestIdx];
  const deltaKm = targetKm - ambulanceKm;

  return {
    isAhead: deltaKm >= -0.2, // allow small margin
    distAlongRouteKm: deltaKm,
    perpDistKm: targetMinDist,
    totalEffectiveDistanceKm: deltaKm >= 0 ? deltaKm + targetMinDist * 0.5 : Infinity,
  };
}
