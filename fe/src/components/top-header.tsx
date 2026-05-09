'use client';

import { Radio, Settings, Bell } from 'lucide-react';

interface TopHeaderProps {
  activeAlertCount: number;
  isCaptainView: boolean;
  onToggleCaptainView: (value: boolean) => void;
}

export function TopHeader({ activeAlertCount, isCaptainView, onToggleCaptainView }: TopHeaderProps) {
  return (
    <div className="absolute top-0 left-72 right-0 h-16 bg-slate-900/95 backdrop-blur border-b border-slate-700 z-20 flex items-center justify-between px-6">
      {/* Left side - Title, status, and captain view toggle */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
          <h1 className="text-xl font-bold text-white">Crisis Operations Center</h1>
        </div>

        {/* Captain View Toggle */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
             onClick={() => onToggleCaptainView(!isCaptainView)}>
          <input
            type="checkbox"
            checked={isCaptainView}
            onChange={(e) => onToggleCaptainView(e.target.checked)}
            className="w-4 h-4 rounded cursor-pointer accent-blue-500"
          />
          <span className="text-sm font-medium text-slate-300">Captain View</span>
        </div>
      </div>

      {/* Right side - Controls */}
      <div className="flex items-center gap-4">
        {/* Active Alerts Badge */}
        <div className="flex items-center gap-2 px-4 py-2 rounded bg-red-500/10 border border-red-500/30">
          <Radio className="w-4 h-4 text-red-400 animate-pulse" />
          <span className="text-sm font-semibold text-red-400">{activeAlertCount} Active</span>
        </div>

        {/* Notification Bell */}
        <button className="relative p-2 rounded hover:bg-slate-800 transition-colors group">
          <Bell className="w-5 h-5 text-slate-400 group-hover:text-white" />
          {activeAlertCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"></span>
          )}
        </button>

        {/* Settings */}
        <button className="p-2 rounded hover:bg-slate-800 transition-colors text-slate-400 hover:text-white">
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
