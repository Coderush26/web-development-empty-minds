'use client';

import { X, AlertTriangle, Radio, Ship } from 'lucide-react';
import { AiAnalysisCard } from '@/components/ai-analysis-card';

interface DistressModalProps {
  alert: {
    id: string;
    type?: string;
    severity: string;
    message: string;
    timestamp?: any;
    firedAt?: number;
    read?: boolean;
    acknowledged?: boolean;
    shipId?: string;
    shipIdB?: string;
    metadata?: any;
    aiAnalysis?: any;
  } | null;
  onClose: () => void;
  onAcknowledge: () => void;
}

export function DistressModal({ alert, onClose, onAcknowledge }: DistressModalProps) {
  if (!alert) return null;

  const severity = alert.severity || 'info';

  const getSeverityColor = (sev: string) => {
    if (sev === 'critical') return 'text-red-400';
    if (sev === 'high') return 'text-orange-400';
    if (sev === 'warning' || sev === 'medium') return 'text-yellow-400';
    return 'text-blue-400';
  };

  const getBackgroundColor = (sev: string) => {
    if (sev === 'critical') return 'border-red-500 bg-red-500/5';
    if (sev === 'high') return 'border-orange-500 bg-orange-500/5';
    if (sev === 'warning' || sev === 'medium') return 'border-yellow-500 bg-yellow-500/5';
    return 'border-blue-500 bg-blue-500/5';
  };

  const getBorderAnimation = (sev: string) => {
    if (sev === 'critical') return 'animate-pulse';
    if (sev === 'high') return '';
    return '';
  };

  const isProximity = (alert as any).type === 'PROXIMITY_WARNING';
  const distanceKm = (alert as any).metadata?.distanceKm;
  const shipAName = (alert as any).metadata?.shipAName;
  const shipBName = (alert as any).metadata?.shipBName;
  const aiAnalysis = (alert as any).aiAnalysis;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
        <div
          className={`bg-slate-900 border-2 rounded-2xl shadow-2xl max-w-md w-full ${getBackgroundColor(severity)} ${getBorderAnimation(severity)}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              {isProximity ? (
                <Radio className={`w-6 h-6 ${getSeverityColor(severity)} animate-pulse`} />
              ) : (
                <AlertTriangle className={`w-6 h-6 ${getSeverityColor(severity)} animate-pulse`} />
              )}
              <div>
                <h2 className="text-lg font-bold text-white">
                  {isProximity ? 'Proximity Warning' : 'Alert'}
                </h2>
                <p className={`text-xs font-bold uppercase tracking-wider ${getSeverityColor(severity)}`}>
                  {severity}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Alert Type */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Alert Type
              </h3>
              <p className="text-white font-semibold capitalize">
                {((alert as any).type || 'unknown').replace(/_/g, ' ')}
              </p>
            </div>

            {/* Details */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Details
              </h3>
              <p className="text-white">{alert.message}</p>
            </div>

            {/* Proximity-specific info */}
            {isProximity && (
              <div className="space-y-2">
                {distanceKm !== undefined && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30">
                    <Ship className="w-4 h-4 text-red-400" />
                    <span className="text-red-300 font-semibold text-sm">
                      Distance: {Number(distanceKm).toFixed(2)} km
                    </span>
                  </div>
                )}
                {shipAName && shipBName && (
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="font-semibold text-white">{shipAName}</span>
                    <span className="text-slate-500">↔</span>
                    <span className="font-semibold text-white">{shipBName}</span>
                  </div>
                )}
              </div>
            )}

            {/* AI Analysis */}
            {aiAnalysis && <AiAnalysisCard analysis={aiAnalysis} />}

            {/* Time */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Time
              </h3>
              <p className="text-white font-mono text-sm" suppressHydrationWarning>
                {new Date(
                  (alert as any).firedAt ?? (alert as any).timestamp ?? Date.now()
                ).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t border-slate-700/50">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                onAcknowledge();
                onClose();
              }}
              className={`flex-1 px-4 py-2.5 rounded-xl font-semibold transition-colors text-white ${
                severity === 'critical'
                  ? 'bg-red-600 hover:bg-red-700'
                  : severity === 'high'
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : severity === 'warning' || severity === 'medium'
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Acknowledge
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
