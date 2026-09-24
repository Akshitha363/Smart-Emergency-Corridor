import React, { useState, useEffect } from 'react';
import { useEmergency } from '../context/EmergencyContext';
import LiveMap from '../components/LiveMap';
import EventLogFeed from '../components/EventLogFeed';
import { Activity, CheckCircle2, AlertTriangle, Radio, Navigation, Eye, Check, Truck, ShieldAlert } from 'lucide-react';

export default function ProviderDashboard() {
  const { activeTrip, corridorState, toggleResponderLead, markCorridorCleared } = useEmergency();
  const [responders, setResponders] = useState([]);
  const [isDispatched, setIsDispatched] = useState(false);
  const [isCleared, setIsCleared] = useState(false);
  const [showMapRoute, setShowMapRoute] = useState(true);

  const fetchResponders = () => {
    fetch('/api/responders', {
      headers: { Authorization: `Bearer ${localStorage.getItem('codepulse_token')}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setResponders(data.responders || []);
      })
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    fetchResponders();
    if (activeTrip?.responderAlerts) {
      const providerAlert = activeTrip.responderAlerts.find(a =>
        ['SERVICE_PROVIDER', 'FIRST_RESPONDER', 'COMMUNITY'].includes(a.responder?.type)
      );
      if (providerAlert) {
        setIsDispatched(providerAlert.status === 'ACCEPTED' || providerAlert.responder?.status === 'TAKEN_LEAD');
        setIsCleared(providerAlert.status === 'ON_SITE' || providerAlert.responder?.status === 'ON_SITE');
        return;
      }
    }
    setIsDispatched(false);
    setIsCleared(false);
  }, [corridorState, activeTrip]);

  const handleTakeLead = async () => {
    const success = await toggleResponderLead('SERVICE_PROVIDER', isDispatched);
    if (success) {
      setIsDispatched(!isDispatched);
      fetchResponders();
    }
  };

  const handleMarkCleared = async () => {
    const success = await markCorridorCleared('SERVICE_PROVIDER');
    if (success) {
      setIsCleared(true);
      fetchResponders();
    }
  };

  const patient = activeTrip?.patient;
  const ambulance = activeTrip?.ambulance;
  const hospital = activeTrip?.hospital;

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center">
            <Activity className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono text-white flex items-center gap-2">
              SERVICE PROVIDER & FIRST RESPONDER DISPATCH
              <span className="text-xs font-sans font-normal px-2.5 py-0.5 bg-orange-950 text-orange-300 border border-orange-800 rounded-full">
                CYBERABAD RESCUE UNIT
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-sans">
              Highway Emergency Rescue, Towing & First Responder Corridor Clearance
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowMapRoute(!showMapRoute)}
          className={`flex items-center gap-2 font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg ${
            showMapRoute
              ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-600/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
        >
          <Eye className="w-4 h-4 text-orange-400" />
          <span>{showMapRoute ? 'HIDE ROUTE MAP' : '👁️ VIEW ROUTE MAP'}</span>
        </button>
      </div>

      {/* Corridor Alert Status */}
      {activeTrip && (
        <div className="bg-gradient-to-r from-orange-950 via-slate-900 to-amber-950 border border-orange-500/40 p-4 rounded-xl text-xs flex items-center justify-between text-orange-200 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-400/40 flex items-center justify-center shrink-0 text-orange-400 font-bold">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2 font-mono">
                <span>🚨 SERVICE PROVIDER CORRIDOR DISPATCH</span>
                <span className="text-[10px] bg-orange-950 text-orange-300 px-2 py-0.5 rounded border border-orange-800 font-semibold">
                  RADIUS: {activeTrip.currentCorridorRangeKm || 1.0} KM
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Ambulance {ambulance?.callSign || 'AMB-108-HYD'} en route along highway corridor. Standby for traffic & towing support.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Active Emergency Corridor Alert & Service Provider Actions */}
        <div className="space-y-6">
          
          <div className="bg-slate-900 border border-orange-500/40 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-bold font-mono text-sm text-orange-400">
                <AlertTriangle className="w-4 h-4" />
                <span>SERVICE DISPATCH ALERT</span>
              </div>
              <span className="text-xs bg-orange-950 text-orange-300 border border-orange-800 px-2.5 py-0.5 rounded-full font-mono font-bold">
                PRIORITY 1
              </span>
            </div>

            {activeTrip ? (
              <div className="space-y-3 text-xs">
                
                {/* Ambulance Live Details */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400 font-mono">Vehicle: <strong className="text-white font-bold">{ambulance?.callSign || 'AMB-108-HYD'}</strong></span>
                    <span className="text-slate-400 font-mono">Driver: <strong className="text-orange-400 font-semibold">{ambulance?.driverName || 'Suresh Kumar'}</strong></span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Driver Phone: <strong className="text-slate-200 font-mono">{ambulance?.contactNumber || '+91 98765 43210'}</strong></span>
                    <span className="text-slate-400">Speed: <strong className="text-red-400 font-mono">{corridorState?.speed || 48} km/h</strong></span>
                  </div>

                  {patient && (
                    <div className="bg-orange-950/40 border border-orange-900/60 p-2.5 rounded-lg text-slate-200 text-xs">
                      <div className="font-bold text-orange-400">
                        Patient: {patient.age}Y {patient.gender} — {patient.condition} [{patient.priority}]
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        Symptoms: "{patient.symptoms}"
                      </div>
                    </div>
                  )}

                  <div className="text-xs font-bold text-white flex items-center gap-1.5 pt-1">
                    <Navigation className="w-4 h-4 text-orange-500" />
                    <span>Corridor: Gachibowli ➔ {hospital?.name || 'Apollo Jubilee Hills'}</span>
                  </div>
                </div>

                {/* Service Provider Action Box */}
                <div className="pt-2 space-y-2">
                  <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                    SERVICE PROVIDER RESPONSE KEYS:
                  </div>

                  {isDispatched && (
                    <div className="bg-orange-950/80 border border-orange-500/60 p-2.5 rounded-xl text-orange-300 text-xs font-bold font-mono flex items-center justify-center gap-2 shadow-lg animate-pulse">
                      <CheckCircle2 className="w-4 h-4 text-orange-400" />
                      <span>✓ SUPPORT LEAD ACTIVE & RESCUE DISPATCHED</span>
                    </div>
                  )}

                  <button
                    onClick={() => handleTakeLead()}
                    className={`w-full flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-xl text-xs transition-all shadow-lg ${
                      isDispatched
                        ? 'bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white shadow-orange-600/30'
                        : 'bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white shadow-orange-600/30'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isDispatched ? 'RELEASE SUPPORT LEAD' : '⭐ TAKE LEAD & DISPATCH RESCUE'}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleMarkCleared()}
                      className={`flex items-center justify-center gap-1 font-semibold py-2.5 px-3 rounded-xl border text-xs transition-all ${
                        isCleared
                          ? 'bg-orange-950 text-orange-300 border-orange-700'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span>{isCleared ? 'CORRIDOR CLEARED ✅' : 'MARK CORRIDOR CLEARED'}</span>
                    </button>

                    <button
                      onClick={() => setShowMapRoute(!showMapRoute)}
                      className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold py-2.5 px-3 rounded-xl border border-slate-700 text-xs transition-all"
                    >
                      <Eye className="w-3.5 h-3.5 text-orange-400" />
                      <span>{showMapRoute ? 'HIDE MAP' : 'VIEW ROUTE'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-500 font-mono">
                No active emergency corridor alert pending.
              </div>
            )}
          </div>

          <EventLogFeed />
        </div>

        {/* Right 2 Cols: Live Map */}
        <div className="lg:col-span-2 space-y-6">
          {showMapRoute ? (
            <LiveMap />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-xl flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-16 h-16 rounded-2xl bg-orange-950/60 border border-orange-700/50 flex items-center justify-center text-orange-400 shadow-xl">
                <Truck className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-base font-bold text-white font-mono">SERVICE PROVIDER DISPATCH CONTROL</h3>
                <p className="text-xs text-slate-400">
                  Click "VIEW ROUTE MAP" button above to view live ambulance trajectory & map details.
                </p>
              </div>
              <button
                onClick={() => setShowMapRoute(true)}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-6 rounded-xl text-xs transition-all shadow-lg shadow-orange-600/30"
              >
                <Eye className="w-4 h-4" />
                <span>👁️ VIEW EMERGENCY ROUTE MAP</span>
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
