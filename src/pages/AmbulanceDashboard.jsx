import React, { useState, useEffect, useRef } from 'react';
import { useEmergency } from '../context/EmergencyContext';
import { useAuth } from '../context/AuthContext';
import LiveMap from '../components/LiveMap';
import EventLogFeed from '../components/EventLogFeed';
import PatientIntakeModal from '../components/PatientIntakeModal';
import { Navigation, PlusCircle, CheckCircle2, ShieldCheck, Hospital, AlertOctagon, Check, AlertTriangle, Radio, MapPin } from 'lucide-react';

export default function AmbulanceDashboard() {
  const { token } = useAuth();
  const {
    activeTrip,
    corridorState,
    searchResult,
    resetSimulation,
    clearedSignal,
    fetchActiveTrip,
  } = useEmergency();

  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [gpsCoords, setGpsCoords] = useState(null);

  const watchIdRef = useRef(null);

  const patient = activeTrip?.patient;
  const hospital = activeTrip?.hospital;

  // Real Geolocation Tracking
  useEffect(() => {
    if (isGpsActive && 'geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, speed, heading, accuracy } = position.coords;
          setGpsCoords({ lat: latitude, lng: longitude, speed: speed || 45, heading, accuracy });
          setGpsError(null);

          if (activeTrip && token) {
            fetch(`/api/trips/${activeTrip.id}/location`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                lat: latitude,
                lng: longitude,
                speed: Math.round((speed || 12) * 3.6),
              }),
            }).catch((err) => console.error('Failed to send GPS location update:', err));
          }
        },
        (err) => {
          console.warn('Geolocation error:', err.message);
          setGpsError(err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 10000,
        }
      );
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isGpsActive, activeTrip, token]);

  const handleCompleteTrip = async () => {
    if (!activeTrip || !token) return;
    try {
      const res = await fetch(`/api/trips/${activeTrip.id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        resetSimulation();
        fetchActiveTrip();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 space-y-6">
      
      {/* Top Action & Command Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center shrink-0">
            <Navigation className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono text-white flex items-center gap-2">
              AMBULANCE COMMAND COCKPIT
              <span className="text-xs font-sans font-normal px-2.5 py-0.5 bg-red-950 text-red-400 border border-red-800 rounded-full">
                {activeTrip?.ambulance?.callSign || 'AMB-108-HYD'}
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-sans">
              Real-time route navigation, dynamic corridor creation & automated hospital pre-alerts
            </p>
          </div>
        </div>

        {/* Action Controls & GPS Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Real GPS Geolocation Toggle */}
          <button
            onClick={() => setIsGpsActive(!isGpsActive)}
            className={`flex items-center gap-2 font-bold py-2.5 px-3.5 rounded-xl border text-xs transition-all ${
              isGpsActive
                ? 'bg-emerald-950 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-950/50'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className={`w-4 h-4 ${isGpsActive ? 'text-emerald-400 animate-pulse' : ''}`} />
            <span>{isGpsActive ? 'REAL GPS ACTIVE' : 'ENABLE BROWSER GPS'}</span>
          </button>

          <button
            onClick={() => setIsIntakeOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg shadow-red-950/50"
          >
            <PlusCircle className="w-4 h-4" />
            <span>NEW PATIENT INTAKE</span>
          </button>

          {activeTrip && (
            <button
              onClick={handleCompleteTrip}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg shadow-emerald-950/50"
            >
              <Check className="w-4 h-4" />
              <span>ARRIVED / COMPLETE TRIP</span>
            </button>
          )}
        </div>
      </div>

      {/* GPS Status Indicator Banner */}
      {isGpsActive && (
        <div className="bg-slate-900/90 border border-emerald-500/40 p-3 rounded-xl text-xs flex items-center justify-between text-emerald-300">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>
              <strong>REAL GEOLOCATION LIVE:</strong> {gpsCoords ? `Lat ${gpsCoords.lat.toFixed(4)}, Lng ${gpsCoords.lng.toFixed(4)} (Accuracy ±${Math.round(gpsCoords.accuracy || 10)}m)` : 'Acquiring satellite signal...'}
            </span>
          </div>
          {gpsError && <span className="text-red-400 font-semibold">{gpsError}</span>}
        </div>
      )}

      {/* Route & Corridor Cleared Signal Banner */}
      {(clearedSignal || activeTrip?.responderAlerts?.some(r => r.status === 'ACCEPTED')) && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-green-950 border border-emerald-500/60 p-4 rounded-2xl text-xs flex items-center justify-between text-emerald-200 shadow-2xl animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 text-emerald-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>🟢 EMERGENCY CORRIDOR ACKNOWLEDGED & CLEARED</span>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-400/30">
                  CLEAR ROUTE
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Traffic officer / Service responder confirmed clearance ahead. Proceed at high priority speed!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Patient & Hospital Status Bar */}
      {activeTrip ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Patient Details Card */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-950 border border-red-800 flex items-center justify-center shrink-0 text-red-400 font-mono font-bold text-sm">
              {patient?.priority === 'CRITICAL' ? '🔴' : '🟠'}
            </div>
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">PATIENT ASSESSMENT</div>
              <div className="font-bold text-slate-100 text-sm mt-0.5">
                {patient?.age}Y {patient?.gender} ({patient?.bloodGroup}) — <span className="text-red-400">{patient?.condition}</span>
              </div>
              <div className="text-xs text-slate-400 mt-1 line-clamp-1">
                {patient?.symptoms}
              </div>
            </div>
          </div>

          {/* Hospital Pre-Alert Status */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-950 border border-teal-800 flex items-center justify-center shrink-0 text-teal-400">
              <Hospital className="w-5 h-5" />
            </div>
            <div className="w-full">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">DESTINATION HOSPITAL</div>
              <div className="font-bold text-slate-100 text-sm mt-0.5 truncate">
                {hospital?.name}
              </div>
              {activeTrip.status === 'REROUTED' ? (
                <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold mt-1">
                  <AlertTriangle className="w-4 h-4 animate-bounce" />
                  <span>⚠️ AUTOMATICALLY REROUTED TO NEXT HOSPITAL</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-green-400 font-semibold mt-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>✅ HOSPITAL PRE-ALERT ACTIVE</span>
                </div>
              )}
            </div>
          </div>

          {/* Corridor Responder Search Status */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-800 flex items-center justify-center shrink-0 text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">ACTIVE SEARCH RADIUS</div>
              <div className="font-bold text-slate-100 text-sm mt-0.5">
                <span className="text-blue-400">Radius: {activeTrip.currentCorridorRangeKm || 1.0} KM</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                ETA to ER: <strong className="text-teal-400 font-mono">{corridorState?.progress?.estimatedEtaMin || Math.round((activeTrip.estimatedTimeSec || 360)/60)} mins</strong>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="bg-slate-900 border border-dashed border-slate-800 p-6 rounded-2xl text-center">
          <AlertOctagon className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-300">NO ACTIVE EMERGENCY TRIP</h3>
          <p className="text-xs text-slate-500 mt-1">Click "NEW PATIENT INTAKE" above to initiate a live emergency route.</p>
        </div>
      )}

      {/* Main Grid: Live Map, Vitals Monitor & Event Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Live Map */}
        <div className="lg:col-span-2 space-y-6">
          <LiveMap />
        </div>

        {/* Right Col: Event Log (No Admin Demo Controls!) */}
        <div className="space-y-6">
          <EventLogFeed />
        </div>

      </div>

      {/* Patient Intake Modal */}
      <PatientIntakeModal isOpen={isIntakeOpen} onClose={() => setIsIntakeOpen(false)} />

    </div>
  );
}
