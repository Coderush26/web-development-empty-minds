# Frontend Integration Guide

## Quick Answer

**Yes, frontend integration is mostly URL changes + listening to WebSocket events.**

The backend is REST + WebSocket. Your frontend needs to:

1. Change all API URLs from `localhost:3001` to the production backend URL
2. Connect to the WebSocket and listen for real-time events
3. That's it — the API contract stays the same

---

## API URL Configuration

### Development

```typescript
const API_BASE = "http://localhost:3001/api";
const WS_URL = "ws://localhost:3001/ws";
```

### Production (Render)

```typescript
const API_BASE = "https://your-service.onrender.com/api";
const WS_URL = "wss://your-service.onrender.com/ws";
```

### Environment-based (Recommended)

```typescript
const isDev = process.env.NODE_ENV === "development";
const API_BASE = isDev
  ? "http://localhost:3001/api"
  : process.env.REACT_APP_API_URL || "https://your-service.onrender.com/api";
const WS_URL = isDev
  ? "ws://localhost:3001/ws"
  : process.env.REACT_APP_WS_URL || "wss://your-service.onrender.com/ws";
```

---

## HTTP Route Integration

All the routes you test in Swagger UI remain exactly the same.

### Example: Get all ships

```typescript
// Development
fetch("http://localhost:3001/api/ships");

// Production
fetch("https://your-service.onrender.com/api/ships");

// The endpoint is the same: /api/ships
```

### Pattern

Everything under `/api/**` stays the same:

- `GET /api/ships` → list all ships
- `GET /api/ships/:shipId` → single ship details
- `POST /api/zones` → create zone (with auth token)
- `POST /api/directives` → issue directive (with auth token)
- etc.

**Only the domain changes.**

---

## WebSocket Integration

This is where the real-time magic happens.

### Connection

frontend connects when the app loads:

```typescript
let ws: WebSocket;

function connectWebSocket(role: "command" | "captain", shipId?: string) {
  const baseUrl = isDev
    ? "ws://localhost:3001/ws"
    : "wss://your-service.onrender.com/ws";

  const url = new URL(baseUrl);
  url.searchParams.set("role", role);
  if (shipId) {
    url.searchParams.set("shipId", shipId);
  }

  ws = new WebSocket(url.toString());

  ws.onopen = () => {
    console.log("Connected to backend");
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleSocketMessage(msg);
  };

  ws.onerror = (err) => {
    console.error("WebSocket error", err);
  };

  ws.onclose = () => {
    console.log("Disconnected, attempting reconnect...");
    // Reconnect after 3 seconds
    setTimeout(() => connectWebSocket(role, shipId), 3000);
  };
}
```

### Message handling

The first message you receive is `FLEET_STATE`:

```typescript
function handleSocketMessage(msg) {
  switch (msg.type) {
    case "FLEET_STATE":
      // Full fleet snapshot on connect
      console.log("Ships:", msg.payload.ships);
      console.log("Zones:", msg.payload.zones);
      break;

    case "ZONE_ADDED":
      // New zone was created
      console.log("Zone added:", msg.payload);
      break;

    case "DIRECTIVE_ISSUED":
      // Command issued a directive
      console.log("Directive:", msg.payload);
      break;

    case "ALERT_FIRED":
      // Alert occurred
      console.log("Alert:", msg.payload);
      break;

    case "FLEET_STATE":
      // Live updates every second/few seconds
      updateMap(msg.payload.ships);
      break;

    case "PONG":
      // Response to your PING
      console.log("Server is alive");
      break;

    default:
      console.log("Unknown message type:", msg.type);
  }
}
```

---

## State Management Pattern

### React + Zustand example

```typescript
import create from "zustand";

interface FleetState {
  ships: Ship[];
  zones: RestrictedZone[];
  alerts: Alert[];
  directives: Directive[];
  setShips: (ships: Ship[]) => void;
  setZones: (zones: RestrictedZone[]) => void;
  addAlert: (alert: Alert) => void;
  updateDirective: (directive: Directive) => void;
}

export const useFleetStore = create<FleetState>((set) => ({
  ships: [],
  zones: [],
  alerts: [],
  directives: [],
  setShips: (ships) => set({ ships }),
  setZones: (zones) => set({ zones }),
  addAlert: (alert) => set((state) => ({ alerts: [...state.alerts, alert] })),
  updateDirective: (directive) =>
    set((state) => ({
      directives: state.directives.map((d) =>
        d.id === directive.id ? directive : d,
      ),
    })),
}));

// In the WebSocket handler
function handleSocketMessage(msg) {
  const store = useFleetStore.getState();
  switch (msg.type) {
    case "FLEET_STATE":
      store.setShips(msg.payload.ships);
      store.setZones(msg.payload.zones);
      break;
    case "ALERT_FIRED":
      store.addAlert(msg.payload);
      break;
    // ...
  }
}
```

---

## API Calls Pattern

### Get token (before any protected API call)

```typescript
async function getAuthToken(role: "command" | "captain", shipId?: string) {
  const url = new URL(`${API_BASE}/auth/token`, window.location.origin);
  url.searchParams.set("role", role);
  if (shipId) {
    url.searchParams.set("shipId", shipId);
  }

  const response = await fetch(url, { method: "POST" });
  const data = await response.json();
  return data.token; // JWT token
}
```

### Make authenticated API calls

```typescript
async function createZone(name: string, polygon: Position[]) {
  const token = await getAuthToken("command");
  const response = await fetch(`${API_BASE}/zones`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, polygon }),
  });
  return response.json();
}
```

### Or use a wrapper

