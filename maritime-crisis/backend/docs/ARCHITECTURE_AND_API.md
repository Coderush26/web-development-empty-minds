# Maritime Crisis Backend - Complete Architecture & Flow Documentation

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Data Flow](#data-flow)
3. [API Reference](#api-reference)
4. [WebSocket Protocol](#websocket-protocol)
5. [Database Schema](#database-schema)
6. [Configuration](#configuration)
7. [Deployment Guide](#deployment-guide)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React/Next.js)                     │
│                  (fe/src in same workspace)                      │
└─────────────────┬───────────────────────────────────────────────┘
                  │ REST API + WebSocket
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│              Backend (Express 5 + Node.js)                       │
│              (maritime-crisis/backend)                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ HTTP Server (Port 3001)                                 │   │
│  │ • REST API endpoints (/ships, /zones, /directives, etc)  │   │
│  │ • WebSocket server (/ws)                                │   │
│  │ • Swagger UI (/api-docs)                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Simulation Engine (Tick Loop @ 1Hz)                      │   │
│  │ • Ship position advancement                              │   │
│  │ • Fuel consumption with weather penalty                  │   │
│  │ • Geofence breach detection                              │   │
│  │ • Proximity warning checks                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Routing Engine (A*)                                      │   │
│  │ • Pathfinding with navigable water constraints           │   │
│  │ • Restricted zone avoidance                              │   │
│  │ • Dynamic reroute when path blocked                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Services                                                 │   │
│  │ • Weather: Open-Meteo API integration                    │   │
│  │ • AI: Groq distress analysis                             │   │
│  │ • Alerts: Geofence, proximity, fuel status               │   │
│  │ • Playback: Snapshot capture & retrieval                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Repository Layer                                         │   │
│  │ • Fleet Store (in-memory state)                          │   │
│  │ • Prisma ORM (database persistence)                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────────┐
│          Database (PostgreSQL via Supabase)                      │
│                                                                  │
│  • Ships, Ports, Directives, Alerts                            │
│  • RestrictedZones, WeatherCache, Snapshots                    │
└─────────────────────────────────────────────────────────────────┘
```

### Folder Structure

```
src/
├── ai/                    # AI service (Groq distress analysis)
│   └── ai-service.ts      # Analyze distress messages, generate fleet advisory
├── alerts/                # Alert generation engine
│   ├── alert-engine.ts    # Central alert coordinator
│   ├── geofence.ts        # Geofence breach detection
│   └── proximity.ts       # Proximity warning checks
├── config/                # Configuration & environment
│   ├── index.ts           # Load from .env
│   ├── fleet.json         # 15 ships + ports + navigable water polygon
│   └── swagger.json       # API documentation
├── controllers/           # HTTP request handlers
│   ├── auth.controller.ts      # JWT generation & me endpoint
│   ├── fleet.controller.ts     # Ships, ports, fleet state
│   ├── zone.controller.ts      # Restricted zone CRUD
│   ├── directive.controller.ts # Directive issuance & captain response
│   ├── alert.controller.ts     # Alert retrieval & acknowledgement
│   ├── playback.controller.ts  # Snapshot queries
│   └── ai.controller.ts        # Fleet advisory
├── db/                    # Database connection & utilities
│   └── client.ts          # Prisma client setup
├── geofence/              # Geofence logic (geometry)
│   └── geofence.ts        # Zone containment checks
├── middleware/            # Express middleware
│   ├── auth.ts            # JWT authentication & role enforcement
│   └── error.ts           # Error handling
├── playback/              # Snapshot management
│   └── playback-service.ts # Capture & retrieve fleet snapshots
├── routing/               # Pathfinding algorithms
│   ├── astar.ts           # A* implementation with grid + obstacles
│   └── astar-repro.ts     # Testing script for routing
├── services/              # Business logic services
│   └── [other services]
├── simulation/            # Ship movement simulator
│   ├── simulator.ts       # Main tick loop
│   └── fleet-store.ts     # In-memory fleet state repository
├── types/                 # TypeScript interfaces
│   └── index.ts           # App config, ship state, alert types, etc
├── utils/                 # Utilities
│   ├── geo.ts             # Distance, bearing, polygon math
│   ├── logger.ts          # Structured logging
│   └── [helpers]
├── weather/               # Weather service
│   └── weather-service.ts # Open-Meteo integration
├── websocket/             # WebSocket server
│   └── ws-manager.ts      # Client connections & broadcasts
├── app.ts                 # Express app setup (routes, middleware)
├── server.ts              # HTTP server, simulator wiring
└── routes.ts              # Route definitions
```

---

## Data Flow

### 1. **Ship Movement Cycle (Every Tick = 1 Second)**

```
Tick Fired (timer every 1000ms)
    ↓
For each ship:
    1. Get current position & path
    ↓
    2. Compute distance to move:
       distance_km = (speed_knots × tick_duration_s) / 60 × 1.852
    ↓
    3. Move ship along path:
       new_position = movePosition(current_pos, heading, distance_km)
    ↓
    4. Check for arrival:
       if distance_to_dest < 2km → status = "arrived"
    ↓
    5. Calculate fuel burn:
       base_burn = (speed_knots × time_s) / 3600 × FUEL_BURN_RATE
       if (in_adverse_weather) → burn *= 1.30
    ↓
    6. Check fuel status:
       if fuel < 500 tons → status = "insufficient_fuel"
       if fuel <= 0 → status = "out_of_fuel"
    ↓
    7. Update weather status:
       check if position in adverse weather zone
    ↓
    8. Check geofence breach:
       for each active zone:
           if pointInPolygon(ship.position, zone.polygon):
               → Alert: GEOFENCE_BREACH
               → Status: rerouting
               → Trigger new route computation
    ↓
    9. Check proximity warnings:
       for each pair of ships:
           if distance < 2km:
               → Alert: PROXIMITY_WARNING
    ↓
    10. Update all ships in fleet store
    ↓
Broadcast FLEET_STATE to all WebSocket clients
    ↓
Capture snapshots every 30 seconds
    ↓
Save to database
```

### 2. **Restricted Zone Creation Flow**

```
Captain/Command draws polygon on map (React Leaflet)
    ↓
Frontend sends POST /api/zones {name, polygon}
    ↓
Backend validates zone (polygon format, not in restricted area)
    ↓
Save to database via Prisma
    ↓
Check if zone intersects any active ship paths:
    for each ship:
        if pathNeedsReroute(ship.path, new_zone):
            → Trigger immediate reroute
            → Compute new path via A*
            → Update ship status to "rerouting"
    ↓
Broadcast ZONE_ADDED to all WebSocket clients
    ↓
Clients render zone polygon on map
```

### 3. **Directive Issuance Flow**

```
Command selects ship & issues directive (REROUTE_PORT, HOLD_POSITION, etc)
    ↓
Backend receives POST /api/directives
    ↓
Validate: user role is "command"
    ↓
Save directive to database (status = PENDING)
    ↓
Broadcast DIRECTIVE_ISSUED to the captain's WebSocket
    ↓
Captain receives notification, sees directive details
    ↓
Captain chooses: ACCEPT or ESCALATE_DISTRESS
    ↓
Backend receives POST /api/directives/:id/respond {response, distressMessage?}
    ↓
If ACCEPT:
    → Update directive.status = "ACCEPTED"
    → Update ship destination/waypoint from directive payload
    → Trigger reroute computation
    → Broadcast DIRECTIVE_RESPONDED to Command
    ↓
If ESCALATE_DISTRESS:
    → Save distress message
    → Send to Groq AI for analysis
    → Extract severity, issue type, damage estimate
    → Create DISTRESS_SIGNAL alert
    → Broadcast to all clients
```

### 4. **Alert Generation & Notification**

```
Alert Engine continuously monitors:
    • Geofence breaches (every tick)
    • Proximity (<2km)
    • Fuel status (critical)
    • Ship status changes (out of fuel, stranded)
    ↓
When alert triggered:
    1. Create Alert record in database
    2. Add to in-memory alert queue
    3. Broadcast ALERT_FIRED via WebSocket
    4. Frontend receives, shows toast notification
       & displays in alert list
    ↓
User acknowledges alert:
    → Update alert.acknowledged = true
    → Persist to database
    → Remove from active alerts on frontend
```

### 5. **AI Distress Analysis**

```
Captain sends ESCALATE_DISTRESS with message:
    "Engine room fire, 2 crew injured, need immediate assistance"
    ↓
Backend receives & passes to AI service
    ↓
Call Groq API with structured prompt:
    {
      role: "system",
      content: "Extract severity, issue type, injury count, etc. Return JSON only."
    },
    {
      role: "user",
      content: "Engine room fire, 2 crew injured..."
    }
    ↓
Parse Groq response: {severity: "critical", issueType: "fire", injuryCount: 2, ...}
    ↓
Persist AI analysis to directive.aiAnalysis
    ↓
Create alert with analyzed severity
    ↓
Broadcast to Command with structured data
```

---

## API Reference

### Authentication

#### `POST /api/auth/token`

**Generate JWT token for a role**

Request:

```json
{
  "role": "command" | "captain",
  "shipId": "MV-1"  // required for captain role
}
```

Response:

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "role": "command",
    "shipId": "MV-1",
    "expiresIn": "24h"
  },
  "timestamp": 1778321470955
}
```

#### `GET /api/auth/me`

**Get current user info (requires JWT auth)**

Headers:

```
Authorization: Bearer <token>
```

Response:

```json
{
  "success": true,
  "data": {
    "role": "command",
    "shipId": "MV-1",
    "sessionId": "..."
  },
  "timestamp": 1778321470955
}
```

---

### Fleet Management

#### `GET /api/ships`

**Get all 15 ships**

Query Parameters:

- `status` (optional): Filter by status (normal, rerouting, distressed, etc)

Response:

```json
{
  "success": true,
  "data": [
    {
      "shipId": "MV-1",
      "name": "Aurora",
      "position": {"lat": 26.55, "lng": 56.20},
      "speed": 14,
      "heading": 105,
      "destination": "MCT-1",
      "fuel": 6800,
      "cargo": "crude oil",
      "status": "normal",
      "inAdverseWeather": false,
      "distanceToDest": 150.3,
      "fuelSufficient": true,
      "lastUpdated": 1778321470955
    },
    ...
  ],
  "timestamp": 1778321470955
}
```

#### `GET /api/ships/:shipId`

**Get single ship details**

Response: Same as individual ship object from /ships

#### `GET /api/ports`

**Get all 10 ports**

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "MCT-1",
      "name": "Muscat",
      "position": {"lat": 23.92, "lng": 58.58}
    },
    ...
  ],
  "timestamp": 1778321470955
}
```

#### `GET /api/fleet/state`

**Get current fleet state (all ships + zones + alerts)**

Response:

```json
{
  "success": true,
  "data": {
    "ships": [...],
    "zones": [...],
    "alerts": [...],
    "timestamp": 1778321470955
  },
  "timestamp": 1778321470955
}
```

#### `GET /api/fleet/stats`

**Get fleet statistics**

Response:

```json
{
  "success": true,
  "data": {
    "totalShips": 15,
    "normalShips": 12,
    "reroutingShips": 2,
    "distressedShips": 1,
    "arrivedShips": 0,
    "outOfFuelShips": 0,
    "averageFuel": 6450.5,
    "totalAcctiveAlerts": 3
  },
  "timestamp": 1778321470955
}
```

---

### Restricted Zones

#### `GET /api/zones`

**Get all restricted zones**

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "zone-123",
      "name": "Red Zone A",
      "polygon": [
        { "lat": 26.0, "lng": 55.0 },
        { "lat": 26.5, "lng": 55.0 },
        { "lat": 26.5, "lng": 55.5 },
        { "lat": 26.0, "lng": 55.5 }
      ],
      "active": true,
      "createdByRole": "command",
      "createdAt": 1778321470955
    }
  ],
  "timestamp": 1778321470955
}
```

#### `POST /api/zones`

**Create restricted zone (Command only)**

Headers:

```
Authorization: Bearer <command_token>
```

Request:

```json
{
  "name": "Red Zone A",
  "polygon": [
    { "lat": 26.0, "lng": 55.0 },
    { "lat": 26.5, "lng": 55.0 },
    { "lat": 26.5, "lng": 55.5 },
    { "lat": 26.0, "lng": 55.5 }
  ]
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "zone-123",
    "name": "Red Zone A",
    "polygon": [...],
    "active": true,
    "createdByRole": "command",
    "createdAt": 1778321470955
  },
  "timestamp": 1778321470955
}
```

#### `DELETE /api/zones/:zoneId`

**Delete zone (Command only)**

Headers:

```
Authorization: Bearer <command_token>
```

Response:

```json
{
  "success": true,
  "data": { "id": "zone-123", "deleted": true },
  "timestamp": 1778321470955
}
```

---

### Directives

#### `POST /api/directives`

**Issue directive (Command only)**

Request:

```json
{
  "shipId": "MV-1",
  "type": "REROUTE_PORT" | "DIVERT_WAYPOINT" | "HOLD_POSITION" | "RESUME",
  "payload": {
    "portId": "DOH-1"  // for REROUTE_PORT
    // OR
    "waypoint": {"lat": 26.0, "lng": 55.0}  // for DIVERT_WAYPOINT
  }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "dir-456",
    "shipId": "MV-1",
    "type": "REROUTE_PORT",
    "payload": { "portId": "DOH-1" },
    "status": "PENDING",
    "issuedAt": 1778321470955
  },
  "timestamp": 1778321470955
}
```

#### `GET /api/directives`

**Get all directives (requires auth)**

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "dir-456",
      "shipId": "MV-1",
      "type": "REROUTE_PORT",
      "status": "PENDING" | "ACCEPTED" | "ESCALATED" | "EXPIRED",
      "issuedAt": 1778321470955,
      "respondedAt": null,
      "captainResponse": null,
      "distressMessage": null,
      "aiAnalysis": null
    }
  ],
  "timestamp": 1778321470955
}
```

#### `POST /api/directives/:directiveId/respond`

**Captain responds to directive**

Request:

```json
{
  "response": "ACCEPT" | "ESCALATE_DISTRESS",
  "distressMessage": "Engine trouble, need assistance"  // if ESCALATE_DISTRESS
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "dir-456",
    "status": "ACCEPTED" | "ESCALATED",
    "captainResponse": "ACCEPT" | "ESCALATE_DISTRESS",
    "distressMessage": "...",
    "aiAnalysis": {
      "severity": "medium",
      "issueType": "engine failure",
      "recommendedAction": "Proceed to nearest port for repairs"
    },
    "respondedAt": 1778321470955
  },
  "timestamp": 1778321470955
}
```

---

### Alerts

#### `GET /api/alerts`

**Get active and historical alerts**

Query Parameters:

- `severity` (optional): "low", "medium", "high", "critical"
- `type` (optional): "GEOFENCE_BREACH", "PROXIMITY_WARNING", "DISTRESS_SIGNAL", etc
- `limit` (optional): Max results (default 50)

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "alert-789",
      "type": "GEOFENCE_BREACH",
      "shipId": "MV-1",
      "zoneId": "zone-123",
      "severity": "high",
      "message": "Ship MV-1 Aurora entered Red Zone A",
      "acknowledged": false,
      "firedAt": 1778321470955,
      "acknowledgedAt": null,
      "metadata": {
        "zoneRadius": 2.0,
        "distanceIntoZone": 0.5
      }
    }
  ],
  "timestamp": 1778321470955
}
```

