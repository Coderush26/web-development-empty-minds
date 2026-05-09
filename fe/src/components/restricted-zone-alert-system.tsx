'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { isShipInRestrictedZone } from '@/lib/ship-utils';
import { Ship, restrictedZones } from '@/lib/mock-data';

interface RestrictedZoneAlert {
  id: string;
  shipName: string;
  zoneName: string;
  severity: 'caution' | 'danger';
  dismissed: boolean;
}

interface RestrictedZoneAlertSystemProps {
  ships: Ship[];
  enabled?: boolean;
}

export function RestrictedZoneAlertSystem({ ships, enabled = true }: RestrictedZoneAlertSystemProps) {
  const [zoneAlerts, setZoneAlerts] = useState<RestrictedZoneAlert[]>([]);
  const [audioPlayed, setAudioPlayed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    // Check for zone violations every 3 seconds
    const interval = setInterval(() => {
      const newAlerts: RestrictedZoneAlert[] = [];

      ships.forEach((ship) => {
        restrictedZones.forEach((zone) => {
          if (isShipInRestrictedZone(ship.position[0], ship.position[1], zone.coords)) {
            const alertId = `${ship.shipId}-${zone.id}`;

            newAlerts.push({
              id: alertId,
              shipName: ship.name,
              zoneName: zone.name,
              severity: zone.level,
              dismissed: false,
            });

            // Play audio alert if new
            if (!audioPlayed.has(alertId)) {
              playRestrictedZoneAlert(zone.level);
              setAudioPlayed((prev) => new Set([...prev, alertId]));
            }
          }
        });
      });

      setZoneAlerts(newAlerts);
    }, 3000);

    return () => clearInterval(interval);
  }, [ships, enabled, audioPlayed]);

  const playRestrictedZoneAlert = (severity: 'caution' | 'danger') => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Higher frequency for danger, lower for caution
    oscillator.frequency.value = severity === 'danger' ? 1000 : 600;
    oscillator.type = 'square';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
  };

  const activeAlerts = zoneAlerts.filter((a) => !a.dismissed);

  if (activeAlerts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-72 space-y-2 z-40 max-w-sm">
      {activeAlerts.map((alert) => {
        const isDanger = alert.severity === 'danger';
        const bgColor = isDanger ? 'bg-red-900/80' : 'bg-orange-900/80';
        const borderColor = isDanger ? 'border-red-700' : 'border-orange-700';
        const textColor = isDanger ? 'text-red-300' : 'text-orange-300';
        const iconColor = isDanger ? 'text-red-400' : 'text-orange-400';

        return (
          <div
            key={alert.id}
            className={`rounded-lg ${bgColor} border ${borderColor} p-3 flex items-start gap-3 backdrop-blur animate-pulse`}
          >
            <AlertTriangle className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${textColor} text-sm`}>
                {isDanger ? 'Danger Zone Alert' : 'Caution Zone Alert'}
              </p>
              <p className={`text-xs ${textColor} mt-1 opacity-90`}>
                <span className="font-medium">{alert.shipName}</span> entered{' '}
                <span className="font-medium">{alert.zoneName}</span>
              </p>
            </div>
            <button
              onClick={() =>
                setZoneAlerts((prev) =>
                  prev.map((a) => (a.id === alert.id ? { ...a, dismissed: true } : a))
                )
              }
              className={`${textColor} hover:${textColor} opacity-70 hover:opacity-100 flex-shrink-0`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
