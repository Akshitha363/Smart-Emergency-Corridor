import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Info, X, Navigation, Hospital, Shield, Clock, MapPin } from 'lucide-react';

export default function EmergencyNotificationModal({ notification, onAcknowledge, onClose, onViewTrip, onAccept, onReject }) {
  if (!notification) return null;

  const { title, message, priority = 'CRITICAL', metadata, type } = notification;

  // Determine priority styling
  let bgHeader = 'bg-red-600/95 border-red-500 text-white';
  let IconComponent = ShieldAlert;

  if (priority === 'WARNING') {
    bgHeader = 'bg-amber-600/95 border-amber-500 text-white';
    IconComponent = AlertTriangle;
  } else if (priority === 'SUCCESS') {
    bgHeader = 'bg-emerald-600/95 border-emerald-500 text-white';
    IconComponent = CheckCircle2;
  } else if (priority === 'INFO') {
    bgHeader = 'bg-blue-600/95 border-blue-500 text-white';
    IconComponent = Info;
  }

  // Check if this is WAY_CLEARED or HOSPITAL_INCOMING_AMBULANCE
  const isWayCleared = type === 'WAY_CLEARED' || notification.type === 'WAY_CLEARED';
  const isHospitalIncoming = type === 'HOSPITAL_INCOMING_AMBULANCE' || notification.type === 'HOSPITAL_INCOMING_AMBULANCE';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">
        
        {/* Modal Header */}
        <div className={`p-4 flex items-center justify-between border-b ${bgHeader}`}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-black/20 rounded-xl">
              <IconComponent className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest font-bold opacity-90 font-mono">CODE PULSE EMERGENCY ALERT</span>
              <h3 className="text-lg font-extrabold leading-tight">{title || 'Emergency Notification'}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <p className="text-slate-200 text-sm leading-relaxed font-medium">
            {message}
          </p>

          {/* Specialized Display for WAY CLEARED */}
          {isWayCleared && metadata && (
            <div className="bg-emerald-950/80 p-4 rounded-xl border border-emerald-500/50 space-y-2 text-xs">
              <div className="flex items-center justify-between text-emerald-300">
                <span className="text-slate-400">Cleared By:</span>
                <strong className="text-white font-bold">{metadata.clearedBy || 'Traffic Police / Service Provider'}</strong>
              </div>
              <div className="flex items-center justify-between text-emerald-300">
                <span className="text-slate-400">Location:</span>
                <strong className="text-emerald-300 font-mono">{metadata.location || 'IKEA Junction / Corridor Ahead'}</strong>
              </div>
              <div className="flex items-center justify-between text-emerald-300">
                <span className="text-slate-400">Time:</span>
                <strong className="text-white font-mono">{metadata.time || new Date().toLocaleTimeString()}</strong>
              </div>
            </div>
          )}

          {/* Specialized Display for HOSPITAL INCOMING AMBULANCE */}
          {isHospitalIncoming && metadata && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Ambulance CallSign:</span>
                <strong className="text-red-400 font-mono font-bold text-sm">{metadata.ambulanceCallSign}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Patient Priority:</span>
                <span className="text-xs bg-red-950 text-red-400 border border-red-800 px-2 py-0.5 rounded font-bold font-mono">
                  {metadata.patientPriority || 'CRITICAL'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Condition:</span>
                <strong className="text-white font-semibold">{metadata.condition}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ETA / Distance:</span>
                <strong className="text-teal-400 font-mono">{metadata.etaMin} mins ({metadata.distanceKm} KM)</strong>
              </div>
            </div>
          )}

          {/* General Metadata Display */}
          {!isWayCleared && !isHospitalIncoming && metadata && (
            <div className="grid grid-cols-2 gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs">
              {metadata.ambulanceCallSign && (
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Ambulance</span>
                  <span className="font-semibold text-slate-100 font-mono">{metadata.ambulanceCallSign}</span>
                </div>
              )}

              {metadata.distanceKm !== undefined && (
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Distance</span>
                  <span className="font-semibold text-slate-100 font-mono">{metadata.distanceKm} KM</span>
                </div>
              )}

              {metadata.etaMin !== undefined && (
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Estimated ETA</span>
                  <span className="font-semibold text-teal-400 font-mono">{metadata.etaMin} mins</span>
                </div>
              )}

              {metadata.newHospitalName && (
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">New Hospital</span>
                  <span className="font-semibold text-teal-400 font-mono">{metadata.newHospitalName}</span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            {isHospitalIncoming ? (
              <>
                <button
                  onClick={onReject}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-400 font-bold text-xs border border-slate-700 transition-colors"
                >
                  REJECT
                </button>
                <button
                  onClick={onAccept}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold shadow-lg shadow-teal-950/50 transition-all active:scale-95"
                >
                  ACCEPT INTAKE
                </button>
              </>
            ) : isWayCleared ? (
              <button
                onClick={onAcknowledge}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all active:scale-95"
              >
                OK / PROCEED
              </button>
            ) : (
              <button
                onClick={onAcknowledge}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-red-950/50 transition-all active:scale-95"
              >
                ACKNOWLEDGE
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
