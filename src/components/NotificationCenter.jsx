import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, ShieldAlert, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export default function NotificationCenter({ notifications = [], unreadCount = 0, onMarkRead, onMarkAllRead }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white transition-all"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-extrabold text-white shadow-lg animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          
          {/* Header */}
          <div className="p-3.5 px-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-rose-500" />
              <h4 className="font-bold text-sm text-slate-100">Notification Center</h4>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800 text-xs font-semibold">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center space-x-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No notifications recorded
              </div>
            ) : (
              notifications.map((item) => {
                let priorityIcon = <Info className="w-4 h-4 text-blue-400" />;
                if (item.priority === 'CRITICAL') priorityIcon = <ShieldAlert className="w-4 h-4 text-red-400" />;
                else if (item.priority === 'WARNING') priorityIcon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
                else if (item.priority === 'SUCCESS') priorityIcon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;

                return (
                  <div
                    key={item.id}
                    onClick={() => !item.read && onMarkRead && onMarkRead(item.id)}
                    className={`p-3.5 transition-colors flex items-start space-x-3 cursor-pointer ${
                      item.read ? 'bg-slate-900/40 opacity-75' : 'bg-slate-800/40 hover:bg-slate-800/80 border-l-4 border-l-rose-500'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">{priorityIcon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 truncate">{item.title}</span>
                        <span className="text-[10px] text-slate-500">{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-normal">
                        {item.message}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}
    </div>
  );
}
