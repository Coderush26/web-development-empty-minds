'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { mockShips, mockAlerts, Ship as ShipType, Alert } from '@/lib/mock-data';
import { LeftSidebar } from '@/components/left-sidebar';
import { TopHeader } from '@/components/top-header';
import { ShipDetailsPopover } from '@/components/ship-details-popover';
import { AlertToasts } from '@/components/alert-toasts';
import { DistressModal } from '@/components/distress-modal';
import { useFleetSocket } from '@/hooks/use-fleet-socket';

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

  const { fleetState: liveFleetState, activeAlerts: liveAlerts, isConnected } = useFleetSocket('ws://localhost:3001/ws?role=command');

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

  const combinedAlerts = liveAlerts.length > 0 ? liveAlerts : alerts;
  const activeAlerts = combinedAlerts.filter((a) => !a.read && !dismissedAlerts.has(a.id));
  
  const baseFleet = liveFleetState.length > 0 ? liveFleetState : mockShips;

  // Ensure selectedShip and captainShip stay up-to-date with live websocket data
  const currentSelectedShip = selectedShip 
    ? baseFleet.find(s => s.shipId === selectedShip.shipId) || selectedShip 
    : null;

  const currentCaptainShip = captainShip 
    ? baseFleet.find(s => s.shipId === captainShip.shipId) || captainShip 
    : null;

  // In captain view, only show the captain's ship
  const displayShips = isCaptainView && currentCaptainShip ? [currentCaptainShip] : baseFleet;

  return (
    <div className="w-full h-screen bg-slate-950 text-white overflow-hidden">
      {/* Map */}
      <CrisisMap
        ships={displayShips}
        onShipClick={setSelectedShip}
        selectedShip={currentSelectedShip}
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
          ships={baseFleet}
          alerts={combinedAlerts}
          onShipClick={setSelectedShip}
          selectedShip={currentSelectedShip}
        />
      )}

      {/* Ship Details Popover */}
      <ShipDetailsPopover
        ship={currentSelectedShip}
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
