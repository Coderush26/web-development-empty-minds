'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { mockShips, mockAlerts, Ship as ShipType, Alert } from '@/lib/mock-data';
import { LeftSidebar } from '@/components/left-sidebar';
import { TopHeader } from '@/components/top-header';
import { ShipDetailsPopover } from '@/components/ship-details-popover';
import { AlertToasts } from '@/components/alert-toasts';
import { DistressModal } from '@/components/distress-modal';

// Dynamically import CrisisMap to avoid SSR issues with Leaflet
const CrisisMap = dynamic(() => import('@/components/crisis-map').then(mod => ({ default: mod.CrisisMap })), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-950 flex items-center justify-center text-slate-400">Loading map...</div>,
});

export default function Home() {
  const [selectedShip, setSelectedShip] = useState<ShipType | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [isCaptainView, setIsCaptainView] = useState(false);
  const [captainShip, setCaptainShip] = useState<ShipType | null>(mockShips[0]);

  // Show first critical alert on load
  useEffect(() => {
    const criticalAlert = mockAlerts.find((a) => a.severity === 'critical' && !dismissedAlerts.has(a.id));
    if (criticalAlert) {
      setSelectedAlert(criticalAlert);
    }
  }, [dismissedAlerts]);

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts((prev) => new Set([...prev, alertId]));
  };

  const handleAcknowledgeAlert = () => {
    if (selectedAlert) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === selectedAlert.id ? { ...a, read: true } : a))
      );
    }
  };

  const handleToggleCaptainView = (value: boolean) => {
    setIsCaptainView(value);
    if (value && captainShip) {
      setSelectedShip(captainShip);
    }
  };

  const activeAlerts = alerts.filter((a) => !a.read && !dismissedAlerts.has(a.id));
  
  // In captain view, only show the captain's ship
  const displayShips = isCaptainView && captainShip ? [captainShip] : mockShips;

  return (
    <div className="w-full h-screen bg-slate-950 text-white overflow-hidden">
      {/* Map */}
      <CrisisMap
        ships={displayShips}
        onShipClick={setSelectedShip}
        selectedShip={selectedShip}
      />

      {/* Header */}
      <TopHeader 
        activeAlertCount={activeAlerts.length}
        isCaptainView={isCaptainView}
        onToggleCaptainView={handleToggleCaptainView}
      />

      {/* Left Sidebar - Hidden in captain view */}
      {!isCaptainView && (
        <LeftSidebar
          ships={mockShips}
          alerts={alerts}
          onShipClick={setSelectedShip}
          selectedShip={selectedShip}
        />
      )}

      {/* Ship Details Popover */}
      <ShipDetailsPopover
        ship={selectedShip}
        onClose={() => setSelectedShip(null)}
      />

      {/* Alert Toasts */}
      <AlertToasts
        alerts={activeAlerts.filter((a) => !dismissedAlerts.has(a.id))}
        onDismiss={handleDismissAlert}
      />

      {/* Distress Modal */}
      <DistressModal
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onAcknowledge={handleAcknowledgeAlert}
      />
    </div>
  );
}
