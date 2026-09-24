import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { getRouteProgress, buildAheadCorridor } from '../services/corridorEngine.js';
import { findAvailableResponders } from '../services/responderSearch.js';
import { setSocketIOInstance } from '../services/notificationService.js';

export function setupSocketIO(io) {
  setSocketIOInstance(io);

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected to Socket.IO: ${socket.id}`);

    // Optional Socket authentication handshake
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'codepulse_super_secret_jwt_key_2026');
        socket.user = decoded;
        if (decoded.id) socket.join(`user:${decoded.id}`);
        if (decoded.role) socket.join(`role:${decoded.role}`);
        if (decoded.hospitalId) socket.join(`hospital:${decoded.hospitalId}`);
        if (decoded.ambulanceId) socket.join(`ambulance:${decoded.ambulanceId}`);
        console.log(`🔐 Socket ${socket.id} authenticated as User ${decoded.name} (${decoded.role})`);
      } catch (err) {
        console.warn(`⚠️ Socket ${socket.id} token verification failed: ${err.message}`);
      }
    }

    // Join targeted room (e.g., trip:TRIP_ID, hospital:HOSPITAL_ID, role:TRAFFIC, etc.)
    socket.on('join_room', (roomName) => {
      if (!roomName) return;
      socket.join(roomName);
      console.log(`📱 Socket ${socket.id} joined room: ${roomName}`);
    });

    // Leave room
    socket.on('leave_room', (roomName) => {
      if (!roomName) return;
      socket.leave(roomName);
      console.log(`🚪 Socket ${socket.id} left room: ${roomName}`);
    });

    // 1. Ambulance GPS Location Stream
    socket.on('update_ambulance_location', async (data) => {
      try {
        const { tripId, ambulanceId, lat, lng, speed = 45 } = data;
        if (!tripId || !lat || !lng) return;

        const trip = await prisma.emergencyTrip.findUnique({
          where: { id: tripId },
          include: { patient: true, hospital: true, ambulance: true },
        });

        if (!trip || trip.status === 'COMPLETED') return;

        const targetAmbId = trip.ambulanceId || ambulanceId;
        if (targetAmbId) {
          await prisma.ambulance.updateMany({
            where: { OR: [{ id: targetAmbId }, { callSign: targetAmbId }] },
            data: { currentLat: parseFloat(lat), currentLng: parseFloat(lng), speed: parseFloat(speed) },
          });
        }

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
          ambulanceId: targetAmbId,
          lat,
          lng,
          speed,
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

        // Targeted socket room broadcasts
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
      } catch (err) {
        console.error('Error handling ambulance location socket update:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
}
