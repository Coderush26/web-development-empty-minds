'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { mockShips, Ship as ShipType, Alert } from '@/lib/mock-data';
import { LeftSidebar } from '@/components/left-sidebar';
import { TopHeader } from '@/components/top-header';
import { ShipDetailsPopover } from '@/components/ship-details-popover';
import { AlertToasts } from '@/components/alert-toasts';
import { DistressModal } from '@/components/distress-modal';
import { useFleetSocket } from '@/hooks/use-fleet-socket';

const CrisisMap = dynamic(
  () => import('@/components/crisis-map').then((mod) => ({ default: mod.CrisisMap })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-slate-950 flex items-center justify-center text-slate-400">
        Loading map...
      </div>
    ),
  }
);

export default function Home() {
  const [selectedShip, setSelectedShip] = useState<any | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [isCaptainView, setIsCaptainView] = useState(false);
  const [captainShip, setCaptainShip] = useState<any>(mockShips[0]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showBoundaryPolygon, setShowBoundaryPolygon] = useState(true);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showShipPaths, setShowShipPaths] = useState(true);

  const { fleetState: liveFleetState, activeAlerts: liveAlerts, zones } = useFleetSocket();

  const handleZoneCreated = async (polygon: any[]) => {
    try {
      const name = `Restricted Zone ${Math.floor(Math.random() * 1000)}`;

      const tokenRes = await fetch('http://localhost:3001/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'command' }),
      });
      const tokenData = await tokenRes.json();
      const token = tokenData.data?.token;

      if (!token) return;

      await fetch('http://localhost:3001/api/zones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, polygon }),
      });
    } catch (error) {
      console.error('Failed to create zone', error);
    }
  };

  useEffect(() => {
    const criticalAlert = liveAlerts.find((a) => a.severity === 'critical' && !dismissedAlerts.has(a.id));
    if (criticalAlert) {
      setSelectedAlert(criticalAlert);
    }
  }, [liveAlerts, dismissedAlerts]);

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts((prev) => new Set([...prev, alertId]));
  };

  const handleAcknowledgeAlert = async () => {
    if (!selectedAlert) return;

    try {
      const tokenRes = await fetch('http://localhost:3001/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'command' }),
      });
      const tokenData = await tokenRes.json();
      const token = tokenData.data?.token;

      if (token) {
        await fetch(`http://localhost:3001/api/alerts/${selectedAlert.id}/acknowledge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (err) {
      console.error('Failed to acknowledge alert', err);
    }

    setAlerts((prev) => prev.map((a) => (a.id === selectedAlert.id ? { ...a, read: true } : a)));
  };

  const handleToggleCaptainView = (value: boolean) => {
    setIsCaptainView(value);
    if (value && captainShip) {
      setSelectedShip(captainShip);
    }
  };

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const combinedAlerts = liveAlerts.length > 0 ? liveAlerts : alerts;
  const activeAlerts = combinedAlerts.filter((a) => !a.read && !dismissedAlerts.has(a.id));
  const baseFleet = liveFleetState.length > 0 ? liveFleetState : mockShips;

  const currentSelectedShip = selectedShip
    ? baseFleet.find((s) => s.shipId === selectedShip.shipId) || selectedShip
    : null;

  const currentCaptainShip = captainShip
    ? baseFleet.find((s) => s.shipId === captainShip.shipId) || captainShip
    : null;

  const displayShips = isCaptainView && currentCaptainShip ? [currentCaptainShip] : baseFleet;

  return (
    <div className="w-full h-screen bg-slate-950 text-white overflow-hidden">
      <CrisisMap
        ships={displayShips}
        zones={zones}
        onShipClick={setSelectedShip}
        selectedShip={currentSelectedShip}
        onZoneCreated={isCaptainView ? undefined : handleZoneCreated}
        showBoundaryPolygon={showBoundaryPolygon}
        showGeofences={showGeofences}
        showShipPaths={showShipPaths}
      />

      <TopHeader
        activeAlertCount={activeAlerts.length}
        isCaptainView={isCaptainView}
        sidebarOpen={sidebarOpen}
        onToggleCaptainView={handleToggleCaptainView}
        onToggleSidebar={handleToggleSidebar}
        showBoundaryPolygon={showBoundaryPolygon}
        showGeofences={showGeofences}
        showShipPaths={showShipPaths}
        onToggleBoundaryPolygon={() => setShowBoundaryPolygon((prev) => !prev)}
        onToggleGeofences={() => setShowGeofences((prev) => !prev)}
        onToggleShipPaths={() => setShowShipPaths((prev) => !prev)}
      />

      {sidebarOpen && !isCaptainView && (
        <LeftSidebar
          ships={baseFleet}
          alerts={combinedAlerts}
          onShipClick={setSelectedShip}
          selectedShip={currentSelectedShip}
        />
      )}

      <ShipDetailsPopover ship={currentSelectedShip} onClose={() => setSelectedShip(null)} />

      <AlertToasts alerts={activeAlerts.filter((a) => !dismissedAlerts.has(a.id))} onDismiss={handleDismissAlert} />

      <DistressModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} onAcknowledge={handleAcknowledgeAlert} />
    </div>
  );
}
