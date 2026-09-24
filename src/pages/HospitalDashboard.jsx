import React, { useState, useEffect } from 'react';
import { useEmergency } from '../context/EmergencyContext';
import { useAuth } from '../context/AuthContext';
import LiveMap from '../components/LiveMap';
import EventLogFeed from '../components/EventLogFeed';
import { Hospital, CheckCircle2, XCircle, Activity, Bed, ShieldCheck, X } from 'lucide-react';

export default function HospitalDashboard() {
  const { token, user } = useAuth();
  const { activeTrip, fetchActiveTrip, addEventLog, triggerModalAlert } = useEmergency();
  const [readinessStatus, setReadinessStatus] = useState('READY');
  const [availableIcu, setAvailableIcu] = useState(8);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('ICU / Emergency Dept Capacity Full');

  const patient = activeTrip?.patient;

  const handlePreAlertAction = async (action, customReason = null) => {
    if (!activeTrip || !token) return;
    try {
      const alertId = activeTrip.hospitalAlerts && activeTrip.hospitalAlerts.length > 0
        ? activeTrip.hospitalAlerts[0].id
        : null;

      if (!alertId) return;

      const res = await fetch(`/api/hospitals/pre-alert/${alertId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, reason: customReason || rejectionReason }),
      });

      if (res.ok) {
        const data = await res.json();
        if (action === 'REJECT') {
          addEventLog('HOSPITAL_REJECT', `🚨 Intake REJECTED. Automatic backend fallback selected next hospital: ${data.rerouteResult?.fallback?.hospitalName || 'Fallback Facility'}`);
          triggerModalAlert({
            title: '🚨 INTAKE REJECTED',
            message: `Emergency pre-alert rejected. Automatic fallback matched next best hospital without manual driver prompt.`,
            priority: 'WARNING',
          });
        } else if (action === 'ACCEPT') {
          addEventLog('HOSPITAL_ACCEPT', `✅ Intake ACCEPTED for ${patient?.condition || 'Emergency'} patient.`);
          triggerModalAlert({
            title: '✅ INTAKE ACCEPTED',
            message: `Trauma team notified. Emergency bay prepared for arrival.`,
            priority: 'SUCCESS',
          });
        }
        setIsRejectModalOpen(false);
        await fetchActiveTrip();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateReadiness = async (status) => {
    setReadinessStatus(status);
    if (!token || !user?.hospitalId) return;
    try {
      await fetch(`/api/hospitals/${user.hospitalId}/readiness`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ readinessStatus: status, availableIcuBeds: availableIcu }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 space-y-6">
      
      {/* Top Header & Hospital Status Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600/20 border border-teal-500/40 flex items-center justify-center">
            <Hospital className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono text-white flex items-center gap-2">
              HOSPITAL EMERGENCY DEPARTMENT (ER)
              <span className="text-xs font-sans font-normal px-2.5 py-0.5 bg-teal-950 text-teal-300 border border-teal-800 rounded-full">
                {user?.station || 'Apollo Hospitals Jubilee Hills'}
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-sans">
              Real-time incoming ambulance pre-alerts, live vitals telemetry & ER readiness coordination
            </p>
          </div>
        </div>

        {/* ER Readiness Status Toggle */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
          <span className="text-slate-400 font-mono font-semibold px-2">ER STATUS:</span>
          
          <button
            onClick={() => handleUpdateReadiness('READY')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              readinessStatus === 'READY'
                ? 'bg-green-600 text-white shadow-lg shadow-green-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ✅ READY
          </button>

          <button
            onClick={() => handleUpdateReadiness('BUSY')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              readinessStatus === 'BUSY'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🟡 BUSY
          </button>

          <button
            onClick={() => handleUpdateReadiness('FULL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              readinessStatus === 'FULL'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🔴 FULL
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Incoming Ambulance Pre-Alert Card */}
        <div className="space-y-6">
          
          {activeTrip && patient ? (
            <div className="bg-slate-900 border border-teal-500/40 rounded-2xl p-5 shadow-2xl space-y-4">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-red-400 font-bold font-mono text-sm">
                  <Activity className="w-4 h-4 animate-pulse" />
                  <span>INCOMING AMBULANCE PRE-ALERT</span>
                </div>
                <span className="text-xs bg-red-950 text-red-400 border border-red-800 px-2.5 py-0.5 rounded-full font-mono font-bold">
                  {patient.priority}
                </span>
              </div>

              {/* Patient Quick Overview */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Patient ID: <strong className="text-white font-mono">{patient.patientIdStr}</strong></span>
                  <span className="text-xs text-slate-400">Blood Group: <strong className="text-red-400 font-mono">{patient.bloodGroup}</strong></span>
                </div>
                <div className="text-base font-bold text-white">
                  {patient.age}Y {patient.gender} — <span className="text-red-400">{patient.condition}</span>
                </div>
                <p className="text-xs text-slate-300 bg-slate-900 p-2 rounded border border-slate-800">
                  "{patient.symptoms}"
                </p>
              </div>

              {/* Required Resources */}
              <div className="text-xs space-y-1.5 font-mono">
                <div className="text-slate-400 text-[10px] uppercase">REQUIRED MEDICAL RESOURCES:</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="bg-teal-950 text-teal-300 border border-teal-800 px-2.5 py-1 rounded-md font-semibold">
                    🩺 Emergency Trauma Team
                  </span>
                  <span className="bg-teal-950 text-teal-300 border border-teal-800 px-2.5 py-1 rounded-md font-semibold">
                    🛏️ ICU Bed Reserved
                  </span>
                </div>
              </div>

              {/* Pre-Alert Action Buttons */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                  HOSPITAL INTAKE ACTION:
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePreAlertAction('ACCEPT')}
                    className="flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all shadow-lg shadow-teal-600/30"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ACCEPT AMBULANCE</span>
                  </button>

                  <button
                    onClick={() => handlePreAlertAction('MARK_READY')}
                    className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all shadow-lg shadow-emerald-600/30"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>MARK BAY READY</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsRejectModalOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/40 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all"
                >
                  <XCircle className="w-4 h-4" />
                  <span>REJECT INTAKE (TRIGGER AUTOMATIC REROUTE)</span>
                </button>
              </div>

            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
              <Hospital className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-300">NO INCOMING PRE-ALERTS</h3>
              <p className="text-xs text-slate-500">Standing by for incoming emergency ambulance dispatches.</p>
            </div>
          )}

          <EventLogFeed />
        </div>

        {/* Right 2 Columns: Live Map showing incoming ambulance route */}
        <div className="lg:col-span-2 space-y-6">
          <LiveMap />
        </div>

      </div>

      {/* Rejection Reason Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-base">Reject Emergency Intake</h3>
              <button onClick={() => setIsRejectModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Rejecting this pre-alert will immediately trigger the backend automated hospital matcher to find and reroute the ambulance to the next best hospital.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Rejection Reason</label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              >
                <option value="ICU / Emergency Dept Capacity Full">ICU / Emergency Dept Capacity Full</option>
                <option value="Required Medical Specialist Unavailable">Required Medical Specialist Unavailable</option>
                <option value="Required Equipment (Cath Lab / CT / MRI) In Maintenance">Required Equipment In Maintenance</option>
                <option value="Critical Blood Supply Shortage">Critical Blood Supply Shortage</option>
              </select>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePreAlertAction('REJECT', rejectionReason)}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg"
              >
                CONFIRM REJECT
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
