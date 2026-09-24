import prisma from '../config/prisma.js';
import { generateRoutePolyline, executeHospitalReroute } from '../services/reroutingEngine.js';
import { findBestHospital } from '../services/hospitalMatcher.js';
import {
  notifyEmergencyStarted,
  notifyHospitalSelected,
  getSocketIOInstance,
} from '../services/notificationService.js';
import { getRouteProgress, buildAheadCorridor } from '../services/corridorEngine.js';
import { findAvailableResponders } from '../services/responderSearch.js';

export async function createEmergencyTrip(req, res) {
  try {
    const { patientData, ambulanceId, selectedHospitalId, ambulanceLat, ambulanceLng } = req.body;

    if (!patientData || ambulanceLat === undefined || ambulanceLng === undefined) {
      return res.status(400).json({ error: 'Patient data and initial coordinates required' });
    }

    // Resolve Ambulance
    let amb = null;
    const targetAmbQuery = req.user?.ambulanceId || ambulanceId;

    if (targetAmbQuery) {
      amb = await prisma.ambulance.findFirst({
        where: { OR: [{ id: targetAmbQuery }, { callSign: targetAmbQuery }] },
      });
    }

    if (!amb) {
      amb = await prisma.ambulance.findFirst();
    }

    if (!amb) {
      amb = await prisma.ambulance.create({
        data: {
          callSign: 'AMB-108-HYD',
          driverName: req.user?.name || 'Suresh Kumar',
          contactNumber: '+91 98765 43210',
          currentLat: ambulanceLat,
          currentLng: ambulanceLng,
          status: 'EN_ROUTE_HOSPITAL',
        },
      });
    }

    const targetAmbulanceId = amb.id;

    // 1. Create Patient Record
    const patientIdStr = `PAT-${Math.floor(100000 + Math.random() * 900000)}`;
    const patient = await prisma.patient.create({
      data: {
        patientIdStr,
        age: parseInt(patientData.age),
        gender: patientData.gender,
        bloodGroup: patientData.bloodGroup,
        symptoms: patientData.symptoms || 'Emergency patient',
        condition: patientData.condition,
        priority: patientData.priority || 'CRITICAL',
        consciousness: patientData.consciousness || 'Conscious',
        injuryType: patientData.injuryType || null,
        heartRate: parseInt(patientData.heartRate || 100),
        spO2: parseInt(patientData.spO2 || 95),
        sysBp: parseInt(patientData.sysBp || 120),
        diaBp: parseInt(patientData.diaBp || 80),
        temp: parseFloat(patientData.temp || 98.6),
        respRate: parseInt(patientData.respRate || 18),
        notes: patientData.notes || '',
      },
    });

    // 2. Select Hospital
    let targetHospitalId = selectedHospitalId;
    if (!targetHospitalId) {
      const best = await findBestHospital(patient, ambulanceLat, ambulanceLng);
      if (best.length === 0) throw new Error('No eligible hospitals available in system');
      targetHospitalId = best[0].hospitalId;
    }

    const hospital = await prisma.hospital.findUnique({ where: { id: targetHospitalId } });
    if (!hospital) throw new Error('Target hospital not found');

    // 3. Generate Route Polyline
    const route = await generateRoutePolyline(ambulanceLat, ambulanceLng, hospital.lat, hospital.lng);

    // 4. Create Emergency Trip
    const tripCode = `TRIP-${Math.floor(10000 + Math.random() * 90000)}`;
    const trip = await prisma.emergencyTrip.create({
      data: {
        tripCode,
        patientId: patient.id,
        ambulanceId: targetAmbulanceId,
        hospitalId: hospital.id,
        status: 'HOSPITAL_ALERTED',
        startLat: ambulanceLat,
        startLng: ambulanceLng,
        destLat: hospital.lat,
        destLng: hospital.lng,
        estimatedTimeSec: route.durationSec,
        estimatedDistanceMeters: route.distanceMeters,
        currentCorridorRangeKm: 1.0,
        routeGeometryJson: JSON.stringify(route.polyline),
      },
      include: {
        patient: true,
        ambulance: true,
        hospital: true,
      },
    });

    // 5. Update Ambulance status
    await prisma.ambulance.update({
      where: { id: targetAmbulanceId },
      data: {
        currentLat: ambulanceLat,
        currentLng: ambulanceLng,
        status: 'EN_ROUTE_HOSPITAL',
      },
    });

    // 6. Create Hospital Pre-Alert
    const hospitalAlert = await prisma.hospitalAlert.create({
      data: {
        tripId: trip.id,
        hospitalId: hospital.id,
        status: 'PENDING',
      },
    });

    await prisma.tripHospitalAttempt.create({
      data: {
        tripId: trip.id,
        hospitalId: hospital.id,
        attemptNumber: 1,
        status: 'PENDING',
      },
    });

    // 7. Log Emergency Event
    await prisma.emergencyEvent.create({
      data: {
        tripId: trip.id,
        eventType: 'AMBULANCE_STARTED',
        message: `Ambulance ${amb.callSign} started emergency trip ${tripCode} for ${patient.condition} (${patient.priority}).`,
      },
    });

    await prisma.emergencyEvent.create({
      data: {
        tripId: trip.id,
        eventType: 'HOSPITAL_SELECTED',
        message: `Ambulance selected hospital ${hospital.name} as emergency destination.`,
      },
    });

    // 8. Dispatch Role Notifications
    // STEP 1: Emergency Started -> Traffic Police & Service Provider ONLY
    await notifyEmergencyStarted(trip, amb, patient);

    // STEP 2: Selected Hospital -> Selected Hospital ONLY
    await notifyHospitalSelected(hospital.id, trip, amb, patient);

    const io = getSocketIOInstance();
    if (io) {
      io.emit('trip_initiated', { trip, hospitalAlert, routePolyline: route.polyline });
    }

    return res.status(201).json({
      trip,
      hospitalAlert,
      routePolyline: route.polyline,
    });
  } catch (err) {
    console.error('Create trip error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export async function getActiveTrip(req, res) {
  try {
    const trip = await prisma.emergencyTrip.findFirst({
      where: {
        status: { in: ['INITIATED', 'MATCHED', 'HOSPITAL_ALERTED', 'HOSPITAL_ACCEPTED', 'EN_ROUTE', 'REROUTED'] },
      },
      include: {
        patient: true,
        ambulance: true,
        hospital: true,
        vitals: { orderBy: { timestamp: 'desc' }, take: 1 },
        responderAlerts: { include: { responder: true } },
        hospitalAlerts: { include: { hospital: true } },
        hospitalAttempts: { include: { hospital: true } },
        bottlenecks: true,
        events: { orderBy: { createdAt: 'desc' }, take: 25 },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ trip });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function updateTripLocation(req, res) {
  try {
    const { tripId } = req.params;
    const { lat, lng, speed = 45 } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude coordinates required' });
    }

    const trip = await prisma.emergencyTrip.findUnique({
      where: { id: tripId },
      include: { patient: true, hospital: true, ambulance: true },
    });

    if (!trip || trip.status === 'COMPLETED') {
      return res.status(404).json({ error: 'Active trip not found' });
    }

    if (req.user && req.user.role === 'AMBULANCE' && req.user.ambulanceId) {
      if (req.user.ambulanceId !== trip.ambulanceId) {
        return res.status(403).json({ error: 'Forbidden: You can only update location for your assigned ambulance' });
      }
    }

    await prisma.ambulance.update({
      where: { id: trip.ambulanceId },
      data: { currentLat: parseFloat(lat), currentLng: parseFloat(lng), speed: parseFloat(speed) },
    });

    let routePolyline = [];
    if (trip.routeGeometryJson) {
      try {
        routePolyline = JSON.parse(trip.routeGeometryJson);
      } catch (e) {}
    }

    const progress = getRouteProgress(routePolyline, [lat, lng]);
    const corridorZone0_1 = buildAheadCorridor(routePolyline, [lat, lng], 0.0, 1.0);
    const corridorZone1_2 = buildAheadCorridor(routePolyline, [lat, lng], 1.0, 2.0);
    const searchResult = await findAvailableResponders(trip, [lat, lng], routePolyline);

    const payload = {
      tripId: trip.id,
      ambulanceId: trip.ambulanceId,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      speed: parseFloat(speed),
      progress: {
        currentProgressKm: parseFloat(progress.currentProgressKm.toFixed(2)),
        totalRouteKm: parseFloat(progress.totalRouteKm.toFixed(2)),
        remainingKm: parseFloat((progress.totalRouteKm - progress.currentProgressKm).toFixed(2)),
        estimatedEtaMin: Math.max(1, Math.round((progress.totalRouteKm - progress.currentProgressKm) * 2)),
      },
      corridorZones: {
        zone0_1: corridorZone0_1,
        zone1_2: corridorZone1_2,
      },
      searchResult,
      timestamp: new Date().toISOString(),
    };

    const io = getSocketIOInstance();
    if (io) {
      io.to(`trip:${trip.id}`).emit('ambulance_location_updated', payload);
      io.to(`role:AMBULANCE`).emit('ambulance_location_updated', payload);
      io.to(`role:TRAFFIC`).emit('ambulance_location_updated', payload);
      io.to(`role:SERVICE_PROVIDER`).emit('ambulance_location_updated', payload);
      io.to(`hospital:${trip.hospitalId}`).emit('ambulance_location_updated', {
        tripId: trip.id,
        lat,
        lng,
        etaMin: payload.progress.estimatedEtaMin,
        remainingKm: payload.progress.remainingKm,
      });
    }

    return res.json({ success: true, payload });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function triggerReroute(req, res) {
  try {
    const { tripId } = req.params;
    const { reason } = req.body;

    const result = await executeHospitalReroute(tripId, reason || 'Hospital Unavailable');
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function completeTrip(req, res) {
  try {
    const { tripId } = req.params;

    const trip = await prisma.emergencyTrip.update({
      where: { id: tripId },
      data: { status: 'COMPLETED' },
      include: { hospital: true, ambulance: true },
    });

    await prisma.ambulance.update({
      where: { id: trip.ambulanceId },
      data: { status: 'IDLE' },
    });

    await prisma.emergencyEvent.create({
      data: {
        tripId,
        eventType: 'TRIP_COMPLETED',
        message: `Ambulance arrived at ${trip.hospital.name}. Patient handed over to ER team.`,
      },
    });

    const io = getSocketIOInstance();
    if (io) {
      io.to(`trip:${tripId}`).emit('trip_completed', { tripId, timestamp: new Date().toISOString() });
    }

    return res.json({ trip, message: 'Trip completed successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