#### `POST /api/alerts/:alertId/acknowledge`

**Acknowledge alert (Command only)**

Response:

```json
{
  "success": true,
  "data": {
    "id": "alert-789",
    "acknowledged": true,
    "acknowledgedAt": 1778321470955
  },
  "timestamp": 1778321470955
}
```

---

### Playback

#### `GET /api/playback/snapshots`

**Get available snapshots (30-second intervals, last hour)**

Query Parameters:

- `limit` (optional): Max snapshots (default 120 = 1 hour)

Response:

```json
{
  "success": true,
  "data": [
    {
      "capturedAt": 1778321400000,
      "timestamp": "2026-05-09T12:30:00Z"
    },
    ...
  ],
  "timestamp": 1778321470955
}
```

#### `GET /api/playback/snapshots/:timestamp`

**Get snapshot at specific timestamp**

Response:

```json
{
  "success": true,
  "data": {
    "capturedAt": 1778321400000,
    "fleetState": [
      {
        "shipId": "MV-1",
        "position": {"lat": 26.55, "lng": 56.20},
        "fuel": 6750,
        "status": "normal",
        ...
      }
    ],
    "activeAlerts": [...],
    "activeZones": [...],
    "events": [
      {
        "type": "GEOFENCE_BREACH",
        "shipId": "MV-1",
        "description": "MV-1 entered Red Zone A",
        "timestamp": 1778321390000
      }
    ]
  },
  "timestamp": 1778321470955
}
```

