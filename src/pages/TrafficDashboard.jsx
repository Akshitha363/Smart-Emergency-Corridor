import React, { useState, useEffect } from 'react';
import { useEmergency } from '../context/EmergencyContext';
import LiveMap from '../components/LiveMap';
import EventLogFeed from '../components/EventLogFeed';
import { Shield, CheckCircle2, AlertTriangle, Radio, Navigation, Eye, Check, Clock } from 'lucide-react';

export default function TrafficDashboard() {
  const { activeTrip, corridorState, searchResult, toggleResponderLead, markCorridorCleared } = useEmergency();
  const [responders, setResponders] = useState([]);
  const [isLeadTaken, setIsLeadTaken] = useState(false);
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
      const policeAlert = activeTrip.responderAlerts.find(a => a.responder?.type === 'TRAFFIC_POLICE');
      if (policeAlert) {
        setIsLeadTaken(policeAlert.status === 'ACCEPTED' || policeAlert.responder?.status === 'TAKEN_LEAD');
        setIsCleared(policeAlert.status === 'ON_SITE' || policeAlert.responder?.status === 'ON_SITE');
        return;
      }
    }
    setIsLeadTaken(false);
    setIsCleared(false);
  }, [corridorState, activeTrip]);

  const handleTakeLead = async () => {
    const success = await toggleResponderLead('TRAFFIC_POLICE', isLeadTaken);
    if (success) {
      setIsLeadTaken(!isLeadTaken);
      fetchResponders();
    }
  };

  const handleMarkCleared = async () => {
    const success = await markCorridorCleared('TRAFFIC_POLICE');
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
          <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono text-white flex items-center gap-2">
              TRAFFIC RESPONSE COORDINATION COMMAND
              <span className="text-xs font-sans font-normal px-2.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded-full">
                SECTOR 4 CYBERABAD
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-sans">
              Layer 1 Official Traffic Response & Dynamic Corridor Clearance
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowMapRoute(!showMapRoute)}
          className={`flex items-center gap-2 font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg ${
            showMapRoute
              ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>{showMapRoute ? 'HIDE ROUTE MAP' : '👁️ VIEW ROUTE MAP'}</span>
        </button>
      </div>

      {/* Corridor Alert Status */}
      {activeTrip && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-red-950 border border-amber-500/40 p-4 rounded-xl text-xs flex items-center justify-between text-amber-200 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0 text-amber-400 font-bold">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2 font-mono">
                <span>🚨 UPCOMING JUNCTION: IKEA FLYOVER JUNCTION</span>
                <span className="text-[10px] bg-red-950 text-red-300 px-2 py-0.5 rounded border border-red-800 font-semibold">
                  RADIUS: {activeTrip.currentCorridorRangeKm || 1.0} KM
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Ambulance {ambulance?.callSign || 'AMB-108-HYD'} approaching. Priority clearance required. ETA: <strong>{corridorState?.progress?.estimatedEtaMin || 6} MINS</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Active Emergency Corridor Alert & Officer Actions */}
        <div className="space-y-6">
          
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-bold font-mono text-sm text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                <span>TRAFFIC CORRIDOR DISPATCH</span>
              </div>
              <span className="text-xs bg-amber-950 text-amber-300 border border-amber-800 px-2.5 py-0.5 rounded-full font-mono font-bold">
                PRIORITY 1
              </span>
            </div>

            {activeTrip ? (
              <div className="space-y-3 text-xs">
                
                {/* Ambulance Details */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400 font-mono">Vehicle: <strong className="text-white font-bold">{ambulance?.callSign || 'AMB-108-HYD'}</strong></span>
                    <span className="text-slate-400 font-mono">Driver: <strong className="text-teal-400 font-semibold">{ambulance?.driverName || 'Suresh Kumar'}</strong></span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Speed: <strong className="text-red-400 font-mono">{corridorState?.speed || 48} km/h</strong></span>
                    <span className="text-slate-400">ETA: <strong className="text-teal-400 font-mono">{corridorState?.progress?.estimatedEtaMin || 6} mins</strong></span>
                  </div>

                  {patient && (
                    <div className="bg-red-950/40 border border-red-900/60 p-2.5 rounded-lg text-slate-200 text-xs">
                      <div className="font-bold text-red-400">
                        Patient: {patient.age}Y {patient.gender} — {patient.condition} [{patient.priority}]
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        Symptoms: "{patient.symptoms}"
                      </div>
                    </div>
                  )}

                  <div className="text-xs font-bold text-white flex items-center gap-1.5 pt-1">
                    <Navigation className="w-4 h-4 text-red-500" />
                    <span>Corridor: Gachibowli ➔ {hospital?.name || 'Apollo Jubilee Hills'}</span>
                  </div>
                </div>

                {/* Primary Officer Action Box */}
                <div className="pt-2 space-y-2">
                  <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                    OFFICER RESPONSE ACTIONS:
                  </div>

                  {isLeadTaken && (
                    <div className="bg-emerald-950/80 border border-emerald-500/60 p-2.5 rounded-xl text-emerald-300 text-xs font-bold font-mono flex items-center justify-center gap-2 shadow-lg animate-pulse">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>✓ YOU ARE LEADING THIS EMERGENCY CORRIDOR</span>
                    </div>
                  )}

                  <button
                    onClick={() => handleTakeLead()}
                    className={`w-full flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-xl text-xs transition-all shadow-lg ${
                      isLeadTaken
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-600/30'
                        : 'bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white shadow-green-600/30'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isLeadTaken ? 'RELEASE CORRIDOR LEAD' : '⭐ TAKE LEAD & CLEAR CORRIDOR'}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleMarkCleared()}
                      className={`flex items-center justify-center gap-1 font-semibold py-2.5 px-3 rounded-xl border text-xs transition-all ${
                        isCleared
                          ? 'bg-green-950 text-green-300 border-green-700'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span>{isCleared ? 'AREA CLEARED ✅' : 'MARK AREA CLEARED'}</span>
                    </button>

                    <button
                      onClick={() => setShowMapRoute(!showMapRoute)}
                      className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold py-2.5 px-3 rounded-xl border border-slate-700 text-xs transition-all"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
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
              <div className="w-16 h-16 rounded-2xl bg-amber-950/60 border border-amber-700/50 flex items-center justify-center text-amber-400 shadow-xl">
                <Shield className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-base font-bold text-white font-mono">TRAFFIC POLICE COMMAND CENTER</h3>
                <p className="text-xs text-slate-400">
                  Click "VIEW ROUTE MAP" button above to view live ambulance trajectory & map details.
                </p>
              </div>
              <button
                onClick={() => setShowMapRoute(true)}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-6 rounded-xl text-xs transition-all shadow-lg shadow-amber-600/30"
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
