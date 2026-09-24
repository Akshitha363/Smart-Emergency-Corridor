import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'codepulse_super_secret_jwt_key_2026', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

/**
 * Enforces strict role authorization
 * @param  {...string} roles Allowed user roles e.g. 'AMBULANCE', 'HOSPITAL', 'TRAFFIC', 'SERVICE_PROVIDER', 'ADMIN'
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Access restricted to [${roles.join(', ')}] roles` });
    }

    next();
  };
}

/**
 * Enforces resource-level access verification for emergency trips
 */
export async function requireTripAccess(req, res, next) {
  try {
    const tripId = req.params.tripId || req.body.tripId;
    if (!tripId) {
      return res.status(400).json({ error: 'Trip ID parameter required' });
    }

    // Admin can access everything
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const trip = await prisma.emergencyTrip.findUnique({
      where: { id: tripId },
      include: { hospital: true, ambulance: true },
    });

    if (!trip) {
      return res.status(404).json({ error: 'Emergency trip not found' });
    }

    // Hospital role can access if assigned to this trip or if checking active requests
    if (req.user.role === 'HOSPITAL') {
      if (req.user.hospitalId && req.user.hospitalId !== trip.hospitalId) {
        return res.status(403).json({ error: 'Forbidden: You cannot access emergency data for another hospital' });
      }
      return next();
    }

    // Ambulance role can access if assigned to this trip or creating trips
    if (req.user.role === 'AMBULANCE') {
      if (req.user.ambulanceId && req.user.ambulanceId !== trip.ambulanceId) {
        return res.status(403).json({ error: 'Forbidden: You cannot access another ambulance trip' });
      }
      return next();
    }

    // Traffic Police and Service Provider can access operational trips
    if (req.user.role === 'TRAFFIC' || req.user.role === 'SERVICE_PROVIDER') {
      return next();
    }

    return res.status(403).json({ error: 'Forbidden: Unauthorized trip access' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
