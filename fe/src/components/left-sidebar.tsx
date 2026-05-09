'use client';

import { AlertCircle, Ship, Waves } from 'lucide-react';
import { Ship as ShipType, Alert } from '@/lib/mock-data';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LeftSidebarProps {
  ships: ShipType[];
  alerts: Alert[];
  onShipClick: (ship: ShipType) => void;
  selectedShip: ShipType | null;
}

export function LeftSidebar({ ships, alerts, onShipClick, selectedShip }: LeftSidebarProps) {
  const criticalShips = ships.filter((s) => s.status === 'critical');
  const warningShips = ships.filter((s) => s.status === 'warning');
  const unreadAlerts = alerts.filter((a) => !a.read);

  return (
    <div className="absolute top-0 left-0 h-screen w-72 bg-slate-900/95 backdrop-blur border-r border-slate-700 z-30 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Waves className="w-5 h-5" />
          Operations
        </h2>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Critical Vessels */}
          {criticalShips.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">
                🔴 Critical ({criticalShips.length})
              </h3>
              <div className="space-y-2">
                {criticalShips.map((ship) => (
                  <button
                    key={ship.id}
                    onClick={() => onShipClick(ship)}
                    className={`w-full text-left p-2 rounded border transition-colors ${
                      selectedShip?.id === ship.id
                        ? 'bg-red-500/20 border-red-500'
                        : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{ship.name}</div>
                    <div className="text-xs text-slate-400">Speed: {ship.speed} kts</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Warning Vessels */}
          {warningShips.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2">
                ⚠️ Warning ({warningShips.length})
              </h3>
              <div className="space-y-2">
                {warningShips.map((ship) => (
                  <button
                    key={ship.id}
                    onClick={() => onShipClick(ship)}
                    className={`w-full text-left p-2 rounded border transition-colors ${
                      selectedShip?.id === ship.id
                        ? 'bg-orange-500/20 border-orange-500'
                        : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{ship.name}</div>
                    <div className="text-xs text-slate-400">Speed: {ship.speed} kts</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Alerts */}
          {unreadAlerts.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                Alerts ({unreadAlerts.length})
              </h3>
              <div className="space-y-2">
                {unreadAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className="p-2 rounded bg-blue-500/10 border border-blue-500/30 text-xs"
                  >
                    <div className="font-semibold text-blue-300">{alert.message}</div>
                    <div className="text-blue-400/70 text-xs mt-1">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Vessels */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Ship className="w-3 h-3" />
              All Vessels ({ships.length})
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {ships.map((ship) => (
                <button
                  key={ship.id}
                  onClick={() => onShipClick(ship)}
                  className={`w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                    selectedShip?.id === ship.id
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/30'
                  }`}
                >
                  {ship.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
