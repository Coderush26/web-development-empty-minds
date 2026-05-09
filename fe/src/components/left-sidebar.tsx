'use client';

import { Bell, Ship } from 'lucide-react';
import { Ship as ShipType, Alert } from '@/lib/mock-data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BrandLogo } from '@/components/brand-logo';

interface LeftSidebarProps {
  ships: ShipType[];
  alerts: Alert[];
  onShipClick: (ship: any) => void;
  selectedShip: any;
}

export function LeftSidebar({ ships, alerts, onShipClick, selectedShip }: LeftSidebarProps) {
  const criticalShips = ships.filter((s) => s.status === 'critical');
  const warningShips = ships.filter((s) => s.status === 'warning');
  const unreadAlerts = alerts.filter((a) => !a.read);

  return (
    <div className="absolute top-0 left-0 h-screen w-72 bg-slate-900/95 backdrop-blur border-r border-slate-700 z-30 flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <BrandLogo className="w-5 h-5 text-white" />
          Operations
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {criticalShips.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">
                🔴 Critical ({criticalShips.length})
              </h3>
              <div className="space-y-2">
                {criticalShips.map((ship) => (
                  <button
                    key={ship.shipId}
                    onClick={() => onShipClick(ship)}
                    className={`w-full text-left p-2 rounded border transition-colors ${
                      selectedShip?.shipId === ship.shipId
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

          {warningShips.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2">
                ⚠️ Warning ({warningShips.length})
              </h3>
              <div className="space-y-2">
                {warningShips.map((ship) => (
                  <button
                    key={ship.shipId}
                    onClick={() => onShipClick(ship)}
                    className={`w-full text-left p-2 rounded border transition-colors ${
                      selectedShip?.shipId === ship.shipId
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

          {unreadAlerts.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Bell className="w-3 h-3" />
                Alerts ({unreadAlerts.length})
              </h3>
              <div className="space-y-2">
                {unreadAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className="p-2 rounded bg-blue-500/10 border border-blue-500/30 text-xs"
                  >
                    <div className="font-semibold text-blue-300">{alert.message}</div>
                    <div className="text-blue-400/70 text-xs mt-1" suppressHydrationWarning>
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Ship className="w-3 h-3" />
              All Vessels ({ships.length})
            </h3>
            <Dialog>
              <DialogTrigger asChild>
                <button className="w-full rounded-3xl border border-white/10 bg-white/10 px-4 py-3 text-left text-base font-semibold text-white backdrop-blur-xl transition hover:bg-white/20">
                  View All {ships.length} Vessels
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl bg-slate-950/95 border border-white/10 shadow-2xl backdrop-blur-xl">
                <DialogHeader>
                  <DialogTitle className="text-lg text-white">All Vessels</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 max-h-[70vh] overflow-y-auto pt-4">
                  {ships.map((ship) => (
                    <button
                      key={ship.shipId}
                      onClick={() => onShipClick(ship)}
                      className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-left text-sm text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
                    >
                      <div>
                        <div className="font-semibold text-white">{ship.name}</div>
                        <div className="text-xs text-slate-400">{ship.destination ?? 'Unknown destination'}</div>
                      </div>
                      <span className="text-xs text-slate-400">{ship.status?.toUpperCase() ?? 'UNKNOWN'}</span>
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
