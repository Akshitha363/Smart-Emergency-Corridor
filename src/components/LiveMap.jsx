import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEmergency } from '../context/EmergencyContext';
import { Shield, Navigation, Hospital, AlertTriangle, Locate } from 'lucide-react';

// Custom Leaflet Icons Helper
const createCustomIcon = (color, svgIcon) => {
  if (typeof window === 'undefined' || !L || !L.divIcon) return null;
  return L.divIcon({
    className: 'custom-map-marker',
    html: `<div style="
      background-color: ${color};
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 15px ${color};
      border: 2px solid #ffffff;
      color: white;
      font-size: 18px;
    ">${svgIcon}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

// Map Recenter Controller Component
function MapRecenter({ center, triggerRecenter }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.panTo(center, { animate: true, duration: 1.0 });
    }
  }, [center, triggerRecenter, map]);
  return null;
}

export default function LiveMap() {
  const { activeTrip, corridorState } = useEmergency();
  const [responders, setResponders] = useState([]);
  const [recenterCount, setRecenterCount] = useState(0);

  // Memoize Leaflet custom markers
  const ambulanceIcon = useMemo(() => createCustomIcon('#ef4444', '🚑'), []);
  const hospitalIcon = useMemo(() => createCustomIcon('#0d9488', '🏥'), []);
  const policeIconAvailable = useMemo(() => createCustomIcon('#3b82f6', '👮'), []);
  const policeIconLead = useMemo(() => createCustomIcon('#22c55e', '⭐'), []);
  const providerIconAvailable = useMemo(() => createCustomIcon('#f97316', '🛠'), []);
  const providerIconLead = useMemo(() => createCustomIcon('#ea580c', '⭐'), []);
  const bottleneckIcon = useMemo(() => createCustomIcon('#f59e0b', '🚧'), []);

  useEffect(() => {
    fetch('/api/responders', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('codepulse_token')}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setResponders(data.responders || []))
      .catch((err) => console.error('Failed to fetch responders:', err));
  }, [corridorState]);

  // Current ambulance coordinates
  const ambLat = Number(corridorState?.lat || activeTrip?.ambulance?.currentLat || 17.4447);
  const ambLng = Number(corridorState?.lng || activeTrip?.ambulance?.currentLng || 78.3854);

  // Hospital coordinates
  const hospLat = Number(activeTrip?.destLat || activeTrip?.hospital?.lat || 17.4262);
  const hospLng = Number(activeTrip?.destLng || activeTrip?.hospital?.lng || 78.4116);

  // Search radius (in km)
  const activeRadiusKm = activeTrip?.currentCorridorRangeKm || 1.0;
  const activeRadiusMeters = activeRadiusKm * 1000;

  // Parse route polyline
  let routePolyline = [];
  if (activeTrip?.routeGeometryJson) {
    try {
      routePolyline = JSON.parse(activeTrip.routeGeometryJson);
    } catch (e) {
      console.error('Error parsing route geometry:', e);
    }
  }

  // Fallback route line between ambulance and hospital if geometry JSON is missing
  if (routePolyline.length === 0 && ambLat && ambLng && hospLat && hospLng) {
    routePolyline = [
      [ambLat, ambLng],
      [hospLat, hospLng],
    ];
  }

  return (
    <div className="relative w-full h-[520px] rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Live Navigation Header Bar */}
      <div className="absolute top-4 left-4 right-4 z-[1000] bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-xl shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/50 flex items-center justify-center text-blue-400 font-bold shrink-0">
            <Navigation className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="font-bold text-white text-xs font-mono flex items-center gap-2">
              <span>📍 DESTINATION: {activeTrip?.hospital?.name || 'Apollo Hospitals Jubilee Hills'}</span>
              <span className="text-[10px] bg-red-950 text-red-300 px-2 py-0.5 rounded border border-red-800 font-mono font-semibold">
                CORRIDOR RADIUS: {activeRadiusKm} KM
              </span>
            </div>
            <div className="text-[11px] text-slate-300 font-mono flex flex-wrap items-center gap-3 mt-1">
              <span>
                ETA: <strong className="text-teal-400 font-bold">{corridorState?.progress?.estimatedEtaMin || (activeTrip ? Math.round((activeTrip.estimatedTimeSec || 360) / 60) : 6)} MINS</strong>
              </span>
              <span>
                Distance: <strong className="text-white font-bold">{corridorState?.progress?.remainingKm || (activeTrip ? (activeTrip.estimatedDistanceMeters / 1000).toFixed(1) : 4.2)} KM</strong>
              </span>
              <span>
                Speed: <strong className="text-red-400 font-bold">{corridorState?.speed || activeTrip?.ambulance?.speed || 48} km/h</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setRecenterCount((c) => c + 1)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-md"
          >
            <Locate className="w-3.5 h-3.5" />
            <span>Recenter Ambulance</span>
          </button>
        </div>
      </div>

      {/* Reroute Alert Banner */}
      {activeTrip?.status === 'REROUTED' && (
        <div className="absolute top-20 right-4 z-[1000] bg-amber-950/90 border border-amber-500/80 text-amber-200 p-3 rounded-lg text-xs max-w-xs shadow-xl animate-bounce">
          <div className="flex items-center gap-2 font-bold font-mono">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>⚠️ DESTINATION REROUTED</span>
          </div>
          <p className="mt-1 text-[11px] text-amber-300">
            Route automatically rerouted to <strong>{activeTrip.hospital.name}</strong>.
          </p>
        </div>
      )}

      {/* Leaflet Map */}
      <MapContainer
        center={[ambLat, ambLng]}
        zoom={14}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapRecenter center={[ambLat, ambLng]} triggerRecenter={recenterCount} />

        {/* 1. Emergency Route Lines */}
        {routePolyline.length > 0 && (
          <>
            <Polyline
              positions={routePolyline}
              color="#1e40af"
              weight={10}
              opacity={0.4}
            />
            <Polyline
              positions={routePolyline}
              color="#2563eb"
              weight={6}
              opacity={0.95}
              dashArray="8, 12"
            />
          </>
        )}

        {/* 2. Dynamic Emergency Corridor Radius Circle */}
        <Circle
          center={[ambLat, ambLng]}
          radius={activeRadiusMeters}
          pathOptions={{
            color: activeRadiusKm > 2.0 ? '#ef4444' : '#3b82f6',
            fillColor: activeRadiusKm > 2.0 ? '#ef4444' : '#3b82f6',
            fillOpacity: 0.12,
            dashArray: '5, 5',
          }}
        />

        {/* 3. Ambulance Marker */}
        <Marker position={[ambLat, ambLng]} icon={ambulanceIcon}>
          <Popup>
            <div className="p-1 text-xs">
              <div className="font-bold text-red-400 font-mono">
                🚑 AMBULANCE ({activeTrip?.ambulance?.callSign || 'AMB-108-HYD'})
              </div>
              <div className="text-slate-300 mt-1">
                Driver: {activeTrip?.ambulance?.driverName || 'Suresh Kumar'}
              </div>
              <div className="text-slate-400">
                ETA to Hospital: <strong className="text-teal-400">{corridorState?.progress?.estimatedEtaMin || 6} mins</strong>
              </div>
            </div>
          </Popup>
        </Marker>

        {/* 4. Destination Hospital Marker */}
        {activeTrip?.hospital && (
          <Marker position={[hospLat, hospLng]} icon={hospitalIcon}>
            <Popup>
              <div className="p-1 text-xs">
                <div className="font-bold text-teal-400">{activeTrip.hospital.name}</div>
                <div className="text-slate-300 mt-1">
                  Readiness: <span className="text-green-400 font-semibold">{activeTrip.hospital.readinessStatus}</span>
                </div>
                <div className="text-slate-400">
                  Available ICU Beds: <strong>{activeTrip.hospital.availableIcuBeds}</strong>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* 5. Responders Markers */}
        {responders.map((resp) => {
          const isLead = resp.status === 'TAKEN_LEAD' || resp.status === 'ON_SITE';
          const isProvider = resp.type === 'SERVICE_PROVIDER' || resp.type === 'FIRST_RESPONDER' || resp.type === 'COMMUNITY';

          let icon = policeIconAvailable;
          if (isProvider) {
            icon = isLead ? providerIconLead : providerIconAvailable;
          } else {
            icon = isLead ? policeIconLead : policeIconAvailable;
          }

          return (
            <Marker key={resp.id} position={[resp.lat, resp.lng]} icon={icon}>
              <Popup>
                <div className="p-1 text-xs">
                  <div className={`font-bold flex items-center gap-1 ${isProvider ? 'text-orange-400' : 'text-blue-400'}`}>
                    <Shield className="w-3.5 h-3.5" />
                    {resp.name}
                  </div>
                  <div className="text-slate-300 mt-1 font-mono">
                    Type: <strong>{isProvider ? 'SERVICE PROVIDER' : 'TRAFFIC POLICE'}</strong> | Badge: {resp.badgeNumber}
                  </div>
                  <div className="text-slate-400">
                    Status: <strong className={isLead ? 'text-green-400' : 'text-amber-400'}>{resp.status}</strong>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 6. Traffic Bottlenecks */}
        {activeTrip?.bottlenecks?.map((b) => (
          <Marker key={b.id} position={[b.lat, b.lng]} icon={bottleneckIcon}>
            <Popup>
              <div className="p-1 text-xs">
                <div className="font-bold text-amber-400">🚧 {b.name}</div>
                <div className="text-slate-300 mt-1">
                  Severity: <span className="text-red-400 font-bold">{b.severity}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
