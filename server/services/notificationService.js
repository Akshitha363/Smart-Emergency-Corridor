import prisma from '../config/prisma.js';

let ioInstance = null;

export function setSocketIOInstance(io) {
  ioInstance = io;
}

export function getSocketIOInstance() {
  return ioInstance;
}

/**
 * Creates notification record in DB and broadcasts to specific Socket.IO rooms
 */
export async function createAndSendNotification({
  userId = null,
  role = null,
  type,
  title,
  message,
  recipient = null,
  tripId = null,
  priority = 'INFO',
  metadata = null,
  rooms = [],
}) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        role,
        type,
        title,
        message,
        recipient: recipient || role || (userId ? `user:${userId}` : 'SYSTEM'),
        tripId,
        priority,
        metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
      },
    });

    if (ioInstance) {
      const payload = {
        ...notification,
        metadata: notification.metadata ? JSON.parse(notification.metadata) : null,
      };

      const targetRooms = new Set(rooms);

      targetRooms.forEach((roomName) => {
        ioInstance.to(roomName).emit('notification_received', payload);
        if (type) {
          ioInstance.to(roomName).emit(type.toUpperCase(), payload);
          ioInstance.to(roomName).emit(type.toLowerCase(), payload);
        }
      });
    }

    return notification;
  } catch (err) {
    console.error('Failed to create/send notification:', err);
    return null;
  }
}

/**
 * 1. AMBULANCE STARTS EMERGENCY
 * Sends to Traffic Police & Service Provider ONLY.
 * DOES NOT send to Hospital.
 */
export async function notifyEmergencyStarted(trip, ambulance, patient) {
  const metadata = {
    eventType: 'AMBULANCE_EMERGENCY_STARTED',
    ambulanceCallSign: ambulance.callSign,
    location: `${ambulance.currentLat.toFixed(4)}, ${ambulance.currentLng.toFixed(4)}`,
    distanceKm: (trip.estimatedDistanceMeters / 1000).toFixed(1),
    etaMin: Math.max(1, Math.round(trip.estimatedTimeSec / 60)),
    condition: patient?.condition || 'Emergency',
    priority: patient?.priority || 'CRITICAL',
  };

  const title = '🚨 AMBULANCE EMERGENCY ALERT';
  const message = `An ambulance emergency has started (${ambulance.callSign}). Condition: ${metadata.condition}. Immediate clearance required.`;

  // 1. Traffic Police Center Popup
  await createAndSendNotification({
    role: 'TRAFFIC',
    type: 'AMBULANCE_EMERGENCY_STARTED',
    title,
    message,
    recipient: 'role:TRAFFIC',
    tripId: trip.id,
    priority: 'CRITICAL',
    metadata,
    rooms: ['role:TRAFFIC', 'role:TRAFFIC_POLICE', 'role:SERVICE_PROVIDER'],
  });

  // 2. Service Provider Center Popup
  await createAndSendNotification({
    role: 'SERVICE_PROVIDER',
    type: 'AMBULANCE_EMERGENCY_STARTED',
    title,
    message,
    recipient: 'role:SERVICE_PROVIDER',
    tripId: trip.id,
    priority: 'CRITICAL',
    metadata,
    rooms: ['role:SERVICE_PROVIDER', 'role:TRAFFIC', 'role:TRAFFIC_POLICE'],
  });
}

/**
 * 2. AMBULANCE SELECTS A HOSPITAL
 * Sends to Selected Hospital ONLY.
 * DOES NOT send to other hospitals, Traffic Police, or Service Providers.
 */
export async function notifyHospitalSelected(hospitalId, trip, ambulance, patient) {
  const etaMin = Math.max(1, Math.round(trip.estimatedTimeSec / 60));
  const distanceKm = (trip.estimatedDistanceMeters / 1000).toFixed(1);

  const metadata = {
    eventType: 'HOSPITAL_INCOMING_AMBULANCE',
    ambulanceCallSign: ambulance.callSign,
    patientPriority: patient?.priority || 'CRITICAL',
    condition: patient?.condition || 'Cardiac Emergency',
    etaMin,
    distanceKm,
    symptoms: patient?.symptoms,
  };

  const title = '🚑 AMBULANCE SELECTED THIS HOSPITAL';
  const message = `An ambulance (${ambulance.callSign}) has selected your hospital as its emergency destination. Review patient details and respond immediately.`;

  return createAndSendNotification({
    role: 'HOSPITAL',
    type: 'HOSPITAL_INCOMING_AMBULANCE',
    title,
    message,
    recipient: `hospital:${hospitalId}`,
    tripId: trip.id,
    priority: 'CRITICAL',
    metadata,
    rooms: [`hospital:${hospitalId}`],
  });
}

/**
 * 3. HOSPITAL ACCEPTS
 * Sends to Ambulance ONLY.
 */
export async function notifyHospitalAccepted(hospitalName, trip, ambulance) {
  const etaMin = Math.max(1, Math.round(trip.estimatedTimeSec / 60));

  const metadata = {
    eventType: 'HOSPITAL_ACCEPTED',
    hospitalName,
    etaMin,
    ambulanceCallSign: ambulance?.callSign,
  };

  const title = '🏥 HOSPITAL ACCEPTED';
  const message = `${hospitalName} has accepted the incoming ambulance. Destination confirmed. ER bay & trauma team ready.`;

  return createAndSendNotification({
    role: 'AMBULANCE',
    type: 'HOSPITAL_ACCEPTED',
    title,
    message,
    recipient: `ambulance:${trip.ambulanceId}`,
    tripId: trip.id,
    priority: 'SUCCESS',
    metadata,
    rooms: [`trip:${trip.id}`, `role:AMBULANCE`],
  });
}

