import React from 'react';
import { useEmergency } from '../context/EmergencyContext';
import { useAuth } from '../context/AuthContext';
import { Clock, ShieldAlert, CheckCircle, AlertTriangle, ArrowRightLeft, Radio } from 'lucide-react';

export default function EventLogFeed() {
  const { eventLogs } = useEmergency();
  const { user } = useAuth();

  const filteredLogs = eventLogs.filter((log) => {
    const role = user?.role;
    if (!role || role === 'ADMIN' || role === 'AMBULANCE') return true;

    const type = log.type || '';
    const msg = log.message || '';

    if (role === 'HOSPITAL') {
      // Exclude Police and Service Provider events from Hospital log
      if (
        type.startsWith('RESPONDER_') ||
        type.startsWith('TRAFFIC_') ||
        type.startsWith('SERVICE_PROVIDER_') ||
        type === 'WAY_CLEARED' ||
        type === 'ALERT_SENT' ||
        type === 'RESPONDER_FOUND' ||
        msg.includes('Traffic') ||
        msg.includes('Service Provider') ||
        msg.includes('Police') ||
        msg.includes('corridor') ||
        msg.includes('TAKEN LEAD') ||
        msg.includes('Released Lead') ||
        msg.includes('intersection')
      ) {
        return false;
      }
      return true;
    }

    if (role === 'TRAFFIC' || role === 'SERVICE_PROVIDER') {
      // Both Traffic Police and Service Provider receive the SAME real-time emergency event log!
      // Exclude internal Hospital-only events
      if (
        type.startsWith('HOSPITAL_') ||
        msg.includes('Hospital') ||
        msg.includes('Intake') ||
        msg.includes('ER bay')
      ) {
        return false;
      }
      return true;
    }

    return true;
  });

  const getEventBadge = (type) => {
    switch (type) {
      case 'RESPONDER_ASSIGNED':
      case 'RESPONDER_TAKE_LEAD':
        return { icon: CheckCircle, color: 'text-green-400 border-green-500/40 bg-green-950/40' };
      case 'HOSPITAL_REROUTED':
      case 'REROUTED':
        return { icon: ArrowRightLeft, color: 'text-amber-400 border-amber-500/40 bg-amber-950/40' };
      case 'TRAFFIC_BOTTLENECK_DETECTED':
      case 'HOSPITAL_UNAVAILABLE':
        return { icon: AlertTriangle, color: 'text-red-400 border-red-500/40 bg-red-950/40' };
      case 'ALERT_SENT':
      case 'RESPONDER_FOUND':
        return { icon: Radio, color: 'text-blue-400 border-blue-500/40 bg-blue-950/40' };
      default:
        return { icon: ShieldAlert, color: 'text-slate-300 border-slate-700 bg-slate-800/60' };
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl h-full flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-bold font-mono tracking-wider uppercase text-slate-200">
            REAL-TIME EMERGENCY EVENT LOG
          </h2>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
          {filteredLogs.length} EVENTS
        </span>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto max-h-[360px] space-y-2 pr-1">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 font-mono">
            No events recorded yet. Initiate an emergency trip to start log stream.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const badge = getEventBadge(log.type);
            const Icon = badge.icon;

            return (
              <div
                key={log.id}
                className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 transition-all ${badge.color}`}
              >
                <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-0.5">
                    <span className="font-bold tracking-wide">{log.type}</span>
                    <span>{log.time}</span>
                  </div>
                  <p className="text-slate-200 leading-snug font-sans">{log.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
