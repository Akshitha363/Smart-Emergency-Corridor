import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EmergencyProvider, useEmergency } from './context/EmergencyContext';
import Navbar from './components/Navbar';
import EmergencyNotificationModal from './components/EmergencyNotificationModal';
import Login from './pages/Login';
import AmbulanceDashboard from './pages/AmbulanceDashboard';
import HospitalDashboard from './pages/HospitalDashboard';
import TrafficDashboard from './pages/TrafficDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ProviderDashboard from './pages/ProviderDashboard';

function MainRouter() {
  const { user, loading } = useAuth();
  const { activeModalNotification, setActiveModalNotification, markNotificationRead } = useEmergency();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-mono text-sm">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-red-500 animate-ping" />
          <span>LOADING CODE PULSE PORTAL...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderDashboardByRole = () => {
    switch (user.role) {
      case 'AMBULANCE':
        return <AmbulanceDashboard />;
      case 'HOSPITAL':
        return <HospitalDashboard />;
      case 'TRAFFIC':
        return <TrafficDashboard />;
      case 'SERVICE_PROVIDER':
        return <ProviderDashboard />;
      case 'ADMIN':
        return <AdminDashboard />;
      default:
        return <AmbulanceDashboard />;
    }
  };

  const handleAcknowledge = () => {
    if (activeModalNotification?.id) {
      markNotificationRead(activeModalNotification.id);
    }
    setActiveModalNotification(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <main className="flex-1">
        {renderDashboardByRole()}
      </main>

      {/* Centered Global Emergency Notification Modal */}
      {activeModalNotification && (
        <EmergencyNotificationModal
          notification={activeModalNotification}
          onAcknowledge={handleAcknowledge}
          onClose={() => setActiveModalNotification(null)}
        />
      )}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Portal Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 text-2xl font-bold font-mono">
            ⚠️
          </div>
          <h2 className="text-xl font-bold font-mono text-white">PORTAL RECOVERY MODE</h2>
          <p className="text-xs text-slate-400 max-w-md">
            An unexpected rendering error occurred. Details below:
          </p>
          {this.state.error && (
            <div className="text-[11px] font-mono text-red-300 bg-red-950/80 p-3 rounded-xl border border-red-800 max-w-lg overflow-auto text-left w-full space-y-1">
              <div className="font-bold text-red-400">{this.state.error.name}: {this.state.error.message}</div>
              <div className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                {this.state.error.stack}
              </div>
            </div>
          )}
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = '/';
            }}
            className="bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs font-mono transition-all shadow-lg shadow-red-600/30"
          >
            🔄 RESET SESSION & RELOAD PORTAL
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <EmergencyProvider>
          <MainRouter />
        </EmergencyProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
