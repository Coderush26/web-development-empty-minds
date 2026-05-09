'use client';

import { X } from 'lucide-react';

interface ShipDetailsPopoverProps {
  ship: any;
  onClose: () => void;
}

export function ShipDetailsPopover({ ship, onClose }: ShipDetailsPopoverProps) {
  if (!ship) return null;

  const getStatusColor = (status: string) => {
    if (status === 'critical') return 'bg-red-500/20 border-red-500 text-red-400';
    if (status === 'warning') return 'bg-orange-500/20 border-orange-500 text-orange-400';
    return 'bg-green-500/20 border-green-500 text-green-400';
  };

  const position = Array.isArray(ship.position)
    ? ship.position
    : ship.position?.lat !== undefined && ship.position?.lng !== undefined
    ? [ship.position.lat, ship.position.lng]
    : [0, 0];

  const fuelPercent = Math.min(100, Math.max(0, (typeof ship.fuel === 'number' ? ship.fuel : 0) / 10000 * 100));
  const fuelColor = fuelPercent < 30 ? 'bg-red-500' : 'bg-emerald-500';

  return (
    <div className="absolute bottom-6 left-6 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 z-40">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">{ship.name}</h3>
          <p className="text-sm text-slate-400">{String(ship.cargo).toUpperCase()}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className={`px-3 py-1 rounded border text-sm font-semibold mb-4 inline-block ${getStatusColor(ship.status)}`}>
        {String(ship.status).toUpperCase()}
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Position:</span>
          <span className="text-white font-mono">{position[0].toFixed(4)}°, {position[1].toFixed(4)}°</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Speed:</span>
          <span className="text-white">{ship.speed} knots</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Heading:</span>
          <span className="text-white">{ship.heading}°</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Destination:</span>
          <span className="text-white">{ship.destination}</span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-slate-400 text-xs">
            <span>Fuel</span>
            <span>{fuelPercent.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div className={`h-full rounded-full ${fuelColor}`} style={{ width: `${fuelPercent}%` }} />
          </div>
          <div className="text-xs text-slate-500">{ship.fuel} tons</div>
        </div>
      </div>
    </div>
  );
}