---

### AI

#### `GET /api/ai/advisory`

**Get fleet advisory from AI (Command only)**

Response:

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "type": "MONITOR" | "REROUTE" | "ZONE_SUGGESTION" | "SEND_AID",
        "shipId": "MV-1",
        "priority": "low" | "medium" | "high" | "critical",
        "action": "Monitor fuel consumption on MV-1",
        "reasoning": "Ship approaching low fuel threshold"
      }
    ],
    "overallSituation": "Fleet operating normally with 1 advisory item"
  },
  "timestamp": 1778321470955
}
```

---

## WebSocket Protocol

### Connection

**URL**: `ws://localhost:3001/ws?role=command&shipId=MV-1`

**Query Parameters**:

- `role` (required): "command" or "captain"
- `shipId` (required for captain): "MV-1", "MV-2", etc

### Message Types

#### Incoming (Server → Client)

##### `FLEET_STATE`

Sent every tick (1 Hz) with current ship positions and status

```json
{
  "type": "FLEET_STATE",
  "payload": {
    "ships": [
      {
        "shipId": "MV-1",
        "position": { "lat": 26.55, "lng": 56.2 },
        "speed": 14,
        "heading": 105,
        "fuel": 6750,
        "status": "normal",
        "lastUpdated": 1778321471000
      }
    ]
  },
  "timestamp": 1778321471000
}
```

