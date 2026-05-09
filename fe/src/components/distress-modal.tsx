'use client';

import { X, AlertTriangle } from 'lucide-react';
import { Alert } from '@/lib/mock-data';

interface DistressModalProps {
  alert: Alert | null;
  onClose: () => void;
  onAcknowledge: () => void;
}

export function DistressModal({ alert, onClose, onAcknowledge }: DistressModalProps) {
  if (!alert) return null;

  const getSeverityColor = (severity: string) => {
    if (severity === 'critical') return 'text-red-400';
    if (severity === 'warning') return 'text-orange-400';
    return 'text-blue-400';
  };

  const getBackgroundColor = (severity: string) => {
    if (severity === 'critical') return 'border-red-500 bg-red-500/5';
    if (severity === 'warning') return 'border-orange-500 bg-orange-500/5';
    return 'border-blue-500 bg-blue-500/5';
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className={`bg-slate-900 border-2 rounded-lg shadow-2xl max-w-md w-full ${getBackgroundColor(alert.severity)}`}>
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-6 h-6 ${getSeverityColor(alert.severity)} animate-pulse`} />
              <div>
                <h2 className="text-lg font-bold text-white">Alert</h2>
                <p className={`text-xs ${getSeverityColor(alert.severity)}`}>{alert.severity.toUpperCase()}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Alert Type</h3>
              <p className="text-white font-semibold capitalize">{alert.type.replace(/_/g, ' ')}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Details</h3>
              <p className="text-white">{alert.message}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Time</h3>
              <p className="text-white font-mono text-sm">
                {new Date(alert.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t border-slate-700">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                onAcknowledge();
                onClose();
              }}
              className={`flex-1 px-4 py-2 rounded font-semibold transition-colors text-white ${
                alert.severity === 'critical'
                  ? 'bg-red-600 hover:bg-red-700'
                  : alert.severity === 'warning'
                  ? 'bg-orange-600 hover:bg-orange-700'
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
