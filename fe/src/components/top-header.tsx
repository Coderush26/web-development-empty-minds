'use client';

import { useState } from 'react';
import { Bell, Menu, Radio, Settings } from 'lucide-react';

interface TopHeaderProps {
  activeAlertCount: number;
  alerts: any[];
  isCaptainView: boolean;
  sidebarOpen: boolean;
  onToggleCaptainView: (value: boolean) => void;
  onToggleSidebar: () => void;
  showBoundaryPolygon: boolean;
  showGeofences: boolean;
  showShipPaths: boolean;
  onToggleBoundaryPolygon: () => void;
  onToggleGeofences: () => void;
  onToggleShipPaths: () => void;
  onAcknowledgeAlert: (alertId: string) => Promise<void> | void;
  onAcknowledgeAllAlerts: () => Promise<void> | void;
}

export function TopHeader({
  activeAlertCount,
  alerts,
  isCaptainView,
  sidebarOpen,
  onToggleCaptainView,
  onToggleSidebar,
  showBoundaryPolygon,
  showGeofences,
  showShipPaths,
  onToggleBoundaryPolygon,
  onToggleGeofences,
  onToggleShipPaths,
  onAcknowledgeAlert,
  onAcknowledgeAllAlerts,
}: TopHeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertFilter, setAlertFilter] = useState<'all' | 'unread' | 'critical'>('all');

  const normalizedAlerts = alerts.map((alert) => ({
    ...alert,
    read: alert.read ?? alert.acknowledged ?? false,
  }));
  const filteredAlerts = normalizedAlerts.filter((alert) => {
    if (alertFilter === 'unread') return !alert.read;
    if (alertFilter === 'critical') return alert.severity === 'critical';
    return true;
  });
  const latestAlerts = filteredAlerts.slice(0, 12);

  return (
    <div
      className={`absolute top-0 ${sidebarOpen && !isCaptainView ? 'left-72' : 'left-0'} right-0 h-16 bg-slate-900/95 backdrop-blur border-b border-slate-700 z-20 flex items-center justify-between px-4 sm:px-6 transition-all duration-300`}
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-full p-2 bg-slate-800/70 hover:bg-slate-700 transition-colors"
        >
          <Menu className="w-5 h-5 text-white" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
          <h1 className="text-xl font-bold text-white">Crisis Dashboard</h1>
        </div>

        <div className="flex items-center rounded-full bg-slate-800/60 p-1 gap-1 border border-slate-700">
          <button
            type="button"
            onClick={() => onToggleCaptainView(false)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              isCaptainView ? 'text-slate-300' : 'bg-white text-slate-950'
            }`}
          >
            Command
          </button>
          <button
            type="button"
            onClick={() => onToggleCaptainView(true)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              isCaptainView ? 'bg-white text-slate-950' : 'text-slate-300'
            }`}
          >
            Captain
          </button>
        </div>
      </div>

      <div className="relative flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded bg-red-500/10 border border-red-500/30">
          <Radio className="w-4 h-4 text-red-400 animate-pulse" />
          <span className="text-sm font-semibold text-red-400">{activeAlertCount} Active</span>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setAlertsOpen((prev) => !prev)}
            className="relative rounded-full p-2 bg-slate-800/70 hover:bg-slate-700 transition-colors text-slate-300"
          >
            <Bell className="w-5 h-5" />
            {activeAlertCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {activeAlertCount > 99 ? '99+' : activeAlertCount}
              </span>
            )}
          </button>

          {alertsOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-[22rem] rounded-3xl border border-slate-700 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Notifications</div>
                <div className="text-xs text-slate-400">{activeAlertCount} active</div>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAlertFilter('all')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    alertFilter === 'all' ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setAlertFilter('unread')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    alertFilter === 'unread' ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  Unread
                </button>
                <button
                  type="button"
                  onClick={() => setAlertFilter('critical')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    alertFilter === 'critical' ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  Critical
                </button>
                <button
                  type="button"
                  onClick={() => onAcknowledgeAllAlerts()}
                  className="ml-auto rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-slate-400"
                >
                  Mark all
                </button>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {latestAlerts.length === 0 && (
                  <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-3 text-sm text-slate-400">
                    No alerts yet.
                  </div>
                )}
                {latestAlerts.map((alert) => {
                  const timestamp = alert.firedAt ?? alert.timestamp;
                  const isAcknowledged = Boolean(alert.acknowledged ?? alert.read);
                  return (
                    <div
                      key={alert.id}
                      className="rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-3"
                    >
                      <div className="mb-1 flex items-start justify-between gap-3">
                        <div className="text-sm font-semibold text-white">{alert.message}</div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                          alert.severity === 'critical'
                            ? 'bg-red-500/20 text-red-300'
                            : alert.severity === 'high' || alert.severity === 'warning'
                            ? 'bg-orange-500/20 text-orange-300'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}>
                          {alert.severity}
                        </span>
                      </div>
                      <div className="mb-2 text-xs text-slate-400" suppressHydrationWarning>
                        {timestamp ? new Date(timestamp).toLocaleString() : 'Now'}
                      </div>
                      <button
                        type="button"
                        disabled={isAcknowledged}
                        onClick={() => onAcknowledgeAlert(alert.id)}
                        className="rounded-xl border border-slate-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isAcknowledged ? 'Acknowledged' : 'Acknowledge'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className="rounded-full p-2 bg-slate-800/70 hover:bg-slate-700 transition-colors text-slate-300"
          >
            <Settings className="w-5 h-5" />
          </button>

          {settingsOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-3xl border border-slate-700 bg-slate-950/95 px-3 py-3 shadow-2xl backdrop-blur-xl">
              <div className="mb-3 text-sm font-semibold text-white">Settings</div>

              <button
                type="button"
                onClick={onToggleBoundaryPolygon}
                className="flex items-center justify-between w-full gap-3 rounded-2xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 transition hover:border-slate-500"
              >
                <span>Boundary Polygon</span>
                <span className={`inline-flex h-6 w-11 items-center rounded-full p-1 transition ${
                  showBoundaryPolygon ? 'bg-white' : 'bg-slate-800'
                }`}>
                  <span className={`inline-block h-4 w-4 rounded-full transition-transform ${
                    showBoundaryPolygon ? 'translate-x-5 bg-slate-950' : 'translate-x-0 bg-white'
                  }`} />
                </span>
              </button>

              <button
                type="button"
                onClick={onToggleGeofences}
                className="flex items-center justify-between w-full gap-3 rounded-2xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 transition hover:border-slate-500"
              >
                <span>Geofences</span>
                <span className={`inline-flex h-6 w-11 items-center rounded-full p-1 transition ${
                  showGeofences ? 'bg-white' : 'bg-slate-800'
                }`}>
                  <span className={`inline-block h-4 w-4 rounded-full transition-transform ${
                    showGeofences ? 'translate-x-5 bg-slate-950' : 'translate-x-0 bg-white'
                  }`} />
                </span>
              </button>

              <button
                type="button"
                onClick={onToggleShipPaths}
                className="flex items-center justify-between w-full gap-3 rounded-2xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 transition hover:border-slate-500"
              >
                <span>Ship Paths</span>
                <span className={`inline-flex h-6 w-11 items-center rounded-full p-1 transition ${
                  showShipPaths ? 'bg-white' : 'bg-slate-800'
                }`}>
                  <span className={`inline-block h-4 w-4 rounded-full transition-transform ${
                    showShipPaths ? 'translate-x-5 bg-slate-950' : 'translate-x-0 bg-white'
                  }`} />
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