##### `ALERT_FIRED`

When a new alert is triggered

```json
{
  "type": "ALERT_FIRED",
  "payload": {
    "id": "alert-789",
    "type": "GEOFENCE_BREACH",
    "shipId": "MV-1",
    "severity": "high",
    "message": "Ship MV-1 Aurora entered Red Zone A",
    "firedAt": 1778321471000
  },
  "timestamp": 1778321471000
}
```

##### `ZONE_ADDED`

When Command creates a restricted zone

```json
{
  "type": "ZONE_ADDED",
  "payload": {
    "id": "zone-123",
    "name": "Red Zone A",
    "polygon": [...],
    "active": true,
    "createdAt": 1778321471000
  },
  "timestamp": 1778321471000
}
```

##### `ZONE_REMOVED`

When Command deletes a zone

```json
{
  "type": "ZONE_REMOVED",
  "payload": {
    "id": "zone-123",
    "name": "Red Zone A"
  },
  "timestamp": 1778321471000
}
```

##### `DIRECTIVE_ISSUED`

When Command issues a directive to a ship

```json
{
  "type": "DIRECTIVE_ISSUED",
  "payload": {
    "id": "dir-456",
    "shipId": "MV-1",
    "type": "REROUTE_PORT",
    "payload": { "portId": "DOH-1" },
    "status": "PENDING",
    "issuedAt": 1778321471000
  },
  "timestamp": 1778321471000
}
```

