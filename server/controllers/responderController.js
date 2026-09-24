import prisma from '../config/prisma.js';
import { findAvailableResponders } from '../services/responderSearch.js';
import { notifyWayCleared, getSocketIOInstance } from '../services/notificationService.js';

export async function getResponders(req, res) {
  try {
    const responders = await prisma.responder.findMany({
      include: {
        alerts: {
          orderBy: { timestamp: 'desc' },
          take: 5,
        },
      },
    });
    return res.json({ responders });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Clean API for Responder Actions: POST /api/responders/action
 */
export async function respondToAction(req, res) {
  try {
    const { tripId, responderId, responderType = 'TRAFFIC_POLICE', action } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action parameter is required (TAKE_LEAD, RELEASE_LEAD, MARK_CLEARED, ACKNOWLEDGE, REJECT).' });
    }

    const isProviderGroup = responderType === 'SERVICE_PROVIDER' || responderType === 'FIRST_RESPONDER' || responderType === 'COMMUNITY';
    const typeCondition = isProviderGroup
      ? ['SERVICE_PROVIDER', 'FIRST_RESPONDER', 'COMMUNITY']
      : ['TRAFFIC_POLICE'];

    // 1. Validate active trip
    let targetTrip = null;
    if (tripId) {
      targetTrip = await prisma.emergencyTrip.findUnique({
        where: { id: tripId },
        include: { ambulance: true },
      });
    } else {
      targetTrip = await prisma.emergencyTrip.findFirst({
        where: {
          status: { in: ['INITIATED', 'MATCHED', 'HOSPITAL_ALERTED', 'HOSPITAL_ACCEPTED', 'EN_ROUTE', 'REROUTED'] },
        },
        orderBy: { createdAt: 'desc' },
        include: { ambulance: true },
      });
    }

    if (!targetTrip) {
      return res.status(400).json({ error: '❌ Emergency trip not found.' });
    }

    const ACTIVE_TRIP_STATUSES = ['INITIATED', 'MATCHED', 'HOSPITAL_ALERTED', 'HOSPITAL_ACCEPTED', 'EN_ROUTE', 'REROUTED'];
    if (!ACTIVE_TRIP_STATUSES.includes(targetTrip.status)) {
      return res.status(400).json({ error: `❌ Emergency trip is no longer active (Current status: ${targetTrip.status}).` });
    }

    // 2. Validate target responder and role type
    let targetResponder = null;
    if (responderId) {
      targetResponder = await prisma.responder.findUnique({
        where: { id: responderId },
      });
      if (targetResponder && !typeCondition.includes(targetResponder.type)) {
        return res.status(400).json({
          error: `❌ Responder role mismatch: Requested action for ${responderType}, but responder ${targetResponder.name} is ${targetResponder.type}.`,
        });
      }
    }

    if (!targetResponder) {
      targetResponder = await prisma.responder.findFirst({
        where: { type: { in: typeCondition } },
      });
    }

    if (!targetResponder) {
      return res.status(400).json({ error: `❌ No active ${responderType} responder available in system.` });
    }

    // 3. Find or create trip-specific ResponderAlert
    let alert = await prisma.responderAlert.findUnique({
      where: {
        tripId_responderId: {
          tripId: targetTrip.id,
          responderId: targetResponder.id,
        },
      },
      include: { responder: true, trip: true },
    });

    if (!alert) {
      alert = await prisma.responderAlert.findFirst({
        where: {
          tripId: targetTrip.id,
          responder: { type: { in: typeCondition } },
        },
        include: { responder: true, trip: true },
        orderBy: { timestamp: 'desc' },
      });
    }

    if (!alert) {
      alert = await prisma.responderAlert.create({
        data: {
          tripId: targetTrip.id,
          responderId: targetResponder.id,
          responderType: targetResponder.type,
          rangeZone: '0_1_KM',
          status: 'SENT',
          actionStatus: 'NOTIFIED',
          notifiedAt: new Date(),
        },
        include: { responder: true, trip: true },
      });
    }

    if (alert.actionStatus === 'CANCELLED' || alert.status === 'EXPIRED') {
      return res.status(400).json({ error: '❌ Alert is expired or cancelled.' });
    }

    // 4. Execute action status mutations
    let newAlertStatus = alert.status;
    let newActionStatus = alert.actionStatus;
    let newResponderStatus = alert.responder.status;
    let leadTakenAt = alert.leadTakenAt;
    let clearedAt = alert.clearedAt;
    let acknowledgedAt = alert.acknowledgedAt;

    if (action === 'TAKE_LEAD') {
      newAlertStatus = 'ACCEPTED';
      newActionStatus = 'TAKEN_LEAD';
      newResponderStatus = 'TAKEN_LEAD';
      leadTakenAt = new Date();
    } else if (action === 'RELEASE_LEAD') {
      newAlertStatus = 'SENT';
      newActionStatus = 'NOTIFIED';
      newResponderStatus = 'AVAILABLE';
    } else if (action === 'MARK_CLEARED') {
      newAlertStatus = 'ACCEPTED';
      newActionStatus = 'CLEARED';
      newResponderStatus = 'ON_SITE';
      clearedAt = new Date();
    } else if (action === 'ACKNOWLEDGE') {
      newAlertStatus = 'ACKNOWLEDGED';
      newActionStatus = 'ACKNOWLEDGED';
      acknowledgedAt = new Date();
    } else if (action === 'REJECT') {
      newAlertStatus = 'REJECTED';
      newActionStatus = 'CANCELLED';
      newResponderStatus = 'AVAILABLE';
    }

    // Update ResponderAlert
    const updatedAlert = await prisma.responderAlert.update({
      where: { id: alert.id },
      data: {
        status: newAlertStatus,
        actionStatus: newActionStatus,
        leadTakenAt,
        clearedAt,
        acknowledgedAt,
      },
      include: { responder: true, trip: true },
    });

    // Update Responder status
    await prisma.responder.update({
      where: { id: alert.responderId },
      data: { status: newResponderStatus },
    });

    // Log Emergency Event
    const respTitle = isProviderGroup ? 'Service Provider' : 'Traffic Police Officer';
    const logEventType = action === 'MARK_CLEARED' ? 'WAY_CLEARED' : `RESPONDER_${action}`;
    const logMsg = action === 'TAKE_LEAD'
      ? `⭐ ${respTitle} ${alert.responder.name} (${alert.responder.badgeNumber}) HAS TAKEN LEAD for emergency corridor!`
      : action === 'MARK_CLEARED'
      ? `🚨 WAY CLEARED: ${respTitle} ${alert.responder.name} marked intersection/corridor CLEARED!`
      : action === 'RELEASE_LEAD'
      ? `🔓 ${respTitle} ${alert.responder.name} released lead of emergency corridor.`
      : `${respTitle} ${alert.responder.name} responded to alert (${action}).`;

    await prisma.emergencyEvent.create({
      data: {
        tripId: alert.tripId,
        eventType: logEventType,
        message: logMsg,
      },
    });

    // Send WAY_CLEARED notification to Ambulance ONLY if way/corridor is cleared
    if (action === 'MARK_CLEARED' || action === 'TAKE_LEAD') {
      await notifyWayCleared(targetTrip, alert.responder.name, alert.responder.type, 'IKEA Flyover / Dynamic Junction');
    }

    const io = getSocketIOInstance();
    if (io) {
      const payload = {
        alertId: alert.id,
        tripId: alert.tripId,
        responderId: alert.responderId,
        responderName: alert.responder.name,
        responderType: alert.responder.type,
        action,
        status: newResponderStatus,
        actionStatus: newActionStatus,
        timestamp: new Date().toISOString(),
      };

      const roleRoom = isProviderGroup ? 'role:SERVICE_PROVIDER' : 'role:TRAFFIC';
      io.to(roleRoom).emit('responder_assigned', payload);
      io.to(`trip:${alert.tripId}`).emit('responder_assigned', payload);
    }

    return res.json({
      success: true,
      alert: updatedAlert,
      responder: alert.responder,
      actionStatus: newActionStatus,
      message: `Action ${action} recorded for ${alert.responder.name}`,
    });
  } catch (err) {
    console.error('Respond to action error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export async function getResponderAlerts(req, res) {
  try {
    const { tripId } = req.query;
    let whereClause = {};
    if (tripId) {
      whereClause.tripId = tripId;
    } else {
      const activeTrip = await prisma.emergencyTrip.findFirst({
        where: { status: { in: ['INITIATED', 'MATCHED', 'HOSPITAL_ALERTED', 'HOSPITAL_ACCEPTED', 'EN_ROUTE', 'REROUTED'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (activeTrip) whereClause.tripId = activeTrip.id;
    }

    const alerts = await prisma.responderAlert.findMany({
      where: whereClause,
      include: { responder: true, trip: true },
      orderBy: { timestamp: 'desc' },
    });

    return res.json({ alerts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getTripResponders(req, res) {
  try {
    const { tripId } = req.params;
    const alerts = await prisma.responderAlert.findMany({
      where: { tripId },
      include: { responder: true },
    });

    return res.json({ tripId, alerts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function searchRespondersForTrip(req, res) {
  try {
    const { tripId, ambulanceLat, ambulanceLng } = req.body;
    let trip = null;
    if (tripId) {
      trip = await prisma.emergencyTrip.findUnique({ where: { id: tripId }, include: { ambulance: true } });
    }
    if (!trip) {
      trip = await prisma.emergencyTrip.findFirst({
        where: { status: { in: ['INITIATED', 'MATCHED', 'HOSPITAL_ALERTED', 'HOSPITAL_ACCEPTED', 'EN_ROUTE', 'REROUTED'] } },
        orderBy: { createdAt: 'desc' },
        include: { ambulance: true },
      });
    }

    if (!trip) return res.status(404).json({ error: 'No active trip found for responder search' });

    const ambLat = ambulanceLat || trip.ambulance?.currentLat || trip.startLat;
    const ambLng = ambulanceLng || trip.ambulance?.currentLng || trip.startLng;

    let routePolyline = [];
    if (trip.routeGeometryJson) {
      try {
        routePolyline = JSON.parse(trip.routeGeometryJson);
      } catch (e) {}
    }

    const searchResult = await findAvailableResponders(trip, [ambLat, ambLng], routePolyline);
    return res.json({ tripId: trip.id, searchResult });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function respondToAlert(req, res) {
  req.body.alertId = req.params.alertId;
  return respondToAction(req, res);
}
