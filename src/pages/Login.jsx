import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, Navigation, Hospital, Shield, UserCheck, ArrowRight, Lock } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('ambulance@codepulse.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('password123');
    login(demoEmail, 'password123').catch((err) => setError(err.message));
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-red-500 flex items-center justify-center mx-auto shadow-lg shadow-red-600/40 mb-3">
            <Activity className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-black font-mono tracking-tight text-white">
            CODE<span className="text-red-500">PULSE</span>
          </h1>
          <p className="text-[11px] text-slate-400 font-mono tracking-widest uppercase mt-1">
            EVERY SECOND. EVERY SIGNAL. EVERY LIFE.
          </p>
        </div>

        {error && (
          <div className="bg-red-950/60 border border-red-500/50 text-red-300 text-xs p-3 rounded-xl mb-4 font-medium text-center">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-red-500 transition-colors font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-red-500 transition-colors font-mono"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 text-sm mt-2"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Login Selector */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase text-center mb-3">
            SELECT DEMO ROLE FOR EVALUATION:
          </div>

          <div className="grid grid-cols-2 gap-2">
            
            <button
              onClick={() => handleQuickLogin('ambulance@codepulse.com')}
              className="flex items-center gap-2 bg-slate-800/80 hover:bg-red-950/40 hover:border-red-500/50 border border-slate-700/80 p-2.5 rounded-xl text-left transition-all"
            >
              <Navigation className="w-4 h-4 text-red-400 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-200">Ambulance</div>
                <div className="text-[9px] text-slate-400 font-mono">Driver / Nurse</div>
              </div>
            </button>

            <button
              onClick={() => handleQuickLogin('hospital@codepulse.com')}
              className="flex items-center gap-2 bg-slate-800/80 hover:bg-teal-950/40 hover:border-teal-500/50 border border-slate-700/80 p-2.5 rounded-xl text-left transition-all"
            >
              <Hospital className="w-4 h-4 text-teal-400 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-200">Hospital ER</div>
                <div className="text-[9px] text-slate-400 font-mono">Emergency Dept</div>
              </div>
            </button>

            <button
              onClick={() => handleQuickLogin('police@codepulse.com')}
              className="flex items-center gap-2 bg-slate-800/80 hover:bg-amber-950/40 hover:border-amber-500/50 border border-slate-700/80 p-2.5 rounded-xl text-left transition-all"
            >
              <Shield className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-200">Traffic Police</div>
                <div className="text-[9px] text-slate-400 font-mono">Corridor Responder</div>
              </div>
            </button>

            <button
              onClick={() => handleQuickLogin('admin@codepulse.com')}
              className="flex items-center gap-2 bg-slate-800/80 hover:bg-indigo-950/40 hover:border-indigo-500/50 border border-slate-700/80 p-2.5 rounded-xl text-left transition-all"
            >
              <UserCheck className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-200">Admin</div>
                <div className="text-[9px] text-slate-400 font-mono">Command Center</div>
              </div>
            </button>

            <button
              onClick={() => handleQuickLogin('provider@codepulse.com')}
              className="flex items-center gap-2 bg-slate-800/80 hover:bg-orange-950/40 hover:border-orange-500/50 border border-slate-700/80 p-2.5 rounded-xl text-left transition-all col-span-2 sm:col-span-1"
            >
              <Activity className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-200">Service Provider</div>
                <div className="text-[9px] text-slate-400 font-mono">First Responder / Tow</div>
              </div>
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}
