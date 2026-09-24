import prisma from '../config/prisma.js';
import { findBestHospital, currentWeights } from '../services/hospitalMatcher.js';
import { executeHospitalReroute } from '../services/reroutingEngine.js';
import { notifyHospitalAccepted, getSocketIOInstance } from '../services/notificationService.js';

export async function getAllHospitals(req, res) {
  try {
    const hospitals = await prisma.hospital.findMany({
      include: {
        specialties: true,
        resources: true,
      },
    });
    return res.json({ hospitals });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function matchHospitals(req, res) {
  try {
    const { patient, ambulanceLat, ambulanceLng } = req.body;
    if (!patient || ambulanceLat === undefined || ambulanceLng === undefined) {
      return res.status(400).json({ error: 'Patient details and ambulance location required' });
    }

    const matches = await findBestHospital(patient, ambulanceLat, ambulanceLng);
    return res.json({ matches, weights: currentWeights });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function updateHospitalReadiness(req, res) {
  try {
    const { id } = req.params;
    const { readinessStatus, availableIcuBeds } = req.body;

    const updated = await prisma.hospital.update({
      where: { id },
      data: {
        ...(readinessStatus && { readinessStatus }),
        ...(availableIcuBeds !== undefined && { availableIcuBeds }),
      },
    });

    const io = getSocketIOInstance();
    if (io) {
      io.emit('hospital_status_changed', { hospital: updated, timestamp: new Date().toISOString() });
    }

    return res.json({ hospital: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function handlePreAlertAction(req, res) {
  try {
    const { alertId } = req.params;
    const { action, reason } = req.body; // ACCEPT, MARK_READY, REJECT

    const alert = await prisma.hospitalAlert.findUnique({
      where: { id: alertId },
      include: { trip: { include: { ambulance: true, patient: true } }, hospital: true },
    });

    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    let newStatus = 'PENDING';
    if (action === 'ACCEPT') newStatus = 'ACCEPTED';
    else if (action === 'MARK_READY') newStatus = 'PREPARED';
    else if (action === 'REJECT') newStatus = 'REJECTED';

    const updatedAlert = await prisma.hospitalAlert.update({
      where: { id: alertId },
      data: { status: newStatus },
    });

    const attemptCount = await prisma.tripHospitalAttempt.count({ where: { tripId: alert.tripId } });
    await prisma.tripHospitalAttempt.upsert({
      where: {
        tripId_hospitalId: {
          tripId: alert.tripId,
          hospitalId: alert.hospitalId,
        },
      },
      update: { status: newStatus, reason: reason || null },
      create: {
        tripId: alert.tripId,
        hospitalId: alert.hospitalId,
        attemptNumber: attemptCount + 1,
        status: newStatus,
        reason: reason || null,
      },
    });

    await prisma.emergencyEvent.create({
      data: {
        tripId: alert.tripId,
        eventType: `HOSPITAL_${action}`,
        message: `${alert.hospital.name} ${action.toLowerCase().replace('_', ' ')} emergency intake.${reason ? ` Reason: ${reason}` : ''}`,
      },
    });

    let tripStatus = alert.trip.status;

    if (action === 'ACCEPT' || action === 'MARK_READY') {
      tripStatus = action === 'ACCEPT' ? 'HOSPITAL_ACCEPTED' : 'EN_ROUTE';
      await prisma.emergencyTrip.update({
        where: { id: alert.tripId },
        data: { status: tripStatus },
      });

      // Send HOSPITAL_ACCEPTED popup to ambulance ONLY
      await notifyHospitalAccepted(alert.hospital.name, alert.trip, alert.trip.ambulance);
    }

    let rerouteResult = null;
    if (action === 'REJECT') {
      try {
        rerouteResult = await executeHospitalReroute(alert.tripId, reason || `${alert.hospital.name} Unavailable`, alert.hospitalId);
        tripStatus = rerouteResult.trip.status;
      } catch (rerouteErr) {
        console.error('Auto reroute error after rejection:', rerouteErr);
      }
    }

    const io = getSocketIOInstance();
    if (io) {
      io.to(`trip:${alert.tripId}`).emit('hospital_action_processed', {
        action,
        alertId,
        hospitalId: alert.hospitalId,
        tripStatus,
        rerouteResult,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      alert: updatedAlert,
      tripStatus,
      rerouteResult,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