##### `DIRECTIVE_RESPONDED`

When Captain responds to directive

```json
{
  "type": "DIRECTIVE_RESPONDED",
  "payload": {
    "id": "dir-456",
    "shipId": "MV-1",
    "status": "ACCEPTED",
    "captainResponse": "ACCEPT",
    "respondedAt": 1778321471000
  },
  "timestamp": 1778321471000
}
```

#### Outgoing (Client → Server)

##### `PING`

Keep-alive message

```json
{
  "type": "PING",
  "payload": null,
  "timestamp": 1778321471000
}
```

Server responds with:

```json
{
  "type": "PONG",
  "payload": null,
  "timestamp": 1778321471000
}
```

---

## Database Schema

### Core Models

#### `Ship`

```prisma
model Ship {
  id                String       @id @default(cuid())
  shipId            String       @unique       // MV-1, MV-2, etc
  name              String                     // Aurora, Borealis, etc
  position          Json                       // {lat: float, lng: float}
  speed             Float                      // knots
  heading           Float                      // degrees true north (0-360)
  destination       String                     // port ID
  destinationPort   Port?        @relation(fields: [destination], references: [id])
  fuel              Float                      // tons remaining
  cargo             String                     // crude oil, containers, etc
  status            String                     // normal|rerouting|distressed|stranded|out_of_fuel|arrived
  path              Json                       // [{lat, lng}, ...] waypoints
  inAdverseWeather  Boolean      @default(false)
  distanceToDest    Float                      // nautical miles
  fuelSufficient    Boolean      @default(true)
  assignedCaptainId String?                    // captain user ID (future)
  lastUpdated       DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  // Relations
  directives        Directive[]
  alerts            Alert[]      @relation("ShipAlerts")
  alertsB           Alert[]      @relation("ShipB")

  @@index([shipId])
  @@index([status])
}
```

