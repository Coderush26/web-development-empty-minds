'use client';

import { useState } from 'react';
import { X, Navigation, Anchor, Play, MapPin } from 'lucide-react';

interface ShipDetailsPopoverProps {
  ship: any;
  onClose: () => void;
  isCaptainView?: boolean;
  onIssueDirective?: (shipId: string, type: string, payload: any) => void;
}

const PORTS = [
  { id: 'KWT-1', name: 'Kuwait City' },
  { id: 'BUS-1', name: 'Bushehr' },
  { id: 'DMM-1', name: 'Dammam' },
  { id: 'BAH-1', name: 'Manama' },
  { id: 'DOH-1', name: 'Doha' },
  { id: 'AUH-1', name: 'Abu Dhabi' },
  { id: 'DXB-1', name: 'Jebel Ali' },
  { id: 'BND-1', name: 'Bandar Abbas' },
  { id: 'SOH-1', name: 'Sohar' },
  { id: 'MCT-1', name: 'Muscat' },
];

export function ShipDetailsPopover({
  ship,
  onClose,
  isCaptainView = false,
  onIssueDirective,
}: ShipDetailsPopoverProps) {
  const [showDirectivePanel, setShowDirectivePanel] = useState(false);
  const [selectedPort, setSelectedPort] = useState('');

  if (!ship) return null;

  const getStatusColor = (status: string) => {
    if (status === 'critical' || status === 'distressed' || status === 'out_of_fuel')
      return 'bg-red-500/20 border-red-500 text-red-400';
    if (status === 'warning' || status === 'rerouting' || status === 'insufficient_fuel')
      return 'bg-orange-500/20 border-orange-500 text-orange-400';
    if (status === 'arrived') return 'bg-blue-500/20 border-blue-500 text-blue-400';
    if (status === 'stopped' || status === 'stranded')
      return 'bg-slate-500/20 border-slate-500 text-slate-400';
    return 'bg-green-500/20 border-green-500 text-green-400';
  };

  const position = Array.isArray(ship.position)
    ? ship.position
    : ship.position?.lat !== undefined && ship.position?.lng !== undefined
    ? [ship.position.lat, ship.position.lng]
    : [0, 0];

  const fuelPercent = Math.min(
    100,
    Math.max(0, ((typeof ship.fuel === 'number' ? ship.fuel : 0) / 10000) * 100)
  );
  const fuelColor = fuelPercent < 30 ? 'bg-red-500' : fuelPercent < 60 ? 'bg-orange-500' : 'bg-emerald-500';

  const handleIssueDirective = (type: string, payload: any = {}) => {
    if (onIssueDirective) {
      onIssueDirective(ship.shipId, type, payload);
      setShowDirectivePanel(false);
    }
  };

  return (
    <div className="absolute bottom-6 left-6 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl z-40 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-slate-700/50">
        <div>
          <h3 className="text-lg font-bold text-white">{ship.name}</h3>
          <p className="text-sm text-slate-400">{String(ship.cargo).toUpperCase()}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Status Badge */}
      <div className="px-4 pt-3">
        <div
          className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider inline-block ${getStatusColor(ship.status)}`}
        >
          {String(ship.status).replace(/_/g, ' ')}
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Position:</span>
          <span className="text-white font-mono text-xs">
            {position[0].toFixed(4)}°, {position[1].toFixed(4)}°
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Speed:</span>
          <span className="text-white">{ship.speed} knots</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Heading:</span>
          <span className="text-white">{typeof ship.heading === 'number' ? ship.heading.toFixed(1) : ship.heading}°</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Destination:</span>
          <span className="text-white">{ship.destination}</span>
        </div>

        {ship.distanceToDest !== undefined && (
          <div className="flex justify-between">
            <span className="text-slate-400">Distance:</span>
            <span className="text-white">{Number(ship.distanceToDest).toFixed(1)} nm</span>
          </div>
        )}

        {ship.inAdverseWeather && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <span className="text-yellow-400 text-xs font-semibold">⚠ Adverse Weather (+30% fuel)</span>
          </div>
        )}

        {/* Fuel Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-slate-400 text-xs">
            <span>Fuel</span>
            <span>{fuelPercent.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${fuelColor}`}
              style={{ width: `${fuelPercent}%` }}
            />
          </div>
          <div className="text-xs text-slate-500">{typeof ship.fuel === 'number' ? ship.fuel.toFixed(0) : ship.fuel} tons</div>
        </div>
      </div>

      {/* Command Directive Buttons */}
      {!isCaptainView && onIssueDirective && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-3">
          {!showDirectivePanel ? (
            <button
              onClick={() => setShowDirectivePanel(true)}
              className="w-full px-4 py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:bg-blue-600/30 transition-colors font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Navigation className="w-4 h-4" />
              Issue Directive
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Issue Directive to {ship.name}
              </p>

              {/* Reroute to Port */}
              <div className="flex gap-2">
                <select
                  value={selectedPort}
                  onChange={(e) => setSelectedPort(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select port...</option>
                  {PORTS.filter((p) => p.id !== ship.destination).map((port) => (
                    <option key={port.id} value={port.id}>
                      {port.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (selectedPort) {
                      handleIssueDirective('REROUTE_PORT', { portId: selectedPort });
                    }
                  }}
                  disabled={!selectedPort}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Hold / Resume */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleIssueDirective('HOLD_POSITION')}
                  className="flex-1 px-3 py-2 rounded-lg bg-orange-600/20 border border-orange-500/40 text-orange-400 text-xs font-semibold hover:bg-orange-600/30 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Anchor className="w-3.5 h-3.5" />
                  Hold
                </button>
                <button
                  onClick={() => handleIssueDirective('RESUME')}
                  className="flex-1 px-3 py-2 rounded-lg bg-green-600/20 border border-green-500/40 text-green-400 text-xs font-semibold hover:bg-green-600/30 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  Resume
                </button>
              </div>

              <button
                onClick={() => setShowDirectivePanel(false)}
                className="w-full px-3 py-1.5 rounded-lg text-slate-400 text-xs hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
