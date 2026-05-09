import { useEffect, useState, useRef } from 'react';

export function useFleetSocket(url = 'ws://localhost:3001/ws?role=command') {
  const [fleetState, setFleetState] = useState<any[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Initialize the WebSocket connection
    wsRef.current = new WebSocket(url);

    wsRef.current.onopen = () => {
      setIsConnected(true);
      console.log('Connected to Fleet Command WebSocket');
    };

    wsRef.current.onmessage = (event) => {
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
        } else if (data.type === 'ALERT_FIRED') {
          setActiveAlerts((prev) => {
            // Avoid duplicates
            if (prev.some(a => a.id === data.payload.id)) return prev;
            return [data.payload, ...prev];
          });
        } else if (data.type === 'ZONE_ADDED') {
          setZones((prev) => {
            if (prev.some(z => z.id === data.payload.id)) return prev;
            return [...prev, data.payload];
          });
        } else if (data.type === 'ZONE_REMOVED') {
          setZones((prev) => prev.filter(z => z.id !== data.payload.zoneId));
        }
      } catch (error) {
        console.error("Failed to parse fleet data", error);
      }
    };

    wsRef.current.onclose = () => {
      setIsConnected(false);
      console.log('Disconnected from Fleet Command WebSocket');
      // Reconnection logic could go here
    };

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url]);

  return { fleetState, activeAlerts, zones, isConnected, socket: wsRef.current };
}
