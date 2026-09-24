import prisma from '../config/prisma.js';
import { getAheadRouteDistance } from './corridorEngine.js';
import { haversineDistance } from './hospitalMatcher.js';

/**
 * Ascending distance route-aware responder search algorithm
 * @param {Object} trip The active emergency trip object
 * @param {[number, number]} ambulancePos Current [lat, lng] of ambulance
 * @param {Array<[number, number]>} routePolyline Parsed route polyline
 * @returns {Object} Search result including range checked, responder match, and alert status
 */
export async function findAvailableResponders(trip, ambulancePos, routePolyline) {
  // 1. Fetch existing alerts for this trip with responder details
  const existingAlerts = await prisma.responderAlert.findMany({
    where: { tripId: trip.id },
    include: { responder: true },
  });

  const alertsByRole = {};
  const activeAlerts = [];

  // Group existing alerts by role category
  for (const alertRecord of existingAlerts) {
    const roleKey = alertRecord.responder.type === 'TRAFFIC_POLICE' ? 'TRAFFIC_POLICE' : 'SERVICE_PROVIDER';
    if (!alertsByRole[roleKey] || alertRecord.status === 'ACCEPTED') {
      alertsByRole[roleKey] = {
        alertId: alertRecord.id,
        responder: alertRecord.responder,
        rangeZone: alertRecord.rangeZone,
        status: alertRecord.status,
      };
    }
    activeAlerts.push(alertRecord);
  }

  // Define role categories to search
  const ROLE_CATEGORIES = [
    { key: 'TRAFFIC_POLICE', filterTypes: ['TRAFFIC_POLICE'] },
    { key: 'SERVICE_PROVIDER', filterTypes: ['SERVICE_PROVIDER', 'FIRST_RESPONDER', 'COMMUNITY'] },
  ];

  const SEARCH_RANGES = [
    { name: '0_1_KM', minKm: 0.0, maxKm: 1.0, label: '0–1 KM Ahead' },
    { name: '1_2_KM', minKm: 1.0, maxKm: 2.0, label: '1–2 KM Ahead' },
    { name: '2_3_KM', minKm: 2.0, maxKm: 3.0, label: '2–3 KM Ahead' },
    { name: '3_5_KM', minKm: 3.0, maxKm: 5.0, label: '3–5 KM Ahead' },
  ];

  // Search for available candidate in each role category if not already present
  for (const roleCat of ROLE_CATEGORIES) {
    if (alertsByRole[roleCat.key]) continue; // Already have an alert for this role category

    const availableResponders = await prisma.responder.findMany({
      where: {
        type: { in: roleCat.filterTypes },
        status: { in: ['AVAILABLE', 'ALERTED'] },
      },
    });

    if (availableResponders.length === 0) continue;

    let candidateFound = null;
    let activeRangeZone = null;

    for (const range of SEARCH_RANGES) {
      const rangeCandidates = [];

      for (const responder of availableResponders) {
        let routeEval = null;

        if (routePolyline && routePolyline.length >= 2) {
          routeEval = getAheadRouteDistance(routePolyline, ambulancePos, responder.lat, responder.lng);
        } else {
          const d = haversineDistance(ambulancePos[0], ambulancePos[1], responder.lat, responder.lng);
          routeEval = {
            isAhead: true,
            distAlongRouteKm: d,
            perpDistKm: 0,
            totalEffectiveDistanceKm: d,
          };
        }

        if (
          routeEval.isAhead &&
          routeEval.distAlongRouteKm >= range.minKm &&
          routeEval.distAlongRouteKm <= range.maxKm
        ) {
          let priorityWeight = 100;
          if (responder.type === 'TRAFFIC_POLICE') priorityWeight += 50;
          else if (responder.type === 'FIRST_RESPONDER') priorityWeight += 30;
          else priorityWeight += 10;

          priorityWeight -= routeEval.distAlongRouteKm * 10;
          priorityWeight -= routeEval.perpDistKm * 20;

          rangeCandidates.push({
            responder,
            distKm: parseFloat(routeEval.distAlongRouteKm.toFixed(2)),
            perpDistKm: parseFloat(routeEval.perpDistKm.toFixed(2)),
            priorityWeight,
          });
        }
      }

      if (rangeCandidates.length > 0) {
        rangeCandidates.sort((a, b) => b.priorityWeight - a.priorityWeight);
        candidateFound = rangeCandidates[0];
        activeRangeZone = range;
        break;
      }
    }

    if (candidateFound) {
      const { responder, distKm } = candidateFound;
      let alertRecord = await prisma.responderAlert.findUnique({
        where: {
          tripId_responderId: {
            tripId: trip.id,
            responderId: responder.id,
          },
        },
      });

      if (!alertRecord) {
        alertRecord = await prisma.responderAlert.create({
          data: {
            tripId: trip.id,
            responderId: responder.id,
            responderType: responder.type,
            rangeZone: activeRangeZone.name,
            status: 'SENT',
            actionStatus: 'NOTIFIED',
            notifiedAt: new Date(),
          },
        });

        await prisma.responder.update({
          where: { id: responder.id },
          data: { status: 'ALERTED' },
        });
      }

      alertsByRole[roleCat.key] = {
        alertId: alertRecord.id,
        responder: {
          id: responder.id,
          name: responder.name,
          badgeNumber: responder.badgeNumber,
          type: responder.type,
          lat: responder.lat,
          lng: responder.lng,
          distKm,
          contact: responder.contact,
        },
        rangeZone: activeRangeZone.name,
        rangeLabel: activeRangeZone.label,
        status: alertRecord.status,
        actionStatus: alertRecord.actionStatus,
      };
      activeAlerts.push(alertRecord);
    }
  }

  const primaryRoleKey = alertsByRole.TRAFFIC_POLICE ? 'TRAFFIC_POLICE' : (alertsByRole.SERVICE_PROVIDER ? 'SERVICE_PROVIDER' : null);
  const primaryAlert = primaryRoleKey ? alertsByRole[primaryRoleKey] : null;

  if (!primaryAlert) {
    return {
      status: 'EXPANDING_SEARCH',
      maxRangeChecked: '5.0 KM',
      message: 'Searching expanding distance ranges ahead along corridor...',
      found: false,
      alertsByRole,
    };
  }

  return {
    status: 'ALERT_DISPATCHED',
    found: true,
    alertId: primaryAlert.alertId,
    responder: primaryAlert.responder,
    rangeZone: primaryAlert.rangeZone,
    alertsByRole,
    alerts: activeAlerts,
    message: `Alerts active for corridor responders.`,
  };
}