```typescript
async function apiCall(
  endpoint: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: any,
  authRequired = false,
) {
  const url = `${API_BASE}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (authRequired) {
    // Get token from localStorage or state
    const token = localStorage.getItem("authToken");
    if (token) {
      options.headers!["Authorization"] = `Bearer ${token}`;
    }
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

// Usage
const ships = await apiCall("/ships");
const zones = await apiCall("/zones", "POST", { name, polygon }, true);
const result = await apiCall(`/zones/${id}`, "DELETE", null, true);
```

---

## Route Endpoints Summary

| Endpoint                  | Method | Auth? | Role    |
| ------------------------- | ------ | ----- | ------- |
| /auth/token               | POST   | No    | -       |
| /ships                    | GET    | No    | -       |
| /ships/:shipId            | GET    | No    | -       |
| /ports                    | GET    | No    | -       |
| /fleet/state              | GET    | No    | -       |
| /fleet/stats              | GET    | No    | -       |
| /zones                    | GET    | No    | -       |
| /zones                    | POST   | Yes   | command |
| /zones/:id                | DELETE | Yes   | command |
| /directives               | GET    | Yes   | any     |
| /directives               | POST   | Yes   | command |
| /directives/:id/respond   | POST   | Yes   | captain |
| /alerts                   | GET    | Yes   | any     |
| /alerts/:id/acknowledge   | POST   | Yes   | command |
| /playback/snapshots       | GET    | Yes   | any     |
| /playback/snapshots/:time | GET    | Yes   | any     |
| /ai/advisory              | GET    | Yes   | command |

---

## TypeScript Types (copy from backend)

From `src/types/index.ts`, import or copy these:

```typescript
interface Ship {
  shipId: string;
  name: string;
  position: Position;
  speed: number;
  heading: number;
  destination: string;
  fuel: number;
  status: ShipStatus;
  cargo: string;
  distanceToDest: number;
  fuelSufficient: boolean;
  inAdverseWeather: boolean;
}

interface Position {
  lat: number;
  lng: number;
}

interface RestrictedZone {
  id: string;
  name: string;
  polygon: Position[];
  active: boolean;
  createdByRole: string;
}

interface Alert {
  id: string;
  type: AlertType;
  shipId?: string;
  severity: AlertSeverity;
  message: string;
  firedAt: number;
  acknowledged: boolean;
}

interface Directive {
  id: string;
  shipId: string;
  type: DirectiveType;
  status: DirectiveStatus;
  payload: any;
  issuedAt: number;
  respondedAt?: number;
  captainResponse?: "ACCEPT" | "ESCALATE_DISTRESS";
}

type ShipStatus =
  | "normal"
  | "rerouting"
  | "distressed"
  | "stopped"
  | "stranded"
  | "arrived"
  | "insufficient_fuel"
  | "out_of_fuel";

type AlertType =
  | "GEOFENCE_BREACH"
  | "PROXIMITY_WARNING"
  | "DISTRESS_SIGNAL"
  | "LOW_FUEL";

type AlertSeverity = "low" | "medium" | "high" | "critical";

type DirectiveType =
  | "REROUTE_PORT"
  | "DIVERT_WAYPOINT"
  | "HOLD_POSITION"
  | "RESUME";

type DirectiveStatus = "PENDING" | "ACCEPTED" | "ESCALATED" | "EXPIRED";
```

---

## Common UI Patterns

### Command Center Dashboard

```typescript
function CommandDashboard() {
  const ships = useFleetStore((s) => s.ships);
  const zones = useFleetStore((s) => s.zones);
  const alerts = useFleetStore((s) => s.alerts);

  return (
    <div>
      <MapComponent ships={ships} zones={zones} />
      <ZoneControls zones={zones} />
      <DirectiveControl ships={ships} />
      <AlertPanel alerts={alerts} />
    </div>
  );
}
```

### Captain's View

```typescript
function CaptainView({ shipId }: { shipId: string }) {
  const myShip = useFleetStore(
    (s) => s.ships.find((sh) => sh.shipId === shipId) || null
  );
  const myDirectives = useFleetStore(
    (s) => s.directives.filter((d) => d.shipId === shipId) || []
  );

  return (
    <div>
      <ShipStatus ship={myShip} />
      <DirectiveResponder directives={myDirectives} />
    </div>
  );
}
```

---

## Environment Variables for Frontend

Create `.env.local` in your frontend:

```env
REACT_APP_API_URL=https://your-service.onrender.com/api
REACT_APP_WS_URL=wss://your-service.onrender.com/ws
```

Or in Next.js:

```env
NEXT_PUBLIC_API_URL=https://your-service.onrender.com/api
NEXT_PUBLIC_WS_URL=wss://your-service.onrender.com/ws
```

---

## CORS Handling

The backend is pre-configured with CORS for:

- `http://localhost:5173` (Vite)
- `http://localhost:3000` (Next.js)
- Your frontend URL in `FRONTEND_URL` env var

When you deploy your frontend, make sure to set `FRONTEND_URL` in Render backend environment.

---

## Deployment Checklist

- [ ] Frontend environment variables set correctly
- [ ] API base URL uses production backend
- [ ] WebSocket URL uses `wss://` instead of `ws://`
- [ ] Authentication token stored securely
- [ ] WebSocket reconnects on disconnect
- [ ] Real-time events update the UI
- [ ] All routes tested end-to-end
- [ ] CORS issues resolved

---

## TL;DR: Integration is URL Swapping + WebSocket Listening

Your frontend code stays the same; only the URLs change:

```typescript
// Before: localhost
fetch("http://localhost:3001/api/ships");
const ws = new WebSocket("ws://localhost:3001/ws");

// After: production
fetch("https://your-service.onrender.com/api/ships");
const ws = new WebSocket("wss://your-service.onrender.com/ws");

// Everything else: identical
```
