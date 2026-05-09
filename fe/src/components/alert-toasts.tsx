'use client';

import { AlertCircle, X } from 'lucide-react';
import { Alert } from '@/lib/mock-data';
import { useEffect, useState } from 'react';

interface AlertToastsProps {
  alerts: Alert[];
  onDismiss: (alertId: string) => void;
}

export function AlertToasts({ alerts, onDismiss }: AlertToastsProps) {
  const [visibleAlerts, setVisibleAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    // Auto-show critical and warning alerts
    const unreadAlerts = alerts.filter((a) => !a.read && (a.severity === 'critical' || a.severity === 'warning'));
    setVisibleAlerts(unreadAlerts.slice(0, 3)); // Show max 3 toasts
  }, [alerts]);

  const getAlertStyles = (severity: string) => {
    if (severity === 'critical') {
      return 'bg-red-500/20 border-red-500 text-red-200';
    }
    if (severity === 'warning') {
      return 'bg-orange-500/20 border-orange-500 text-orange-200';
    }
    return 'bg-blue-500/20 border-blue-500 text-blue-200';
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === 'critical') {
      return <AlertCircle className="w-5 h-5 text-red-400" />;
    }
    if (severity === 'warning') {
      return <AlertCircle className="w-5 h-5 text-orange-400" />;
    }
    return <AlertCircle className="w-5 h-5 text-blue-400" />;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-3 max-w-md pointer-events-auto">
      {visibleAlerts.map((alert, idx) => (
        <div
          key={alert.id}
          className={`flex items-start gap-3 p-4 rounded-lg border backdrop-blur transition-all ${getAlertStyles(alert.severity)}`}
          style={{
            animation: `slideIn 0.3s ease-out ${idx * 0.1}s both`,
          }}
        >
          {getSeverityIcon(alert.severity)}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{alert.message}</div>
            <div className="text-xs opacity-75 mt-1">
              {new Date(alert.timestamp).toLocaleTimeString()}
            </div>
          </div>
          <button
            onClick={() => onDismiss(alert.id)}
            className="flex-shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
