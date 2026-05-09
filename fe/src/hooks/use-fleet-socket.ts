import { useEffect, useState, useRef } from 'react';

const DEFAULT_WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws?role=command';

export function useFleetSocket(url = DEFAULT_WS_URL) {
  const [fleetState, setFleetState] = useState<any[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [directives, setDirectives] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let closed = false;

    function connect() {
      if (closed) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log('Connected to Fleet Command WebSocket');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle FLEET_STATE and TICK events
          if (data.type === 'FLEET_STATE' || data.type === 'TICK') {
            const payload = data.fleet || data.payload || data.fleetState || [];
            const shipsArray = Array.isArray(payload) ? payload : (payload.ships || []);
            setFleetState(shipsArray);

            if (data.activeAlerts) {
              setActiveAlerts(data.activeAlerts);
            } else if (payload.alerts && Array.isArray(payload.alerts)) {
              setActiveAlerts(payload.alerts);
            }

            if (payload.zones && Array.isArray(payload.zones)) {
              setZones(payload.zones);
            }
          } else if (data.type === 'ALERT_FIRED' || data.type === 'PROXIMITY_WARNING') {
            setActiveAlerts((prev) => {
              if (prev.some(a => a.id === data.payload.id)) return prev;
              return [data.payload, ...prev];
            });
          } else if (data.type === 'ALERT_ACKNOWLEDGED') {
            setActiveAlerts((prev) =>
              prev.map((alert) =>
                alert.id === data.payload.id
                  ? { ...alert, acknowledged: true, acknowledgedAt: data.payload.acknowledgedAt }
                  : alert
              )
            );
          } else if (data.type === 'ALERTS_ACKNOWLEDGED') {
            const ids = Array.isArray(data?.payload?.ids) ? data.payload.ids : [];
            setActiveAlerts((prev) =>
              prev.map((alert) =>
                ids.includes(alert.id)
                  ? { ...alert, acknowledged: true, acknowledgedAt: Date.now() }
                  : alert
              )
            );
          } else if (data.type === 'ZONE_ADDED') {
            setZones((prev) => {
              if (prev.some(z => z.id === data.payload.id)) return prev;
              return [...prev, data.payload];
            });
          } else if (data.type === 'ZONE_REMOVED') {
            setZones((prev) => prev.filter(z => z.id !== data.payload.zoneId));
          } else if (data.type === 'DIRECTIVE_ISSUED') {
            setDirectives((prev) => {
              if (prev.some(d => d.id === data.payload.id)) return prev;
              return [...prev, data.payload];
            });
          } else if (data.type === 'DIRECTIVE_RESPONDED') {
            setDirectives((prev) =>
              prev.map((d) =>
                d.id === data.payload.id ? { ...d, ...data.payload } : d
              )
            );
          }
        } catch (error) {
          console.error("Failed to parse fleet data", error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('Disconnected from Fleet Command WebSocket');
        // Auto-reconnect after 2s
        if (!closed) {
          reconnectTimeoutRef.current = setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      closed = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [url]);

  return { fleetState, activeAlerts, zones, directives, isConnected, socket: wsRef.current };
}
