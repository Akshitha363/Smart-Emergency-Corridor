import React from 'react';
import { useEmergency } from '../context/EmergencyContext';
import { Heart, Activity, Thermometer, Wind, AlertCircle } from 'lucide-react';

export default function VitalsMonitor() {
  const { liveVitals, activeTrip } = useEmergency();

  const patient = activeTrip?.patient;
  const hr = liveVitals?.heartRate || patient?.heartRate || 108;
  const spo2 = liveVitals?.spO2 || patient?.spO2 || 92;
  const sysBp = liveVitals?.sysBp || patient?.sysBp || 115;
  const diaBp = liveVitals?.diaBp || patient?.diaBp || 75;
  const temp = liveVitals?.temp || patient?.temp || 98.6;
  const resp = liveVitals?.respRate || patient?.respRate || 18;

  const isHrCritical = hr > 120 || hr < 50;
  const isSpo2Critical = spo2 < 92;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-slate-200">
            LIVE VITALS STREAM (IoT MONITORED)
          </h2>
        </div>
        {(isHrCritical || isSpo2Critical) && (
          <div className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-950/80 px-2 py-0.5 rounded border border-red-800 animate-pulse">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>CRITICAL VITALS WARNING</span>
          </div>
        )}
      </div>

      {/* Simulated ECG Sweep Graphic */}
      <div className="my-3 bg-slate-950 rounded-lg p-2 border border-slate-800/80 overflow-hidden relative h-16 flex items-center">
        <svg className="w-full h-12 stroke-red-500 fill-none stroke-2" viewBox="0 0 500 50">
          <path
            d="M 0,25 L 50,25 L 60,10 L 70,40 L 80,5 L 90,45 L 100,25 L 200,25 L 210,10 L 220,40 L 230,5 L 240,45 L 250,25 L 350,25 L 360,10 L 370,40 L 380,5 L 390,45 L 400,25 L 500,25"
            className="ecg-line"
          />
        </svg>
      </div>

      {/* Vitals Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
        
        {/* Heart Rate */}
        <div className={`p-3 rounded-lg border ${isHrCritical ? 'bg-red-950/40 border-red-500/60' : 'bg-slate-800/60 border-slate-700/60'}`}>
          <div className="flex items-center justify-center gap-1 text-slate-400 text-xs font-medium">
            <Heart className="w-3.5 h-3.5 text-red-500 animate-bounce" />
            <span>HEART RATE</span>
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-red-400">
            {hr} <span className="text-xs font-normal text-slate-400">BPM</span>
          </div>
        </div>

        {/* SpO2 */}
        <div className={`p-3 rounded-lg border ${isSpo2Critical ? 'bg-amber-950/40 border-amber-500/60' : 'bg-slate-800/60 border-slate-700/60'}`}>
          <div className="flex items-center justify-center gap-1 text-slate-400 text-xs font-medium">
            <Activity className="w-3.5 h-3.5 text-teal-400" />
            <span>SpO2</span>
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-teal-300">
            {spo2}<span className="text-xs font-normal text-slate-400">%</span>
          </div>
        </div>

        {/* Blood Pressure */}
        <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center justify-center gap-1 text-slate-400 text-xs font-medium">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>BLOOD PRESSURE</span>
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-blue-300">
            {sysBp}/{diaBp}
          </div>
        </div>

        {/* Temperature */}
        <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center justify-center gap-1 text-slate-400 text-xs font-medium">
            <Thermometer className="w-3.5 h-3.5 text-amber-400" />
            <span>TEMP</span>
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-amber-300">
            {temp}<span className="text-xs font-normal text-slate-400">°F</span>
          </div>
        </div>

        {/* Respiratory Rate */}
        <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-center gap-1 text-slate-400 text-xs font-medium">
            <Wind className="w-3.5 h-3.5 text-emerald-400" />
            <span>RESP RATE</span>
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-emerald-300">
            {resp} <span className="text-xs font-normal text-slate-400">/m</span>
          </div>
        </div>

      </div>

    </div>
  );
}