#### `RestrictedZone`

```prisma
model RestrictedZone {
  id            String   @id @default(cuid())
  name          String   // Red Zone A, etc
  polygonCoords Json     // [{lat, lng}, ...] closed polygon
  active        Boolean  @default(true)
  createdByRole String   // command|captain
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  alerts        Alert[]

  @@index([active])
}
```

#### `Directive`

```prisma
model Directive {
  id              String   @id @default(cuid())
  ship            Ship     @relation(fields: [shipId], references: [id], onDelete: Cascade)
  shipId          String
  issuedByRole    String   // command|captain
  type            String   // REROUTE_PORT|DIVERT_WAYPOINT|HOLD_POSITION|RESUME
  payload         Json     // {portId?: string, waypoint?: {lat, lng}}
  status          String   // PENDING|ACCEPTED|ESCALATED|EXPIRED
  captainResponse String?  // ACCEPT|ESCALATE_DISTRESS
  distressMessage String?
  aiAnalysis      Json?    // {severity, issueType, injuryCount, damageEstimate, recommendedAction}
  issuedAt        DateTime @default(now())
  respondedAt     DateTime?
  updatedAt       DateTime @updatedAt

  @@index([shipId])
  @@index([status])
}
```

#### `Alert`

```prisma
model Alert {
  id             String         @id @default(cuid())
  type           String         // GEOFENCE_BREACH|PROXIMITY_WARNING|DISTRESS_SIGNAL|etc
  ship           Ship?          @relation("ShipAlerts", fields: [shipId], references: [id], onDelete: SetNull)
  shipId         String?
  shipB          Ship?          @relation("ShipB", fields: [shipIdB], references: [id], onDelete: SetNull)
  shipIdB        String?        // for proximity warnings
  zone           RestrictedZone? @relation(fields: [zoneId], references: [id], onDelete: SetNull)
  zoneId         String?
  severity       String         // low|medium|high|critical
  message        String
  metadata       Json           // alert-specific data
  acknowledged   Boolean        @default(false)
  firedAt        DateTime
  acknowledgedAt DateTime?
  updatedAt      DateTime       @updatedAt

  @@index([shipId])
  @@index([type])
  @@index([severity])
}
```

