'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { mockShips, Ship as ShipType, Alert } from '@/lib/mock-data';
import { LeftSidebar } from '@/components/left-sidebar';
import { TopHeader } from '@/components/top-header';
import { ShipDetailsPopover } from '@/components/ship-details-popover';
import { AlertToasts } from '@/components/alert-toasts';
import { DistressModal } from '@/components/distress-modal';
import { CaptainDirective } from '@/components/captain-directive';
import { TimelineScrubber } from '@/components/timeline-scrubber';
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getToken(role: 'command' | 'captain', shipId?: string) {
  const res = await fetch(`${API_BASE}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, shipId }),
  });
  const data = await res.json();
  return data.data?.token as string | undefined;
}

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
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineTime, setTimelineTime] = useState(new Date());
  const [directivePanelOpen, setDirectivePanelOpen] = useState(false);
  const proximityAlarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarmedIdsRef = useRef<Set<string>>(new Set());

  const {
    fleetState: liveFleetState,
    activeAlerts: liveAlerts,
    zones,
    directives: liveDirectives,
  } = useFleetSocket();

  const normalizeAlert = (alert: any) => ({
    ...alert,
    timestamp: alert.timestamp ?? alert.firedAt ?? Date.now(),
    read: alert.read ?? alert.acknowledged ?? false,
  });

  // ─── Zone creation (Command only) ───────────────────────────────────────
  const handleZoneCreated = async (polygon: any[]) => {
    try {
      const name = `Restricted Zone ${Math.floor(Math.random() * 1000)}`;
      const token = await getToken('command');
      if (!token) return;

      await fetch(`${API_BASE}/api/zones`, {
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

  // ─── Open distress modal for critical/high/proximity alerts ─────────────
  useEffect(() => {
    const normalizedLiveAlerts = liveAlerts.map(normalizeAlert);
    const urgentAlert = normalizedLiveAlerts.find(
      (a) =>
        (a.severity === 'critical' ||
          a.severity === 'high' ||
          a.type === 'PROXIMITY_WARNING') &&
        !dismissedAlerts.has(a.id) &&
        !a.read
    );
    if (urgentAlert && (!selectedAlert || selectedAlert.id !== urgentAlert.id)) {
      setSelectedAlert(urgentAlert);
    }
  }, [liveAlerts, dismissedAlerts]);

  // ─── Proximity alarm sound — stricter conditions ────────────────────────
  useEffect(() => {
    const normalizedLiveAlerts = liveAlerts.map(normalizeAlert);
    const now = Date.now();
    const MAX_AGE_MS = 60_000; // only alarm for alerts < 60s old

    const shouldAlarm = normalizedLiveAlerts.some(
      (a) =>
        a.type === 'PROXIMITY_WARNING' &&
        ['critical', 'high'].includes(a.severity) &&
        !a.read &&
        !a.acknowledged &&
        !alarmedIdsRef.current.has(a.id) === false && // we always alarm active ones
        (now - (a.firedAt ?? a.timestamp ?? 0)) < MAX_AGE_MS
    );

    // Actually check: are there ANY active unacknowledged proximity warnings?
    const hasActiveProximity = normalizedLiveAlerts.some(
      (a) =>
        a.type === 'PROXIMITY_WARNING' &&
        ['critical', 'high'].includes(a.severity) &&
        !a.read &&
        !a.acknowledged
    );

    const playWarAlarmBurst = () => {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.08);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.4);
      masterGain.connect(audioCtx.destination);

      const oscA = audioCtx.createOscillator();
      const oscB = audioCtx.createOscillator();
      oscA.type = 'sawtooth';
      oscB.type = 'square';
      oscA.frequency.setValueAtTime(430, audioCtx.currentTime);
      oscA.frequency.linearRampToValueAtTime(770, audioCtx.currentTime + 0.35);
      oscA.frequency.linearRampToValueAtTime(430, audioCtx.currentTime + 0.7);
      oscB.frequency.setValueAtTime(215, audioCtx.currentTime);
      oscB.frequency.linearRampToValueAtTime(270, audioCtx.currentTime + 0.8);
      oscA.connect(masterGain);
      oscB.connect(masterGain);
      oscA.start();
      oscB.start();
      oscA.stop(audioCtx.currentTime + 1.4);
      oscB.stop(audioCtx.currentTime + 1.4);
      setTimeout(() => audioCtx.close().catch(() => {}), 1800);
    };

    if (hasActiveProximity && !proximityAlarmIntervalRef.current) {
      playWarAlarmBurst();
      proximityAlarmIntervalRef.current = setInterval(playWarAlarmBurst, 2500);
    }
    if (!hasActiveProximity && proximityAlarmIntervalRef.current) {
      clearInterval(proximityAlarmIntervalRef.current);
      proximityAlarmIntervalRef.current = null;
    }
  }, [liveAlerts]);

  useEffect(() => {
    return () => {
      if (proximityAlarmIntervalRef.current) {
        clearInterval(proximityAlarmIntervalRef.current);
        proximityAlarmIntervalRef.current = null;
      }
    };
  }, []);

  // ─── Load persisted alerts on mount ─────────────────────────────────────
  useEffect(() => {
    const loadPersistedAlerts = async () => {
      try {
        const token = await getToken('command');
        if (!token) return;

        const alertsRes = await fetch(`${API_BASE}/api/alerts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const alertsData = await alertsRes.json();
        const fetchedAlerts = Array.isArray(alertsData?.data)
          ? alertsData.data.map(normalizeAlert)
          : [];
        setAlerts(fetchedAlerts);
      } catch (error) {
        console.error('Failed to load persisted alerts', error);
      }
    };
    loadPersistedAlerts();
  }, []);

  // ─── Alert actions ──────────────────────────────────────────────────────
  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts((prev) => new Set([...prev, alertId]));
  };

  const handleAcknowledgeById = async (alertId: string) => {
    if (!alertId) return;
    try {
      const token = await getToken('command');
      if (token) {
        await fetch(`${API_BASE}/api/alerts/${alertId}/acknowledge`, {
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
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, read: true, acknowledged: true } : a))
    );
  };

  const handleAcknowledgeAlert = async () => {
    if (!selectedAlert) return;
    await handleAcknowledgeById(selectedAlert.id);
    setSelectedAlert(null);
  };

  const handleAcknowledgeAllAlerts = async () => {
    try {
      const token = await getToken('command');
      if (!token) return;
      await fetch(`${API_BASE}/api/alerts/acknowledge-all`, {
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

  // ─── Directive actions (Command) ────────────────────────────────────────
  const handleIssueDirective = async (
    shipId: string,
    type: string,
    payload: any
  ) => {
    try {
      const token = await getToken('command');
      if (!token) return;
      await fetch(`${API_BASE}/api/directives`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shipId, type, payload }),
      });
    } catch (err) {
      console.error('Failed to issue directive', err);
    }
  };

  // ─── Directive response (Captain) ───────────────────────────────────────
  const handleAcceptDirective = async (directiveId: string) => {
    try {
      const shipId = captainShip?.shipId;
      const token = await getToken('captain', shipId);
      if (!token) return;
      await fetch(`${API_BASE}/api/directives/${directiveId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ response: 'ACCEPT', shipId }),
      });
    } catch (err) {
      console.error('Failed to accept directive', err);
    }
  };

  const handleEscalateDistress = async (directiveId: string, message: string) => {
    try {
      const shipId = captainShip?.shipId;
      const token = await getToken('captain', shipId);
      if (!token) return;
      await fetch(`${API_BASE}/api/directives/${directiveId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          response: 'ESCALATE_DISTRESS',
          distressMessage: message,
          shipId,
        }),
      });
    } catch (err) {
      console.error('Failed to escalate distress', err);
    }
  };

  // ─── View toggles ──────────────────────────────────────────────────────
  const handleToggleCaptainView = (value: boolean) => {
    setIsCaptainView(value);
    if (value && captainShip) {
      setSelectedShip(captainShip);
    }
  };

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  // ─── Derived state ─────────────────────────────────────────────────────
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

  // Get pending directives for current captain ship
  const pendingDirective = isCaptainView && currentCaptainShip
    ? liveDirectives.find(
        (d: any) =>
          d.shipId === currentCaptainShip.shipId &&
          d.status === 'PENDING'
      )
    : null;

  return (
    <div className="w-full h-screen bg-slate-950 text-white overflow-hidden">
      <CrisisMap
        ships={displayShips}
        alerts={combinedAlerts}
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

      <ShipDetailsPopover
        ship={currentSelectedShip}
        onClose={() => setSelectedShip(null)}
        isCaptainView={isCaptainView}
        onIssueDirective={handleIssueDirective}
      />

      <AlertToasts
        alerts={activeAlerts.filter((a) => !dismissedAlerts.has(a.id))}
        onDismiss={handleDismissAlert}
      />

      <DistressModal
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onAcknowledge={handleAcknowledgeAlert}
      />

      {/* Captain Directive Modal */}
      {pendingDirective && (
        <CaptainDirective
          directive={{
            id: pendingDirective.id,
            from: 'Fleet Command',
            content: `${pendingDirective.type.replace(/_/g, ' ')}: ${
              pendingDirective.payload?.portId
                ? `Reroute to ${pendingDirective.payload.portId}`
                : pendingDirective.payload?.waypoint
                ? `Divert to waypoint`
                : pendingDirective.type === 'HOLD_POSITION'
                ? 'Hold current position'
                : 'Resume course'
            }`,
            timestamp: new Date(pendingDirective.issuedAt),
            status: 'pending',
          }}
          onAccept={() => handleAcceptDirective(pendingDirective.id)}
          onEscalate={(msg) => handleEscalateDistress(pendingDirective.id, msg)}
          onClose={() => {}}
        />
      )}

      {/* Timeline Scrubber */}
      <TimelineScrubber
        currentTime={timelineTime}
        onTimeChange={setTimelineTime}
        enabled={showTimeline}
      />
    </div>
  );
}
