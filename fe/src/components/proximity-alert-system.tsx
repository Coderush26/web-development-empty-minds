'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { detectProximityWarnings } from '@/lib/ship-utils';
import { Ship } from '@/lib/mock-data';

interface ProximityAlert {
  id: string;
  ship1Name: string;
  ship2Name: string;
  distance: number;
  dismissed: boolean;
}

interface ProximityAlertSystemProps {
  ships: Ship[];
  enabled?: boolean;
}

export function ProximityAlertSystem({ ships, enabled = true }: ProximityAlertSystemProps) {
  const [proximityAlerts, setProximityAlerts] = useState<ProximityAlert[]>([]);
  const [audioPlayed, setAudioPlayed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    // Check for proximity warnings every 2 seconds
    const interval = setInterval(() => {
      const warnings = detectProximityWarnings(ships);

      const newAlerts: ProximityAlert[] = warnings.map((warning) => {
        const ship1 = ships.find((s) => s.id === warning.shipId1);
        const ship2 = ships.find((s) => s.id === warning.shipId2);

        const alertId = `${warning.shipId1}-${warning.shipId2}`;

        return {
          id: alertId,
          ship1Name: ship1?.name || 'Unknown',
          ship2Name: ship2?.name || 'Unknown',
          distance: warning.distance,
          dismissed: false,
        };
      });

      // Play audio for new alerts
      newAlerts.forEach((alert) => {
        if (!audioPlayed.has(alert.id)) {
          playAlarmSound();
          setAudioPlayed((prev) => new Set([...prev, alert.id]));
        }
      });

      setProximityAlerts(newAlerts);
    }, 2000);

    return () => clearInterval(interval);
  }, [ships, enabled, audioPlayed]);

  const playAlarmSound = () => {
    // Create a simple beep using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // Frequency in Hz
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  };

  const activAlerts = proximityAlerts.filter((a) => !a.dismissed);

  if (activAlerts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-40 max-w-sm">
      {activAlerts.map((alert) => (
        <div
          key={alert.id}
          className="rounded-lg bg-yellow-900/80 border border-yellow-700 p-3 flex items-start gap-3 backdrop-blur animate-pulse"
        >
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-yellow-300 text-sm">Proximity Warning</p>
            <p className="text-xs text-yellow-100 mt-1">
              <span className="font-medium">{alert.ship1Name}</span> and{' '}
              <span className="font-medium">{alert.ship2Name}</span> are{' '}
              <span className="font-mono">{alert.distance.toFixed(2)} km</span> apart
            </p>
          </div>
          <button
            onClick={() =>
              setProximityAlerts((prev) =>
                prev.map((a) => (a.id === alert.id ? { ...a, dismissed: true } : a))
              )
            }
            className="text-yellow-400 hover:text-yellow-300 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
