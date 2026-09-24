import express from 'express';
import { login, getProfile } from '../controllers/authController.js';
import { authenticateToken, requireRole, requireTripAccess } from '../middleware/authMiddleware.js';
import {
  getAllHospitals,
  matchHospitals,
  updateHospitalReadiness,
  handlePreAlertAction,
} from '../controllers/hospitalController.js';
import {
  createEmergencyTrip,
  getActiveTrip,
  updateTripLocation,
  triggerReroute,
  completeTrip,
} from '../controllers/tripController.js';
import {
  getResponders,
  respondToAlert,
  respondToAction,
  searchRespondersForTrip,
  getResponderAlerts,
  getTripResponders,
} from '../controllers/responderController.js';
import {
  getAnalytics,
  getConfig,
  updateConfig,
  setWeights,
  triggerDemoScenario,
} from '../controllers/adminController.js';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../controllers/notificationController.js';

const router = express.Router();

// Auth Routes
router.post('/auth/login', login);
router.get('/auth/profile', authenticateToken, getProfile);

// Hospital Routes
router.get('/hospitals', getAllHospitals);
router.post('/hospitals/match', matchHospitals);
router.patch('/hospitals/:id/readiness', authenticateToken, requireRole('HOSPITAL', 'ADMIN'), updateHospitalReadiness);
router.post('/hospitals/pre-alert/:alertId/action', authenticateToken, requireRole('HOSPITAL', 'ADMIN'), handlePreAlertAction);

// Emergency Trip Routes
router.post('/trips/intake', authenticateToken, requireRole('AMBULANCE', 'ADMIN'), createEmergencyTrip);
router.get('/trips/active', authenticateToken, getActiveTrip);
router.post('/trips/:tripId/location', authenticateToken, requireRole('AMBULANCE', 'ADMIN'), updateTripLocation);
router.get('/trips/:tripId/responders', authenticateToken, getTripResponders);
router.post('/trips/:tripId/reroute', authenticateToken, requireRole('AMBULANCE', 'ADMIN', 'HOSPITAL'), triggerReroute);
router.post('/trips/:tripId/complete', authenticateToken, requireRole('AMBULANCE', 'ADMIN', 'HOSPITAL'), completeTrip);

// Responder Routes
router.get('/responders', authenticateToken, getResponders);
router.get('/responders/alerts', authenticateToken, getResponderAlerts);
router.post('/responders/search', authenticateToken, searchRespondersForTrip);
router.post('/responders/action', authenticateToken, requireRole('TRAFFIC', 'SERVICE_PROVIDER', 'ADMIN'), respondToAction);
router.post('/responders/alerts/:alertId/action', authenticateToken, requireRole('TRAFFIC', 'SERVICE_PROVIDER', 'ADMIN'), respondToAlert);

// Notification Routes
router.get('/notifications', authenticateToken, getNotifications);
router.patch('/notifications/:id/read', authenticateToken, markNotificationAsRead);
router.patch('/notifications/read-all', authenticateToken, markAllNotificationsAsRead);

// Admin & System Config Routes
router.get('/admin/analytics', authenticateToken, getAnalytics);
router.get('/admin/config', authenticateToken, getConfig);
router.put('/admin/config', authenticateToken, requireRole('ADMIN'), updateConfig);
router.post('/admin/weights', authenticateToken, requireRole('ADMIN'), setWeights);
router.post('/admin/demo-trigger', authenticateToken, triggerDemoScenario);

export default router;