#### `Snapshot`

```prisma
model Snapshot {
  id         String   @id @default(cuid())
  capturedAt DateTime @default(now())
  fleetState Json     // [{shipId, position, fuel, status, ...}, ...]
  activeAlerts Json   // [{id, type, shipId, severity, ...}, ...]
  activeZones  Json   // [{id, name, polygon, ...}, ...]
  events     Json?    // [{type, shipId, description, timestamp}, ...]

  @@index([capturedAt])
}
```

#### `WeatherCache`

```prisma
model WeatherCache {
  id        String   @id @default(cuid())
  lat       Float
  lng       Float
  data      Json     // {windSpeed, waveHeight, isAdverse, ...}
  isAdverse Boolean
  fetchedAt DateTime
  expiresAt DateTime

  @@unique([lat, lng])
  @@index([expiresAt])
}
```

#### `Port`

```prisma
model Port {
  id       String  @id         // KWT-1, BUS-1, etc
  name     String              // Kuwait City, Bushehr, etc
  position Json                // {lat: float, lng: float}
  ships    Ship[]              // ships with this destination
}
```

---

## Configuration

### Environment Variables (`.env`)

```bash
# Database
DATABASE_URL="postgresql://..."           # Primary connection (pooler for serverless)
DIRECT_URL="postgresql://..."             # Direct connection (for migrations)

# Server
PORT="3001"
WS_PORT="3001"
NODE_ENV="development"

# Security
JWT_SECRET="64-char-random-string-min"    # Generate: crypto.randomBytes(32).toString('hex')

# AI
GROQ_API_KEY="gsk_..."                    # From https://console.groq.com/keys

# Simulation Tuning
TICK_INTERVAL_MS="1000"                   # 1 Hz = 1 second between ticks
WEATHER_CACHE_TTL_MS="300000"             # 5 minutes
SNAPSHOT_INTERVAL_MS="30000"              # 30 seconds
SNAPSHOT_RETENTION_COUNT="120"            # 1 hour history

# Thresholds
PROXIMITY_THRESHOLD_KM="2.0"              # km
ADVERSE_WEATHER_FUEL_PENALTY="0.30"       # 30% extra fuel

# Routing
GRID_RES_DEG="0.15"                       # 0.15° = ~16km per grid cell
```

---

## Deployment Guide

### Local Development

1. **Setup Database**

   ```bash
   # Ensure PostgreSQL is running
   # (or use Supabase for cloud PostgreSQL)

   # Create .env with DATABASE_URL
   # Run migrations
   npx prisma migrate dev
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Build & Run**

   ```bash
   npm run build
   npm start
   ```

4. **Access**
   - API: http://localhost:3001
   - Swagger UI: http://localhost:3001/api-docs
   - WebSocket: ws://localhost:3001/ws?role=command

### Docker (Local)

```bash
# Build image
docker build -t maritime-crisis-backend .

# Run container
docker run -p 3001:3001 \
  -e DATABASE_URL="postgresql://..." \
  -e GROQ_API_KEY="gsk_..." \
  -e JWT_SECRET="..." \
  maritime-crisis-backend
```

### Docker Compose (Full Stack)

```bash
docker-compose up
```

### Render Deployment (Backend)

1. Push code to GitHub
2. Create new Render service
3. Set environment variables
4. Deploy

### Vercel Deployment (Frontend)

1. Push code to GitHub
2. Connect to Vercel
3. Set backend URL environment variable
4. Deploy

---

## Notes

This documentation represents the current state of the backend as of May 9, 2026. The architecture is modular, scalable, and ready for enhancement with bonus features like ship-to-ship assistance, predictive alerts, and multi-option routing.
