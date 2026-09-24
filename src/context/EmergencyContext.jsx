import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const EmergencyContext = createContext();

export function EmergencyProvider({ children }) {
  const { user, token } = useAuth();
  const [activeTrip, setActiveTrip] = useState(null);
  const [corridorState, setCorridorState] = useState(null);
  const [searchResult, setSearchResult] = useState(null);
  const [eventLogs, setEventLogs] = useState([]);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [simulationIndex, setSimulationIndex] = useState(0);
  const [allHospitals, setAllHospitals] = useState([]);
  const [clearedSignal, setClearedSignal] = useState(null);
  
  // Notification Modal State
  const [activeModalNotification, setActiveModalNotification] = useState(null);

  // Notification Center State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const socketRef = useRef(null);
  const simIntervalRef = useRef(null);

  // Helper to fetch notifications from backend API
  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const markNotificationRead = async (id) => {
    if (!token) return;
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const markAllNotificationsRead = async () => {
    if (!token) return;
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  // Trigger centered emergency modal
  const triggerModalAlert = (notificationObj) => {
    setActiveModalNotification(notificationObj);
  };

  // Fetch all hospitals
  const fetchAllHospitals = async () => {
    try {
      const res = await fetch('/api/hospitals', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAllHospitals(data.hospitals || []);
      }
    } catch (e) {
      console.error('Failed to fetch hospitals:', e);
    }
  };

  useEffect(() => {
    fetchAllHospitals();
    if (token) fetchNotifications();
  }, [token]);

  // Automatically join socket rooms whenever user profile loads or updates
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && user) {
      console.log(`📱 Joining Socket.IO rooms for user role: ${user.role} (${user.name})`);
      if (user.role) {
        socket.emit('join_room', `role:${user.role}`);
        if (user.role === 'TRAFFIC' || user.role === 'TRAFFIC_POLICE') {
          socket.emit('join_room', 'role:TRAFFIC');
          socket.emit('join_room', 'role:TRAFFIC_POLICE');
          socket.emit('join_room', 'role:SERVICE_PROVIDER');
        } else if (user.role === 'SERVICE_PROVIDER') {
          socket.emit('join_room', 'role:SERVICE_PROVIDER');
          socket.emit('join_room', 'role:TRAFFIC');
          socket.emit('join_room', 'role:TRAFFIC_POLICE');
        }
      }
      if (user.id) socket.emit('join_room', `user:${user.id}`);
      if (user.hospitalId) socket.emit('join_room', `hospital:${user.hospitalId}`);
      if (user.ambulanceId) socket.emit('join_room', `ambulance:${user.ambulanceId}`);
    }
  }, [user]);

  // Initialize Socket.IO connection with Auth Handshake
  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      auth: { token: token || localStorage.getItem('codepulse_token') },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('⚡ Connected to CODE PULSE Socket.IO Server');
      if (user?.role) {
        socket.emit('join_room', `role:${user.role}`);
        if (user.role === 'TRAFFIC' || user.role === 'TRAFFIC_POLICE') {
          socket.emit('join_room', 'role:TRAFFIC');
          socket.emit('join_room', 'role:TRAFFIC_POLICE');
          socket.emit('join_room', 'role:SERVICE_PROVIDER');
        } else if (user.role === 'SERVICE_PROVIDER') {
          socket.emit('join_room', 'role:SERVICE_PROVIDER');
          socket.emit('join_room', 'role:TRAFFIC');
          socket.emit('join_room', 'role:TRAFFIC_POLICE');
        }
      }
      if (user?.id) socket.emit('join_room', `user:${user.id}`);
      if (user?.hospitalId) socket.emit('join_room', `hospital:${user.hospitalId}`);
      if (user?.ambulanceId) socket.emit('join_room', `ambulance:${user.ambulanceId}`);
    });

    socket.on('notification_received', (data) => {
      fetchNotifications();
      if (data) {
        triggerModalAlert(data);
      }
    });

    socket.on('ambulance_location_updated', (data) => {
      setCorridorState(data);
      if (data.searchResult) setSearchResult(data.searchResult);
    });

    socket.on('responder_alert_sent', (data) => {
      setSearchResult(data);
      addEventLog('ALERT_SENT', data.message || `Emergency alert dispatched (${data.rangeZone})`);
    });

    socket.on('responder_assigned', (data) => {
      const respTitle = data.responderType === 'SERVICE_PROVIDER' ? 'Service Provider' : 'Traffic Police Officer';
      const isLead = data.action === 'TAKE_LEAD';
      const isRelease = data.action === 'RELEASE_LEAD';

      if (isLead) {
        const msg = `⭐ ${respTitle} ${data.responderName} HAS TAKEN LEAD of Emergency Corridor! Clear Route Active!`;
        addEventLog('RESPONDER_ASSIGNED', msg);
        triggerModalAlert({
          title: `⭐ ${respTitle.toUpperCase()} TAKEN LEAD`,
          message: `${data.responderName} has TAKEN LEAD of emergency corridor. Priority clearance active!`,
          priority: 'SUCCESS',
        });
      } else if (isRelease) {
        addEventLog('RESPONDER_RELEASED', `🔓 ${respTitle} ${data.responderName} Released Lead.`);
      }
      fetchActiveTrip();
    });

    socket.on('corridor_cleared_signal', (data) => {
      setClearedSignal(data);
      if (data.action === 'MARK_CLEARED') {
        const respTitle = data.responderType === 'SERVICE_PROVIDER' ? 'Service Provider' : 'Traffic Police Officer';
        triggerModalAlert({
          title: `✅ CORRIDOR CLEARED SIGNAL`,
          message: `${respTitle} ${data.responderName} confirmed intersection and dynamic corridor CLEARED!`,
          priority: 'SUCCESS',
        });
      }
    });

    socket.on('hospital_ready', (data) => {
      addEventLog('HOSPITAL_READY', '✅ HOSPITAL CONFIRMED READY FOR INCOMING AMBULANCE');
      triggerModalAlert({
        title: '🏥 HOSPITAL ER READY',
        message: 'Destination hospital ER confirmed ready for ambulance arrival!',
        priority: 'SUCCESS',
      });
      fetchActiveTrip();
    });

    socket.on('hospital_rerouted', (data) => {
      addEventLog('HOSPITAL_REROUTED', `⚠️ Emergency Automatically Rerouted to ${data.hospitalName}`);
      triggerModalAlert({
        title: '🚑 DESTINATION AUTOMATICALLY UPDATED',
        message: `Primary hospital rejected. System automatically rerouted to ${data.hospitalName}. Route and ETA updated.`,
        priority: 'WARNING',
        metadata: { ambulanceCallSign: activeTrip?.ambulance?.callSign, distanceKm: data.fallback?.distanceKm, etaMin: data.fallback?.estimatedTimeMin },
      });
      fetchActiveTrip();
    });

    socket.on('hospital_unavailable', (data) => {
      addEventLog('HOSPITAL_UNAVAILABLE', '⚠️ Primary Hospital Marked Unavailable! Auto-Rerouted to 2nd Nearest Hospital.');
      fetchActiveTrip();
    });

    socket.on('trip_status_changed', () => {
      fetchActiveTrip();
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user]);

  // Fetch current active trip
  const fetchActiveTrip = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/trips/active', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.trip) {
          setActiveTrip(data.trip);
          if (socketRef.current) socketRef.current.emit('join_room', `trip:${data.trip.id}`);
          if (data.trip.events) {
            setEventLogs(data.trip.events.map(e => ({
              id: e.id,
              type: e.eventType,
              message: e.message,
              time: new Date(e.createdAt).toLocaleTimeString(),
            })));
          }
        } else {
          setActiveTrip(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch active trip:', err);
    }
  };

  useEffect(() => {
    fetchActiveTrip();
  }, [token]);

  const addEventLog = (type, message) => {
    setEventLogs(prev => [
      {
        id: Math.random().toString(),
        type,
        message,
        time: new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);
  };

  // GPS Simulation Loop
  useEffect(() => {
    if (!isSimulationRunning || !activeTrip || !activeTrip.routeGeometryJson) {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      return;
    }

    let routePoints = [];
    try {
      routePoints = JSON.parse(activeTrip.routeGeometryJson);
    } catch (e) {
      return;
    }

    if (routePoints.length === 0) return;

    simIntervalRef.current = setInterval(() => {
      setSimulationIndex((prevIdx) => {
        const nextIdx = (prevIdx + 1) % routePoints.length;
        const currentCoord = routePoints[nextIdx];

        // Emit location socket event & call API
        if (socketRef.current && currentCoord) {
          socketRef.current.emit('update_ambulance_location', {
            tripId: activeTrip.id,
            ambulanceId: activeTrip.ambulanceId,
            lat: currentCoord[0],
            lng: currentCoord[1],
            speed: 48,
          });
        }

        // Auto complete when reaching end of route
        if (nextIdx === routePoints.length - 1) {
          setIsSimulationRunning(false);
          addEventLog('ARRIVED', '🚑 Ambulance arrived at Hospital Emergency Bay!');
        }

        return nextIdx;
      });
    }, 1500);

    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, [isSimulationRunning, activeTrip]);

  const startSimulation = () => setIsSimulationRunning(true);
  const pauseSimulation = () => setIsSimulationRunning(false);
  const resetSimulation = () => {
    setIsSimulationRunning(false);
    setSimulationIndex(0);
    fetchActiveTrip();
  };

  const triggerReroute = async (reason) => {
    if (!activeTrip || !token) return;
    try {
      const res = await fetch(`/api/trips/${activeTrip.id}/reroute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        const data = await res.json();
        addEventLog('REROUTED', `⚠️ Emergency Rerouted to ${data.fallback.hospitalName}!`);
        await fetchActiveTrip();
      }
    } catch (err) {
      console.error('Reroute error:', err);
    }
  };

  const toggleResponderLead = async (responderType, isCurrentlyLead) => {
    if (!token) return false;
    try {
      const actionType = isCurrentlyLead ? 'RELEASE_LEAD' : 'TAKE_LEAD';

      const roleKey = responderType === 'SERVICE_PROVIDER' ? 'SERVICE_PROVIDER' : 'TRAFFIC_POLICE';
      const tripRoleAlert = activeTrip?.responderAlerts?.find(a => {
        if (roleKey === 'SERVICE_PROVIDER') {
          return ['SERVICE_PROVIDER', 'FIRST_RESPONDER', 'COMMUNITY'].includes(a.responder?.type);
        }
        return a.responder?.type === 'TRAFFIC_POLICE';
      });

      const res = await fetch('/api/responders/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: actionType,
          responderType,
          tripId: activeTrip?.id,
          responderId: tripRoleAlert?.responderId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const respName = data.responder?.name || (responderType === 'SERVICE_PROVIDER' ? 'Service Provider' : 'Traffic Police Officer');
        const msg = actionType === 'TAKE_LEAD'
          ? `⭐ ${respName} HAS TAKEN LEAD & DISPATCHED EMERGENCY CORRIDOR CLEARANCE!`
          : `🔓 ${respName} RELEASED LEAD of Emergency Corridor`;
        addEventLog('TAKE_LEAD', msg);

        await fetchActiveTrip();
        return true;
      } else {
        const errData = await res.json().catch(() => ({}));
        triggerModalAlert({
          title: '❌ ACTION FAILED',
          message: errData.error || `Unable to ${actionType === 'TAKE_LEAD' ? 'take' : 'release'} lead.`,
          priority: 'WARNING',
        });
      }
    } catch (e) {
      console.error('Toggle lead error:', e);
    }
    return false;
  };

  const markCorridorCleared = async (responderType) => {
    if (!token) return false;
    try {
      const roleKey = responderType === 'SERVICE_PROVIDER' ? 'SERVICE_PROVIDER' : 'TRAFFIC_POLICE';
      const tripRoleAlert = activeTrip?.responderAlerts?.find(a => {
        if (roleKey === 'SERVICE_PROVIDER') {
          return ['SERVICE_PROVIDER', 'FIRST_RESPONDER', 'COMMUNITY'].includes(a.responder?.type);
        }
        return a.responder?.type === 'TRAFFIC_POLICE';
      });

      const res = await fetch('/api/responders/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'MARK_CLEARED',
          responderType,
          tripId: activeTrip?.id,
          responderId: tripRoleAlert?.responderId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const respName = data.responder?.name || (responderType === 'SERVICE_PROVIDER' ? 'Service Provider' : 'Traffic Police');
        addEventLog('MARK_CLEARED', `✅ ${respName} marked intersection/corridor CLEARED!`);
        await fetchActiveTrip();
        return true;
      }
    } catch (e) {
      console.error('Mark cleared error:', e);
    }
    return false;
  };

  const triggerDemoScenario = async (scenario) => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/demo-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scenario, tripId: activeTrip?.id }),
      });
      if (res.ok) {
        const data = await res.json();
        addEventLog('DEMO_TRIGGER', `🎬 Demo Trigger: ${scenario}`);
        await fetchActiveTrip();
        return data;
      }
    } catch (err) {
      console.error('Demo trigger error:', err);
    }
  };

  return (
    <EmergencyContext.Provider
      value={{
        activeTrip,
        corridorState,
        searchResult,
        eventLogs,
        isSimulationRunning,
        simulationIndex,
        allHospitals,
        clearedSignal,
        activeModalNotification,
        setActiveModalNotification,
        notifications,
        unreadCount,
        markNotificationRead,
        markAllNotificationsRead,
        fetchActiveTrip,
        startSimulation,
        pauseSimulation,
        resetSimulation,
        triggerReroute,
        triggerDemoScenario,
        toggleResponderLead,
        markCorridorCleared,
        addEventLog,
        triggerModalAlert,
      }}
    >
      {children}
    </EmergencyContext.Provider>
  );
}

export function useEmergency() {
  return useContext(EmergencyContext);
}