/**
 * 4. HOSPITAL REJECTS & AUTOMATIC REROUTE
 * Sends to Ambulance and Newly Selected Hospital.
 */
export async function notifyHospitalRejectedAndRerouted(trip, oldHospitalName, newHospital, routeData) {
  const etaMin = Math.max(1, Math.round(routeData.durationSec / 60));
  const distanceKm = (routeData.distanceMeters / 1000).toFixed(1);

  // Popup 1 for Ambulance: Hospital Unavailable
  await createAndSendNotification({
    role: 'AMBULANCE',
    type: 'HOSPITAL_REJECTED',
    title: '⚠️ HOSPITAL UNAVAILABLE',
    message: `The selected hospital (${oldHospitalName}) is unavailable. Searching for the next suitable hospital automatically...`,
    recipient: `ambulance:${trip.ambulanceId}`,
    tripId: trip.id,
    priority: 'WARNING',
    metadata: { oldHospitalName },
    rooms: [`trip:${trip.id}`, `role:AMBULANCE`],
  });

  // Popup 2 for Ambulance: Destination Updated
  await createAndSendNotification({
    role: 'AMBULANCE',
    type: 'HOSPITAL_REROUTED',
    title: '🚑 DESTINATION UPDATED',
    message: `The ambulance has been automatically rerouted to ${newHospital.name}. New ETA: ${etaMin} min (${distanceKm} KM).`,
    recipient: `ambulance:${trip.ambulanceId}`,
    tripId: trip.id,
    priority: 'WARNING',
    metadata: {
      newHospitalName: newHospital.name,
      etaMin,
      distanceKm,
    },
    rooms: [`trip:${trip.id}`, `role:AMBULANCE`],
  });

  // Notification for Newly Selected Hospital
  await notifyHospitalSelected(newHospital.id, trip, trip.ambulance, trip.patient);
}

/**
 * 5. WAY CLEARED
 * Sends to Ambulance ONLY.
 */
export async function notifyWayCleared(trip, clearedBy, responderType, location) {
  const metadata = {
    eventType: 'WAY_CLEARED',
    clearedBy,
    responderType,
    location: location || 'IKEA Flyover / Dynamic Junction',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };

  const title = '🚨 WAY CLEARED';
  const message = `The way ahead has been cleared by ${clearedBy} (${responderType === 'TRAFFIC_POLICE' ? 'Traffic Police' : 'Service Provider'}). You can proceed at high speed.`;

  return createAndSendNotification({
    role: 'AMBULANCE',
    type: 'WAY_CLEARED',
    title,
    message,
    recipient: `ambulance:${trip.ambulanceId}`,
    tripId: trip.id,
    priority: 'SUCCESS',
    metadata,
    rooms: [`ambulance:${trip.ambulanceId}`],
  });
}

/**
 * 6. TRAFFIC POLICE ALERTS (30s REMINDERS, RADIUS EXPANSION, CORRIDOR ALERTS)
 * Sends identical popup message to Traffic Police & Service Provider.
 */
export async function notifyTrafficPolice(tripId, title, message, priority = 'CRITICAL', metadata = {}) {
  await createAndSendNotification({
    role: 'TRAFFIC',
    type: metadata.eventType || 'TRAFFIC_ALERT',
    title,
    message,
    recipient: 'role:TRAFFIC',
    tripId,
    priority,
    metadata,
    rooms: ['role:TRAFFIC', 'role:TRAFFIC_POLICE', 'role:SERVICE_PROVIDER'],
  });

  return createAndSendNotification({
    role: 'SERVICE_PROVIDER',
    type: metadata.eventType || 'TRAFFIC_ALERT',
    title,
    message,
    recipient: 'role:SERVICE_PROVIDER',
    tripId,
    priority,
    metadata,
    rooms: ['role:TRAFFIC', 'role:TRAFFIC_POLICE', 'role:SERVICE_PROVIDER'],
  });
}

/**
 * 7. SERVICE PROVIDER ALERTS (30s REMINDERS, RADIUS EXPANSION, CORRIDOR ALERTS)
 * Sends identical popup message to Service Provider & Traffic Police.
 */
export async function notifyServiceProvider(tripId, title, message, priority = 'CRITICAL', metadata = {}) {
  await createAndSendNotification({
    role: 'SERVICE_PROVIDER',
    type: metadata.eventType || 'SERVICE_PROVIDER_ALERT',
    title,
    message,
    recipient: 'role:SERVICE_PROVIDER',
    tripId,
    priority,
    metadata,
    rooms: ['role:SERVICE_PROVIDER', 'role:TRAFFIC', 'role:TRAFFIC_POLICE'],
  });

  return createAndSendNotification({
    role: 'TRAFFIC',
    type: metadata.eventType || 'SERVICE_PROVIDER_ALERT',
    title,
    message,
    recipient: 'role:TRAFFIC',
    tripId,
    priority,
    metadata,
    rooms: ['role:SERVICE_PROVIDER', 'role:TRAFFIC', 'role:TRAFFIC_POLICE'],
  });
}

/**
 * 8. ADMIN ALERTS
 * Sends to Admin ONLY.
 */
export async function notifyAdmin(title, message, priority = 'INFO', metadata = {}) {
  return createAndSendNotification({
    role: 'ADMIN',
    type: metadata.eventType || 'ADMIN_ALERT',
    title,
    message,
    recipient: 'role:ADMIN',
    tripId: metadata.tripId || null,
    priority,
    metadata,
    rooms: ['role:ADMIN'],
  });
}
