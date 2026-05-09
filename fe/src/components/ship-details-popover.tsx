'use client';

import { X } from 'lucide-react';
import { Ship } from '@/lib/mock-data';

interface ShipDetailsPopoverProps {
  ship: Ship | null;
  onClose: () => void;
}

export function ShipDetailsPopover({ ship, onClose }: ShipDetailsPopoverProps) {
  if (!ship) return null;

  const getStatusColor = (status: string) => {
    if (status === 'critical') return 'bg-red-500/20 border-red-500 text-red-400';
    if (status === 'warning') return 'bg-orange-500/20 border-orange-500 text-orange-400';
    return 'bg-green-500/20 border-green-500 text-green-400';
  };


  return (
    <div className="absolute bottom-6 left-6 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-4 z-40">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">{ship.name}</h3>
          <p className="text-sm text-slate-400">{ship.cargo.toUpperCase()}</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className={`px-3 py-1 rounded border text-sm font-semibold mb-4 inline-block ${getStatusColor(ship.status)}`}>
        {ship.status.toUpperCase()}
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Position:</span>
          <span className="text-white font-mono">{ship.position[0].toFixed(4)}°, {ship.position[1].toFixed(4)}°</span>
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

        <div className="flex justify-between">
          <span className="text-slate-400">Fuel:</span>
          <span className="text-white">{ship.fuel} tons</span>
        </div>

        <div className="pt-4 border-t border-slate-700">
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition-colors">
            View Full Report
          </button>
        </div>
      </div>
    </div>
  );
}
