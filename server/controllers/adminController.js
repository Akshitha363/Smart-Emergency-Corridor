import prisma from '../config/prisma.js';
import { currentWeights, updateWeights } from '../services/hospitalMatcher.js';
import { executeHospitalReroute, generateRoutePolyline } from '../services/reroutingEngine.js';
import { getSocketIOInstance, notifyAdmin } from '../services/notificationService.js';

export async function getAnalytics(req, res) {
  try {
    const totalTrips = await prisma.emergencyTrip.count();
    const activeTrips = await prisma.emergencyTrip.count({
      where: { status: { in: ['INITIATED', 'MATCHED', 'HOSPITAL_ALERTED', 'HOSPITAL_ACCEPTED', 'EN_ROUTE', 'REROUTED'] } },
    });
    const completedTrips = await prisma.emergencyTrip.count({
      where: { status: 'COMPLETED' },
    });

    const totalHospitals = await prisma.hospital.count();
    const readyHospitals = await prisma.hospital.count({ where: { readinessStatus: 'READY' } });

    const totalResponders = await prisma.responder.count();
    const availableResponders = await prisma.responder.count({ where: { status: 'AVAILABLE' } });

    const recentEvents = await prisma.emergencyEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: { trip: true },
    });

    let config = await prisma.systemConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      config = await prisma.systemConfig.create({
        data: {
          id: 'default',
          initialRadiusKm: 1.0,
          radiusStepKm: 1.0,
          maxRadiusKm: 5.0,
          reminderIntervalSec: 30,
          escalationTimeoutSec: 30,
          maxHospitalFallbackAttempts: 5,
          hospitalWeightsJson: JSON.stringify(currentWeights),
        },
      });
    }

    return res.json({
      metrics: {
        totalTrips,
        activeTrips,
        completedTrips,
        totalHospitals,
        readyHospitals,
        totalResponders,
        availableResponders,
        avgResponseTimeMin: 4.2,
        corridorClearanceRate: '94.8%',
      },
      config: {
        ...config,
        weights: config.hospitalWeightsJson ? JSON.parse(config.hospitalWeightsJson) : currentWeights,
      },
      weights: currentWeights,
      recentEvents,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getConfig(req, res) {
  try {
    let config = await prisma.systemConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      config = await prisma.systemConfig.create({
        data: {
          id: 'default',
          initialRadiusKm: 1.0,
          radiusStepKm: 1.0,
          maxRadiusKm: 5.0,
          reminderIntervalSec: 30,
          escalationTimeoutSec: 30,
          maxHospitalFallbackAttempts: 5,
          hospitalWeightsJson: JSON.stringify(currentWeights),
        },
      });
    }

    return res.json({
      config: {
        ...config,
        weights: config.hospitalWeightsJson ? JSON.parse(config.hospitalWeightsJson) : currentWeights,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function updateConfig(req, res) {
  try {
    const {
      initialRadiusKm,
      radiusStepKm,
      maxRadiusKm,
      reminderIntervalSec,
      escalationTimeoutSec,
      maxHospitalFallbackAttempts,
      weights,
    } = req.body;

    let weightsJson = undefined;
    if (weights) {
      updateWeights(weights);
      weightsJson = JSON.stringify(weights);
    }

    const updatedConfig = await prisma.systemConfig.upsert({
      where: { id: 'default' },
      update: {
        ...(initialRadiusKm !== undefined && { initialRadiusKm: parseFloat(initialRadiusKm) }),
        ...(radiusStepKm !== undefined && { radiusStepKm: parseFloat(radiusStepKm) }),
        ...(maxRadiusKm !== undefined && { maxRadiusKm: parseFloat(maxRadiusKm) }),
        ...(reminderIntervalSec !== undefined && { reminderIntervalSec: parseInt(reminderIntervalSec) }),
        ...(escalationTimeoutSec !== undefined && { escalationTimeoutSec: parseInt(escalationTimeoutSec) }),
        ...(maxHospitalFallbackAttempts !== undefined && { maxHospitalFallbackAttempts: parseInt(maxHospitalFallbackAttempts) }),
        ...(weightsJson && { hospitalWeightsJson: weightsJson }),
      },
      create: {
        id: 'default',
        initialRadiusKm: parseFloat(initialRadiusKm || 1.0),
        radiusStepKm: parseFloat(radiusStepKm || 1.0),
        maxRadiusKm: parseFloat(maxRadiusKm || 5.0),
        reminderIntervalSec: parseInt(reminderIntervalSec || 30),
        escalationTimeoutSec: parseInt(escalationTimeoutSec || 30),
        maxHospitalFallbackAttempts: parseInt(maxHospitalFallbackAttempts || 5),
        hospitalWeightsJson: weightsJson || JSON.stringify(currentWeights),
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('system_config_updated', { config: updatedConfig, weights: currentWeights });
    }

    return res.json({
      config: updatedConfig,
      weights: currentWeights,
      message: 'System operational parameters saved successfully',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function setWeights(req, res) {
  try {
    const newWeights = req.body;
    const updated = updateWeights(newWeights);

    await prisma.systemConfig.upsert({
      where: { id: 'default' },
      update: { hospitalWeightsJson: JSON.stringify(updated) },
      create: { id: 'default', hospitalWeightsJson: JSON.stringify(updated) },
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('weights_updated', { weights: updated });
      io.emit('trip_status_changed', { type: 'WEIGHTS_UPDATE', timestamp: new Date().toISOString() });
    }
    return res.json({ weights: updated, message: 'Hospital matching weights updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// Ensure an active trip exists for demo actions
async function ensureActiveDemoTrip() {
  let trip = await prisma.emergencyTrip.findFirst({
    where: { status: { in: ['INITIATED', 'MATCHED', 'HOSPITAL_ALERTED', 'HOSPITAL_ACCEPTED', 'EN_ROUTE', 'REROUTED'] } },
    orderBy: { createdAt: 'desc' },
    include: { patient: true, ambulance: true, hospital: true },
  });

  if (trip) return trip;

  // Auto create patient
  const patient = await prisma.patient.create({
    data: {
      patientIdStr: `PAT-${Math.floor(100000 + Math.random() * 900000)}`,
      age: 58,
      gender: 'Male',
      bloodGroup: 'O+',
      symptoms: 'Acute chest pain, breathlessness',
      condition: 'CARDIAC',
      priority: 'CRITICAL',
      consciousness: 'Conscious',
      heartRate: 112,
      spO2: 91,
      sysBp: 90,
      diaBp: 60,
      temp: 98.6,
      respRate: 22,
    },
  });

  // Find ambulance
  let amb = await prisma.ambulance.findFirst();
  if (!amb) {
    amb = await prisma.ambulance.create({
      data: {
        callSign: 'AMB-108-HYD',
        driverName: 'Suresh Kumar',
        contactNumber: '+91 98765 43210',
        currentLat: 17.4447,
        currentLng: 78.3854,
        status: 'EN_ROUTE_HOSPITAL',
      },
    });
  }

  // Find Apollo or best hospital
  let hospital = await prisma.hospital.findFirst({ where: { code: 'APOLLO_JH' } });
  if (!hospital) hospital = await prisma.hospital.findFirst();
  if (!hospital) {
    hospital = await prisma.hospital.create({
      data: {
        name: 'Apollo Hospitals Jubilee Hills',
        code: 'APOLLO_JH',
        lat: 17.4325,
        lng: 78.4071,
        totalBeds: 120,
        emergencyBeds: 15,
        icuBeds: 25,
        availableIcuBeds: 8,
        readinessStatus: 'READY',
        contactPhone: '+91 40 2360 7777',
      },
    });
  }

  const route = await generateRoutePolyline(amb.currentLat, amb.currentLng, hospital.lat, hospital.lng);

  trip = await prisma.emergencyTrip.create({
    data: {
      tripCode: `TRIP-${Math.floor(10000 + Math.random() * 90000)}`,
      patientId: patient.id,
      ambulanceId: amb.id,
      hospitalId: hospital.id,
      status: 'EN_ROUTE',
      startLat: amb.currentLat,
      startLng: amb.currentLng,
      destLat: hospital.lat,
      destLng: hospital.lng,
      estimatedTimeSec: route.durationSec,
      estimatedDistanceMeters: route.distanceMeters,
      currentCorridorRangeKm: 1.0,
      routeGeometryJson: JSON.stringify(route.polyline),
    },
    include: { patient: true, ambulance: true, hospital: true },
  });

  await prisma.hospitalAlert.create({
    data: { tripId: trip.id, hospitalId: hospital.id, status: 'ACCEPTED' },
  });

  return trip;
}

export async function triggerDemoScenario(req, res) {
  try {
    const { scenario } = req.body;
    console.log(`🎬 Demo Scenario Triggered: ${scenario}`);

    let activeTrip = await ensureActiveDemoTrip();
    const io = req.app.get('io') || getSocketIOInstance();

    let result = {};

    switch (scenario) {
      case 'SIMULATE_TRAFFIC_CONGESTION': {
        const bottleneck = await prisma.trafficBottleneck.create({
          data: {
            tripId: activeTrip.id,
            name: 'Severe Traffic Jam (Jubilee Check Post Junction)',
            lat: activeTrip.destLat - 0.005,
            lng: activeTrip.destLng - 0.005,
            severity: 'SEVERE',
            status: 'ACTIVE',
          },
        });

        await prisma.emergencyEvent.create({
          data: {
            tripId: activeTrip.id,
            eventType: 'TRAFFIC_BOTTLENECK_DETECTED',
            message: '🚨 Heavy Traffic Bottleneck detected 1.2 KM ahead. Scanning response layers...',
          },
        });

        if (io) {
          io.to(`trip:${activeTrip.id}`).emit('traffic_bottleneck_detected', { bottleneck, tripId: activeTrip.id });
          io.to('role:TRAFFIC').emit('traffic_bottleneck_detected', { bottleneck, tripId: activeTrip.id });
          io.to('role:SERVICE_PROVIDER').emit('traffic_bottleneck_detected', { bottleneck, tripId: activeTrip.id });
        }

        result = { bottleneck, message: 'Simulated severe traffic bottleneck ahead.' };
        break;
      }

      case 'SIMULATE_NO_RESPONDER': {
        await prisma.responder.updateMany({
          data: { status: 'UNAVAILABLE' },
        });

        await prisma.emergencyEvent.create({
          data: {
            tripId: activeTrip.id,
            eventType: 'RESPONDER_EXPANDING_SEARCH',
            message: '🔍 0–1 KM: No responder. 1–2 KM: No responder. Expanding corridor search to 2–3 KM...',
          },
        });

        if (io) {
          io.to('role:TRAFFIC').emit('notification_received', {
            title: '⚠️ RESPONDER RADIUS EXPANDED',
            message: `No responder within 2 KM. Search radius expanded to 3 KM for Ambulance ${activeTrip.ambulance?.callSign}`,
            priority: 'WARNING',
          });
          io.to('role:SERVICE_PROVIDER').emit('notification_received', {
            title: '⚠️ RESPONDER RADIUS EXPANDED',
            message: `No responder within 2 KM. Search radius expanded to 3 KM for Ambulance ${activeTrip.ambulance?.callSign}`,
            priority: 'WARNING',
          });
        }

        result = { message: 'All 0-2 KM responders set to unavailable. Search expanded to 3 KM.' };
        break;
      }

      case 'SIMULATE_RESPONDER_AVAILABLE': {
        const ambLat = activeTrip.ambulance?.currentLat || activeTrip.startLat || 17.4447;
        const ambLng = activeTrip.ambulance?.currentLng || activeTrip.startLng || 78.3854;

        const officer = await prisma.responder.upsert({
          where: { badgeNumber: 'TP-CYB-104' },
          update: {
            status: 'AVAILABLE',
            lat: ambLat + 0.006,
            lng: ambLng + 0.006,
          },
          create: {
            name: 'Inspector Rajesh Varma',
            badgeNumber: 'TP-CYB-104',
            type: 'TRAFFIC_POLICE',
            lat: ambLat + 0.006,
            lng: ambLng + 0.006,
            status: 'AVAILABLE',
            contact: '+91 91234 56789',
          },
        });

        const alertRecord = await prisma.responderAlert.upsert({
          where: {
            tripId_responderId: {
              tripId: activeTrip.id,
              responderId: officer.id,
            },
          },
          update: {
            status: 'SENT',
            actionStatus: 'NOTIFIED',
            lastNotifiedAt: new Date(),
          },
          create: {
            tripId: activeTrip.id,
            responderId: officer.id,
            responderType: 'TRAFFIC_POLICE',
            rangeZone: '1_2_KM',
            status: 'SENT',
            actionStatus: 'NOTIFIED',
          },
        });

        await prisma.emergencyEvent.create({
          data: {
            tripId: activeTrip.id,
            eventType: 'RESPONDER_FOUND',
            message: `👮 Officer Inspector Rajesh Varma located 1.2 KM ahead. Alert sent!`,
          },
        });

        if (io) {
          io.emit('responder_alert_sent', {
            alertId: alertRecord.id,
            rangeZone: '1_2_KM',
            responder: officer,
            message: `Alert sent to ${officer.name} (1–2 KM Ahead)`,
            found: true,
          });
          io.to('role:TRAFFIC').emit('notification_received', {
            title: '🚨 RESPONDER ALERT',
            message: `Inspector Rajesh Varma assigned to emergency trip ${activeTrip.tripCode}`,
            priority: 'CRITICAL',
          });
        }
        result = { officer, alertRecord, message: 'Officer Inspector Rajesh created 1.2 KM ahead on corridor.' };
        break;
      }

      case 'SIMULATE_HOSPITAL_UNAVAILABLE': {
        if (activeTrip.hospitalId) {
          await prisma.hospital.update({
            where: { id: activeTrip.hospitalId },
            data: { readinessStatus: 'FULL', availableIcuBeds: 0 },
          });
        }

        const rerouteResult = await executeHospitalReroute(activeTrip.id, 'ICU & Emergency Dept Full');
        if (io) {
          io.emit('hospital_unavailable', {
            tripId: activeTrip.id,
            hospitalId: activeTrip.hospitalId,
            fallback: rerouteResult.fallback,
            timestamp: new Date().toISOString(),
          });
        }
        result = { ...rerouteResult, message: 'Primary hospital marked FULL. Auto rerouted to best fallback hospital!' };
        break;
      }

      case 'SIMULATE_VITAL_CHANGE': {
        await prisma.patient.update({
          where: { id: activeTrip.patientId },
          data: { priority: 'CRITICAL', condition: 'CRITICAL CARDIAC ARREST' },
        });

        await prisma.emergencyEvent.create({
          data: {
            tripId: activeTrip.id,
            eventType: 'PATIENT_STATUS_CRITICAL',
            message: '⚠️ Critical Patient Warning: Patient condition escalated to CRITICAL CARDIAC ARREST!',
          },
        });

        if (io) {
          io.to(`trip:${activeTrip.id}`).emit('trip_status_changed', { type: 'PATIENT_STATUS_CRITICAL', tripId: activeTrip.id });
        }
        result = { message: 'Patient priority escalated to CRITICAL CARDIAC ARREST.' };
        break;
      }

      case 'RESET_DEMO': {
        await prisma.responder.updateMany({
          data: { status: 'AVAILABLE' },
        });
        await prisma.hospital.updateMany({
          data: { readinessStatus: 'READY', availableIcuBeds: 8 },
        });
        result = { message: 'Demo environment reset to default state.' };
        break;
      }

      default:
        return res.status(400).json({ error: 'Unknown demo scenario command.' });
    }

    if (io) {
      io.emit('trip_status_changed', { type: 'DEMO_TRIGGER', scenario, timestamp: new Date().toISOString() });
    }

    return res.json({ scenario, result, activeTripId: activeTrip?.id });
  } catch (err) {
    console.error('Demo trigger error:', err);
    return res.status(500).json({ error: err.message });
  }
}
