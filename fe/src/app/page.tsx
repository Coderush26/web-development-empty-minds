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

  const normalizeAlert = (alert: any) => ({
    ...alert,
    timestamp: alert.timestamp ?? alert.firedAt ?? Date.now(),
    read: alert.read ?? alert.acknowledged ?? false,
  });

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
    const normalizedLiveAlerts = liveAlerts.map(normalizeAlert);
    const criticalAlert = normalizedLiveAlerts.find((a) => a.severity === 'critical' && !dismissedAlerts.has(a.id) && !a.read);
    if (criticalAlert) {
      setSelectedAlert(criticalAlert);
    }
  }, [liveAlerts, dismissedAlerts]);

  useEffect(() => {
    const criticalUnread = liveAlerts.find((a) => a.severity === 'critical' && !(a.read ?? a.acknowledged));
    if (!criticalUnread) return;
    // Browser-generated siren-style warning (no external audio asset needed).
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const audioCtx = new AudioCtx();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(620, audioCtx.currentTime);
    oscillator.frequency.linearRampToValueAtTime(920, audioCtx.currentTime + 0.3);
    oscillator.frequency.linearRampToValueAtTime(620, audioCtx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.8);
    const timeout = setTimeout(() => audioCtx.close().catch(() => {}), 1200);
    return () => clearTimeout(timeout);
  }, [liveAlerts]);

  useEffect(() => {
    const loadPersistedAlerts = async () => {
      try {
        const tokenRes = await fetch('http://localhost:3001/api/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'command' }),
        });
        const tokenData = await tokenRes.json();
        const token = tokenData.data?.token;
        if (!token) return;

        const alertsRes = await fetch('http://localhost:3001/api/alerts', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const alertsData = await alertsRes.json();
        const fetchedAlerts = Array.isArray(alertsData?.data) ? alertsData.data.map(normalizeAlert) : [];
        setAlerts(fetchedAlerts);
      } catch (error) {
        console.error('Failed to load persisted alerts', error);
      }
    };

    loadPersistedAlerts();
  }, []);

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts((prev) => new Set([...prev, alertId]));
  };

  const handleAcknowledgeById = async (alertId: string) => {
    if (!alertId) return;

    try {
      const tokenRes = await fetch('http://localhost:3001/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'command' }),
      });
      const tokenData = await tokenRes.json();
      const token = tokenData.data?.token;

      if (token) {
        await fetch(`http://localhost:3001/api/alerts/${alertId}/acknowledge`, {
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

    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, read: true, acknowledged: true } : a)));
  };

  const handleAcknowledgeAlert = async () => {
    if (!selectedAlert) return;
    await handleAcknowledgeById(selectedAlert.id);
  };

  const handleAcknowledgeAllAlerts = async () => {
    try {
      const tokenRes = await fetch('http://localhost:3001/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'command' }),
      });
      const tokenData = await tokenRes.json();
      const token = tokenData.data?.token;

      if (!token) return;
      await fetch('http://localhost:3001/api/alerts/acknowledge-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true, acknowledged: true })));
    } catch (error) {
      console.error('Failed to acknowledge all alerts', error);
    }
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

  const normalizedLiveAlerts = liveAlerts.map(normalizeAlert);
  const combinedAlerts = normalizedLiveAlerts.length > 0 ? normalizedLiveAlerts : alerts;
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
        alerts={combinedAlerts}
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
        onAcknowledgeAlert={handleAcknowledgeById}
        onAcknowledgeAllAlerts={handleAcknowledgeAllAlerts}
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
