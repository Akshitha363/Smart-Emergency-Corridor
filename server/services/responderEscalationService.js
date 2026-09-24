import prisma from '../config/prisma.js';
import {
  notifyTrafficPolice,
  notifyServiceProvider,
  notifyAdmin,
  getSocketIOInstance,
} from './notificationService.js';
import { haversineDistance } from './hospitalMatcher.js';

let escalationInterval = null;

/**
 * Starts the server-side responder escalation and 30-second reminder scheduler loop
 */
export function startResponderEscalationScheduler() {
  if (escalationInterval) return;

  console.log('⏰ Starting 30-Second Responder Escalation & Reminder Scheduler...');

  // Run cycle every 5 seconds to evaluate 30-second intervals and active escalations
  escalationInterval = setInterval(async () => {
    try {
      await processResponderEscalationCycle();
    } catch (err) {
      console.error('Error in responder escalation cycle:', err);
    }
  }, 5000);
}

export function stopResponderEscalationScheduler() {
  if (escalationInterval) {
    clearInterval(escalationInterval);
    escalationInterval = null;
  }
}

/**
 * Executes a single processing pass over all active emergency trips
 */
export async function processResponderEscalationCycle() {
  const activeTrips = await prisma.emergencyTrip.findMany({
    where: {
      status: {
        in: ['INITIATED', 'MATCHED', 'HOSPITAL_ALERTED', 'HOSPITAL_ACCEPTED', 'EN_ROUTE', 'REROUTED'],
      },
    },
    include: {
      ambulance: true,
      patient: true,
      hospital: true,
      responderAlerts: {
        include: { responder: true },
      },
    },
  });

  if (activeTrips.length === 0) return;

  // Load system config
  let config = await prisma.systemConfig.findUnique({ where: { id: 'default' } });
  if (!config) {
    config = {
      initialRadiusKm: 1.0,
      radiusStepKm: 1.0,
      maxRadiusKm: 5.0,
      reminderIntervalSec: 30,
      escalationTimeoutSec: 30,
    };
  }

  const now = new Date();

  for (const trip of activeTrips) {
    await processTripEscalation(trip, config, now);
  }
}

async function processTripEscalation(trip, config, now) {
  const io = getSocketIOInstance();
  const ambPos = [trip.ambulance.currentLat, trip.ambulance.currentLng];

  // Group responder alerts by role category
  const trafficAlerts = trip.responderAlerts.filter(a => a.responder.type === 'TRAFFIC_POLICE');
  const providerAlerts = trip.responderAlerts.filter(
    a => a.responder.type === 'SERVICE_PROVIDER' || a.responder.type === 'FIRST_RESPONDER' || a.responder.type === 'COMMUNITY'
  );

  // Helper function to check if lead has been taken for role
  const hasAccepted = (alerts) => alerts.some(a => a.actionStatus === 'TAKEN_LEAD' || a.actionStatus === 'CLEARED' || a.status === 'ACCEPTED');

  const trafficAssigned = hasAccepted(trafficAlerts);
  const providerAssigned = hasAccepted(providerAlerts);

  const roleCategoriesToEvaluate = [];
  if (!trafficAssigned) roleCategoriesToEvaluate.push({ roleKey: 'TRAFFIC_POLICE', filterTypes: ['TRAFFIC_POLICE'] });
  if (!providerAssigned) roleCategoriesToEvaluate.push({ roleKey: 'SERVICE_PROVIDER', filterTypes: ['SERVICE_PROVIDER', 'FIRST_RESPONDER', 'COMMUNITY'] });

  for (const roleGroup of roleCategoriesToEvaluate) {
    const existingAlertsForRole = trip.responderAlerts.filter(a => roleGroup.filterTypes.includes(a.responder.type));

    if (existingAlertsForRole.length === 0) {
      // Dispatch initial 0-1 KM search alert
      await expandAndAlertResponders(trip, roleGroup, config.initialRadiusKm, 1, ambPos);
      continue;
    }

    // Check if 30-second reminder or radius escalation is due
    const newestAlert = existingAlertsForRole.reduce((latest, current) => {
      return new Date(current.lastNotifiedAt || current.timestamp) > new Date(latest.lastNotifiedAt || latest.timestamp)
        ? current
        : latest;
    }, existingAlertsForRole[0]);

    const lastTime = new Date(newestAlert.lastNotifiedAt || newestAlert.timestamp).getTime();
    const elapsedSec = (now.getTime() - lastTime) / 1000;

    if (elapsedSec >= config.reminderIntervalSec) {
      // 30 seconds have passed! Send reminder or expand radius
      const currentRadius = trip.currentCorridorRangeKm || config.initialRadiusKm;

      if (elapsedSec >= config.escalationTimeoutSec && currentRadius < config.maxRadiusKm) {
        // Expand search radius
        const newRadius = Math.min(config.maxRadiusKm, currentRadius + config.radiusStepKm);

        await prisma.emergencyTrip.update({
          where: { id: trip.id },
          data: { currentCorridorRangeKm: newRadius },
        });

        const expandedRespondersCount = await expandAndAlertResponders(trip, roleGroup, newRadius, newestAlert.reminderCount + 1, ambPos);

        // Notify role and admin about radius expansion
        const title = `🚨 EMERGENCY CORRIDOR ESCALATED (${newRadius} KM)`;
        const message = `No responder accepted within ${currentRadius} KM. Search radius expanded to ${newRadius} KM for Ambulance ${trip.ambulance.callSign}.`;

        if (roleGroup.roleKey === 'TRAFFIC_POLICE') {
          await notifyTrafficPolice(trip.id, title, message, 'CRITICAL', {
            eventType: 'RESPONDER_RADIUS_EXPANDED',
            currentRadius: newRadius,
            ambulanceCallSign: trip.ambulance.callSign,
          });
        } else {
          await notifyServiceProvider(trip.id, title, message, 'CRITICAL', {
            eventType: 'RESPONDER_RADIUS_EXPANDED',
            currentRadius: newRadius,
            ambulanceCallSign: trip.ambulance.callSign,
          });
        }

        await notifyAdmin(`Corridor Escalated to ${newRadius} KM`, message, 'WARNING', { tripId: trip.id });

        if (io) {
          io.to(`trip:${trip.id}`).emit('corridor_escalated', {
            tripId: trip.id,
            currentRadius: newRadius,
            roleKey: roleGroup.roleKey,
            expandedRespondersCount,
          });
        }
      } else {
        // Send 30-second reminder to existing alerted responders
        for (const alertRecord of existingAlertsForRole) {
          if (alertRecord.actionStatus === 'TAKEN_LEAD' || alertRecord.actionStatus === 'CLEARED' || alertRecord.status === 'REJECTED') {
            continue;
          }

          const reminderCount = alertRecord.reminderCount + 1;
          await prisma.responderAlert.update({
            where: { id: alertRecord.id },
            data: {
              reminderCount,
              lastNotifiedAt: now,
            },
          });

          const title = `🔔 30-SECOND RESPONDER REMINDER (${reminderCount})`;
          const message = `Emergency ambulance ${trip.ambulance.callSign} requires corridor clearance. Distance: ${haversineDistance(ambPos[0], ambPos[1], alertRecord.responder.lat, alertRecord.responder.lng).toFixed(2)} KM.`;

          if (roleGroup.roleKey === 'TRAFFIC_POLICE') {
            await notifyTrafficPolice(trip.id, title, message, 'HIGH', {
              eventType: 'RESPONDER_REMINDER',
              alertId: alertRecord.id,
              reminderCount,
              responderId: alertRecord.responderId,
            });
          } else {
            await notifyServiceProvider(trip.id, title, message, 'HIGH', {
              eventType: 'RESPONDER_REMINDER',
              alertId: alertRecord.id,
              reminderCount,
              responderId: alertRecord.responderId,
            });
          }
        }
      }
    }
  }
}

