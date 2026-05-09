import { useEffect, useState, useRef } from 'react';

export function useFleetSocket(url = 'ws://localhost:3001/ws?role=command') {
  const [fleetState, setFleetState] = useState<any[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
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
        } else if (data.type === 'ALERT_FIRED') {
          setActiveAlerts((prev) => {
            // Avoid duplicates
            if (prev.some(a => a.id === data.payload.id)) return prev;
            return [data.payload, ...prev];
          });
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

  return { fleetState, activeAlerts, isConnected, socket: wsRef.current };
}
