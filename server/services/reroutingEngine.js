import prisma from '../config/prisma.js';
import { findFallbackHospital } from './hospitalMatcher.js';
import {
  notifyHospitalRejectedAndRerouted,
  notifyAdmin,
  getSocketIOInstance,
} from './notificationService.js';

/**
 * Generates a route polyline between start and destination coordinates.
 */
export async function generateRoutePolyline(startLat, startLng, destLat, destLng, avoidBottleneck = false) {
  try {
    const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const res = await fetch(osrmUrl, { timeout: 3000 });
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates; // [lng, lat]
        const polyline = coords.map(c => [c[1], c[0]]);
        return {
          polyline,
          distanceMeters: Math.round(data.routes[0].distance),
          durationSec: Math.round(data.routes[0].duration),
        };
      }
    }
  } catch (err) {
    // Fallback to internal route generator
  }

  // Demo Route Interpolator
  const steps = 25;
  const polyline = [];
  
  const detourLatOffset = avoidBottleneck ? 0.008 : 0;
  const detourLngOffset = avoidBottleneck ? -0.006 : 0;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const easeT = Math.sin(t * Math.PI / 2);
    
    let lat = startLat + (destLat - startLat) * easeT;
    let lng = startLng + (destLng - startLng) * easeT;

    if (avoidBottleneck && i > 5 && i < 18) {
      const bump = Math.sin(((i - 5) / 13) * Math.PI);
      lat += detourLatOffset * bump;
      lng += detourLngOffset * bump;
    }

    polyline.push([parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))]);
  }

  const dLat = (destLat - startLat) * 111000;
  const dLng = (destLng - startLng) * 111000 * Math.cos(startLat * Math.PI / 180);
  const distanceMeters = Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * (avoidBottleneck ? 1.25 : 1.1));
  const durationSec = Math.round(distanceMeters / 12);

  return {
    polyline,
    distanceMeters,
    durationSec,
  };
}

/**
 * Handles Automatic Fallback Hospital Rerouting when primary/current hospital rejects
 */
export async function executeHospitalReroute(tripId, reason = 'Hospital Unavailable', rejectedHospitalId = null) {
  const trip = await prisma.emergencyTrip.findUnique({
    where: { id: tripId },
    include: {
      patient: true,
      ambulance: true,
      hospital: true,
    },
  });

  if (!trip) throw new Error('Emergency trip not found');

  const targetRejectedId = rejectedHospitalId || trip.hospitalId;
  const oldHospitalName = trip.hospital ? trip.hospital.name : 'Primary Hospital';

  // 1. Record the rejection in TripHospitalAttempt
  if (targetRejectedId) {
    const attemptCount = await prisma.tripHospitalAttempt.count({ where: { tripId } });
    await prisma.tripHospitalAttempt.upsert({
      where: {
        tripId_hospitalId: {
          tripId,
          hospitalId: targetRejectedId,
        },
      },
      update: { status: 'REJECTED', reason },
      create: {
        tripId,
        hospitalId: targetRejectedId,
        attemptNumber: attemptCount + 1,
        status: 'REJECTED',
        reason,
      },
    });

    await prisma.hospitalAlert.updateMany({
      where: { tripId, hospitalId: targetRejectedId },
      data: { status: 'REJECTED' },
    });
  }

  // 2. Fetch all excluded/rejected hospital IDs for this trip
  const rejectedAttempts = await prisma.tripHospitalAttempt.findMany({
    where: { tripId, status: 'REJECTED' },
    select: { hospitalId: true },
  });
  const excludeIds = rejectedAttempts.map(a => a.hospitalId);
  if (targetRejectedId && !excludeIds.includes(targetRejectedId)) {
    excludeIds.push(targetRejectedId);
  }

  // 3. Find next best eligible hospital automatically
  const fallback = await findFallbackHospital(
    trip.patient,
    trip.ambulance.currentLat,
    trip.ambulance.currentLng,
    excludeIds
  );

  if (!fallback) {
    await prisma.emergencyTrip.update({
      where: { id: tripId },
      data: { status: 'HOSPITAL_REJECTED' },
    });

    await notifyAdmin(
      'CRITICAL ALERT: All Hospitals Unavailable',
      `Emergency trip ${trip.tripCode} could not be matched with any available hospital!`,
      'CRITICAL',
      { tripId }
    );

    throw new Error('No available fallback hospital found in range');
  }

  // 4. Calculate new route to fallback hospital
  const routeData = await generateRoutePolyline(
    trip.ambulance.currentLat,
    trip.ambulance.currentLng,
    fallback.lat,
    fallback.lng
  );

  // 5. Update trip in database
  const updatedTrip = await prisma.emergencyTrip.update({
    where: { id: tripId },
    data: {
      hospitalId: fallback.hospitalId,
      destLat: fallback.lat,
      destLng: fallback.lng,
      status: 'REROUTED',
      estimatedDistanceMeters: routeData.distanceMeters,
      estimatedTimeSec: routeData.durationSec,
      routeGeometryJson: JSON.stringify(routeData.polyline),
    },
    include: {
      hospital: true,
      ambulance: true,
      patient: true,
    },
  });

  // 6. Create new pre-alert for fallback hospital
  const alert = await prisma.hospitalAlert.create({
    data: {
      tripId,
      hospitalId: fallback.hospitalId,
      status: 'PENDING',
    },
  });

  const attemptCount = await prisma.tripHospitalAttempt.count({ where: { tripId } });
  await prisma.tripHospitalAttempt.create({
    data: {
      tripId,
      hospitalId: fallback.hospitalId,
      attemptNumber: attemptCount + 1,
      status: 'PENDING',
    },
  });

  // 7. Record system emergency event logs
  await prisma.emergencyEvent.create({
    data: {
      tripId,
      eventType: 'HOSPITAL_REJECTED',
      message: `${oldHospitalName} rejected emergency pre-alert (${reason}).`,
    },
  });

  await prisma.emergencyEvent.create({
    data: {
      tripId,
      eventType: 'HOSPITAL_AUTO_REROUTED',
      message: `Automatic fallback reroute selected ${fallback.hospitalName}. New ETA: ${fallback.estimatedTimeMin} min.`,
      metadata: JSON.stringify({ fallbackScore: fallback.totalScore, reason }),
    },
  });

  // 8. Dispatch notifications matching strict direction
  await notifyHospitalRejectedAndRerouted(updatedTrip, oldHospitalName, updatedTrip.hospital, routeData);

  const io = getSocketIOInstance();
  if (io) {
    const payload = {
      tripId,
      hospitalId: fallback.hospitalId,
      hospitalName: fallback.hospitalName,
      trip: updatedTrip,
      routeData,
      timestamp: new Date().toISOString(),
    };

    io.to(`trip:${tripId}`).emit('hospital_rerouted', payload);
  }

  return {
    trip: updatedTrip,
    fallback,
    routeData,
    alert,
  };
}