async function expandAndAlertResponders(trip, roleGroup, searchRadiusKm, reminderCount, ambPos) {
  const eligibleResponders = await prisma.responder.findMany({
    where: {
      type: { in: roleGroup.filterTypes },
      status: { in: ['AVAILABLE', 'ALERTED'] },
    },
  });

  let newlyNotifiedCount = 0;

  for (const responder of eligibleResponders) {
    const distKm = haversineDistance(ambPos[0], ambPos[1], responder.lat, responder.lng);
    if (distKm <= searchRadiusKm) {
      // Upsert alert
      const existingAlert = await prisma.responderAlert.findUnique({
        where: {
          tripId_responderId: {
            tripId: trip.id,
            responderId: responder.id,
          },
        },
      });

      if (!existingAlert) {
        const rangeZone = `${Math.floor(distKm)}_${Math.ceil(distKm)}_KM`;
        await prisma.responderAlert.create({
          data: {
            tripId: trip.id,
            responderId: responder.id,
            responderType: responder.type,
            rangeZone,
            currentRadius: searchRadiusKm,
            reminderCount,
            status: 'SENT',
            actionStatus: 'NOTIFIED',
            notifiedAt: new Date(),
            lastNotifiedAt: new Date(),
          },
        });

        await prisma.responder.update({
          where: { id: responder.id },
          data: { status: 'ALERTED' },
        });

        newlyNotifiedCount++;

        const title = `🚨 EMERGENCY AMBULANCE APPROACHING (${distKm.toFixed(2)} KM)`;
        const message = `Ambulance ${trip.ambulance.callSign} en route. Condition: ${trip.patient ? trip.patient.condition : 'Emergency'}. Immediate clearance required.`;

        if (roleGroup.roleKey === 'TRAFFIC_POLICE') {
          await notifyTrafficPolice(trip.id, title, message, 'CRITICAL', {
            eventType: 'RESPONDER_ALERT',
            responderId: responder.id,
            distKm: parseFloat(distKm.toFixed(2)),
          });
        } else {
          await notifyServiceProvider(trip.id, title, message, 'CRITICAL', {
            eventType: 'RESPONDER_ALERT',
            responderId: responder.id,
            distKm: parseFloat(distKm.toFixed(2)),
          });
        }
      }
    }
  }

  return newlyNotifiedCount;
}
