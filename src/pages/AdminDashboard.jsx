import React, { useState, useEffect } from 'react';
import { useEmergency } from '../context/EmergencyContext';
import { useAuth } from '../context/AuthContext';
import LiveMap from '../components/LiveMap';
import EventLogFeed from '../components/EventLogFeed';
import DemoControls from '../components/DemoControls';
import { UserCheck, Activity, Hospital, Shield, Sliders, Save, CheckCircle2, Settings } from 'lucide-react';

export default function AdminDashboard() {
  const { token } = useAuth();
  const { addEventLog } = useEmergency();
  const [metrics, setMetrics] = useState(null);
  const [config, setConfig] = useState({
    initialRadiusKm: 1.0,
    radiusStepKm: 1.0,
    maxRadiusKm: 5.0,
    reminderIntervalSec: 30,
    escalationTimeoutSec: 30,
    maxHospitalFallbackAttempts: 5,
  });

  const [weights, setWeights] = useState({
    specialty: 0.35,
    travelTime: 0.25,
    icu: 0.15,
    equipment: 0.10,
    blood: 0.10,
    readiness: 0.05,
  });

  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/analytics', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.metrics) setMetrics(data.metrics);
        if (data.weights) setWeights(data.weights);
        if (data.config) {
          setConfig({
            initialRadiusKm: data.config.initialRadiusKm || 1.0,
            radiusStepKm: data.config.radiusStepKm || 1.0,
            maxRadiusKm: data.config.maxRadiusKm || 5.0,
            reminderIntervalSec: data.config.reminderIntervalSec || 30,
            escalationTimeoutSec: data.config.escalationTimeoutSec || 30,
            maxHospitalFallbackAttempts: data.config.maxHospitalFallbackAttempts || 5,
          });
          if (data.config.weights) setWeights(data.config.weights);
        }
      })
      .catch((err) => console.error(err));
  }, [token]);

  const handleWeightChange = (key, val) => {
    setWeights((prev) => ({ ...prev, [key]: parseFloat(val) }));
  };

  const handleConfigChange = (key, val) => {
    setConfig((prev) => ({ ...prev, [key]: parseFloat(val) }));
  };

  const handleSaveConfig = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...config,
          weights,
        }),
      });

      if (res.ok) {
        setSavedMsg(true);
        addEventLog('ADMIN_CONFIG_SAVED', '⚙️ System operational parameters & hospital weights persisted by Admin.');
        setTimeout(() => setSavedMsg(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono text-white flex items-center gap-2">
              CENTRAL COMMAND & ANALYTICS CONTROL CENTER
              <span className="text-xs font-sans font-normal px-2.5 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-full">
                ADMIN PORTAL
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-sans">
              System-wide emergency analytics, operational configuration & live demo controller
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl">
          <div className="text-xs text-slate-400 font-mono">TOTAL EMERGENCY TRIPS</div>
          <div className="text-2xl font-black font-mono text-white mt-1">
            {metrics?.totalTrips || 12}
          </div>
          <div className="text-[10px] text-teal-400 font-mono mt-1">Active: {metrics?.activeTrips || 1}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl">
          <div className="text-xs text-slate-400 font-mono">AVG RESPONSE TIME</div>
          <div className="text-2xl font-black font-mono text-teal-400 mt-1">
            4.2 <span className="text-xs text-slate-400">mins</span>
          </div>
          <div className="text-[10px] text-green-400 font-mono mt-1">⚡ 38% faster than baseline</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl">
          <div className="text-xs text-slate-400 font-mono">HOSPITAL READINESS</div>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {metrics?.readyHospitals || 4} / {metrics?.totalHospitals || 5} <span className="text-xs text-slate-400">Hospitals</span>
          </div>
          <div className="text-[10px] text-emerald-400 font-mono mt-1">Ready for Emergency Intake</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl">
          <div className="text-xs text-slate-400 font-mono">CORRIDOR CLEARANCE</div>
          <div className="text-2xl font-black font-mono text-blue-400 mt-1">
            94.8%
          </div>
          <div className="text-[10px] text-blue-400 font-mono mt-1">Active Responders: {metrics?.availableResponders || 4}</div>
        </div>

      </div>

      {/* Main Grid: Map & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Map & Weights Configurator */}
        <div className="lg:col-span-2 space-y-6">
          <LiveMap />

          {/* Configurable Operational Parameters & Hospital Weights */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-6">
            
            {/* System Parameters Panel */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-bold font-mono tracking-wider text-slate-200 uppercase">
                    RESPONDER ESCALATION & SYSTEM PARAMETERS
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Initial Search Radius (KM)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="5.0"
                    value={config.initialRadiusKm}
                    onChange={(e) => handleConfigChange('initialRadiusKm', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Max Search Radius (KM)</label>
                  <input
                    type="number"
                    step="1.0"
                    min="2.0"
                    max="10.0"
                    value={config.maxRadiusKm}
                    onChange={(e) => handleConfigChange('maxRadiusKm', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">30s Reminder Interval (Sec)</label>
                  <input
                    type="number"
                    step="5"
                    min="10"
                    max="120"
                    value={config.reminderIntervalSec}
                    onChange={(e) => handleConfigChange('reminderIntervalSec', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Weights Panel */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-bold font-mono tracking-wider text-slate-200 uppercase">
                    SMART HOSPITAL MATCHING WEIGHT CONFIGURATOR
                  </h2>
                </div>
                {savedMsg && (
                  <span className="text-xs text-green-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> SAVED!
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                
                <div>
                  <div className="flex justify-between text-slate-300 font-semibold mb-1">
                    <span>Medical Specialty</span>
                    <span className="font-mono text-indigo-400">{Math.round(weights.specialty * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.60"
                    step="0.05"
                    value={weights.specialty}
                    onChange={(e) => handleWeightChange('specialty', e.target.value)}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 font-semibold mb-1">
                    <span>Travel Time</span>
                    <span className="font-mono text-indigo-400">{Math.round(weights.travelTime * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.60"
                    step="0.05"
                    value={weights.travelTime}
                    onChange={(e) => handleWeightChange('travelTime', e.target.value)}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 font-semibold mb-1">
                    <span>ICU Availability</span>
                    <span className="font-mono text-indigo-400">{Math.round(weights.icu * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.50"
                    step="0.05"
                    value={weights.icu}
                    onChange={(e) => handleWeightChange('icu', e.target.value)}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 font-semibold mb-1">
                    <span>Required Equipment</span>
                    <span className="font-mono text-indigo-400">{Math.round(weights.equipment * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.40"
                    step="0.05"
                    value={weights.equipment}
                    onChange={(e) => handleWeightChange('equipment', e.target.value)}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 font-semibold mb-1">
                    <span>Blood Availability</span>
                    <span className="font-mono text-indigo-400">{Math.round(weights.blood * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.40"
                    step="0.05"
                    value={weights.blood}
                    onChange={(e) => handleWeightChange('blood', e.target.value)}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 font-semibold mb-1">
                    <span>Hospital Readiness</span>
                    <span className="font-mono text-indigo-400">{Math.round(weights.readiness * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="0.30"
                    step="0.01"
                    value={weights.readiness}
                    onChange={(e) => handleWeightChange('readiness', e.target.value)}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveConfig}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all shadow-lg shadow-indigo-600/30"
                >
                  <Save className="w-4 h-4" />
                  <span>PERSIST SYSTEM CONFIG & WEIGHTS</span>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Right Col: Demo Controls & Event Logs */}
        <div className="space-y-6">
          <DemoControls />
          <EventLogFeed />
        </div>

      </div>

    </div>
  );
}
