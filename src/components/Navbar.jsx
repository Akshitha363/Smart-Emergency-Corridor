import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useEmergency } from '../context/EmergencyContext';
import NotificationCenter from './NotificationCenter';
import { Activity, Shield, Hospital, Navigation, UserCheck, LogOut, Radio } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { activeTrip, isSimulationRunning, notifications, unreadCount, markNotificationRead, markAllNotificationsRead } = useEmergency();

  const getRoleBadge = (role) => {
    switch (role) {
      case 'AMBULANCE':
        return { label: 'Ambulance Crew', bg: 'bg-red-500/20 text-red-400 border-red-500/40', icon: Navigation };
      case 'HOSPITAL':
        return { label: 'Hospital Emergency Dept', bg: 'bg-teal-500/20 text-teal-400 border-teal-500/40', icon: Hospital };
      case 'TRAFFIC':
        return { label: 'Traffic Police Officer', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/40', icon: Shield };
      case 'SERVICE_PROVIDER':
        return { label: 'Service Provider / Rescue', bg: 'bg-orange-500/20 text-orange-400 border-orange-500/40', icon: Activity };
      case 'ADMIN':
        return { label: 'Command Admin', bg: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40', icon: UserCheck };
      default:
        return { label: role, bg: 'bg-slate-700 text-slate-300 border-slate-600', icon: Activity };
    }
  };

  const badge = user ? getRoleBadge(user.role) : null;
  const RoleIcon = badge ? badge.icon : Activity;

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Brand Logo & Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-red-500 flex items-center justify-center shadow-lg shadow-red-500/30">
            <Activity className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white font-mono">
                CODE<span className="text-red-500">PULSE</span>
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
                LIVE
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase hidden sm:block">
              EVERY SECOND. EVERY SIGNAL. EVERY LIFE.
            </p>
          </div>
        </div>

        {/* Active Emergency Status Indicator */}
        {activeTrip && (
          <div className="hidden md:flex items-center gap-3 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-lg text-xs">
            <div className="flex items-center gap-2">
              <Radio className={`w-4 h-4 ${isSimulationRunning ? 'text-red-500 animate-ping' : 'text-amber-400'}`} />
              <span className="font-mono font-semibold text-slate-200">
                TRIP: {activeTrip.tripCode}
              </span>
            </div>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300 font-medium">
              {activeTrip.patient?.condition} ({activeTrip.patient?.priority})
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-teal-400 font-medium truncate max-w-[160px]">
              ➜ {activeTrip.hospital?.name?.split('(')[0]}
            </span>
          </div>
        )}

        {/* User Info & Role Badge & Notification Bell */}
        {user && (
          <div className="flex items-center gap-3 sm:gap-4">
            <NotificationCenter
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkRead={markNotificationRead}
              onMarkAllRead={markAllNotificationsRead}
            />

            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.bg}`}>
                <RoleIcon className="w-3.5 h-3.5" />
                <span>{badge.label}</span>
              </div>
              <div className="hidden lg:block text-right text-xs">
                <div className="font-medium text-slate-200">{user.name}</div>
                <div className="text-[10px] text-slate-400">{user.station || user.email}</div>
              </div>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}

      </div>
    </header>
  );
}
