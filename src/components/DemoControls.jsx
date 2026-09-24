import React from 'react';
import { useEmergency } from '../context/EmergencyContext';
import { Play, Pause, RotateCcw, AlertTriangle, ShieldAlert, UserCheck, Hospital, HeartPulse, Sliders } from 'lucide-react';

export default function DemoControls() {
  const {
    isSimulationRunning,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    triggerDemoScenario,
  } = useEmergency();

  return (
    <div className="bg-slate-900 border border-red-500/30 rounded-xl p-4 shadow-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/20">
      
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center">
            <Sliders className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-100">
              ADMIN DEMO CONTROL CENTER
            </h3>
            <p className="text-[10px] text-slate-400 font-sans">
              Interactive scenario simulator for judges and live demonstrations
            </p>
          </div>
        </div>
      </div>

      {/* Main Simulation Controls */}
      <div className="grid grid-cols-3 gap-2 my-3">
        {!isSimulationRunning ? (
          <button
            onClick={startSimulation}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all shadow-lg shadow-red-600/30"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>START DEMO</span>
          </button>
        ) : (
          <button
            onClick={pauseSimulation}
            className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all shadow-lg shadow-amber-600/30"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span>PAUSE DEMO</span>
          </button>
        )}

        <button
          onClick={resetSimulation}
          className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2 px-3 rounded-lg text-xs border border-slate-700 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>RESET</span>
        </button>

        <button
          onClick={() => triggerDemoScenario('RESET_DEMO')}
          className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 px-3 rounded-lg text-xs border border-slate-700 transition-all"
        >
          <span>CLEAR ALL</span>
        </button>
      </div>

      {/* Scenario Action Buttons */}
      <div className="space-y-1.5 pt-2 border-t border-slate-800">
        <div className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase mb-1">
          TEST IMPORTANT EMERGENCY SCENARIOS:
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          
          {/* Traffic Bottleneck */}
          <button
            onClick={() => triggerDemoScenario('SIMULATE_TRAFFIC_CONGESTION')}
            className="flex items-center gap-2 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-500/40 p-2 rounded-lg text-xs font-semibold transition-colors text-left"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div>
              <div className="leading-tight">Simulate Traffic Jam</div>
              <div className="text-[10px] font-normal text-amber-400/80">Detect congestion 1.2km ahead</div>
            </div>
          </button>

          {/* No Responder Available */}
          <button
            onClick={() => triggerDemoScenario('SIMULATE_NO_RESPONDER')}
            className="flex items-center gap-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/40 p-2 rounded-lg text-xs font-semibold transition-colors text-left"
          >
            <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
            <div>
              <div className="leading-tight">No Responder (0–2 km)</div>
              <div className="text-[10px] font-normal text-red-400/80">Expand range to 2–3 km</div>
            </div>
          </button>

          {/* Officer Available */}
          <button
            onClick={() => triggerDemoScenario('SIMULATE_RESPONDER_AVAILABLE')}
            className="flex items-center gap-2 bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 border border-blue-500/40 p-2 rounded-lg text-xs font-semibold transition-colors text-left"
          >
            <UserCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div>
              <div className="leading-tight">Officer Available</div>
              <div className="text-[10px] font-normal text-blue-400/80">Inspector Rajesh takes lead</div>
            </div>
          </button>

          {/* Hospital Full / Unavailable */}
          <button
            onClick={() => triggerDemoScenario('SIMULATE_HOSPITAL_UNAVAILABLE')}
            className="flex items-center gap-2 bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-500/40 p-2 rounded-lg text-xs font-semibold transition-colors text-left"
          >
            <Hospital className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <div>
              <div className="leading-tight">Hospital Unavailable</div>
              <div className="text-[10px] font-normal text-purple-400/80">Auto reroute to best fallback</div>
            </div>
          </button>

          {/* Vital Spike */}
          <button
            onClick={() => triggerDemoScenario('SIMULATE_VITAL_CHANGE')}
            className="flex items-center gap-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 p-2 rounded-lg text-xs font-semibold transition-colors text-left"
          >
            <HeartPulse className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <div>
              <div className="leading-tight">Simulate Vital Spike</div>
              <div className="text-[10px] font-normal text-rose-400/80">Heart rate 135 BPM | SpO2 88%</div>
            </div>
          </button>

        </div>
      </div>

    </div>
  );
}
