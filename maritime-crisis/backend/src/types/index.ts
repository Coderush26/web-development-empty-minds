// ─── Core Domain Types ────────────────────────────────────────────────────────

export type ShipStatus =
  | "normal"
  | "rerouting"
  | "distressed"
  | "stopped"
  | "stranded"
  | "arrived"
  | "insufficient_fuel"
  | "out_of_fuel";

export type DirectiveType =
  | "REROUTE_PORT"
  | "DIVERT_WAYPOINT"
  | "HOLD_POSITION"
  | "RESUME";

export type DirectiveStatus = "PENDING" | "ACCEPTED" | "ESCALATED" | "EXPIRED";

export type AlertType =
  | "GEOFENCE_BREACH"
  | "PROXIMITY_WARNING"
  | "DISTRESS_SIGNAL"
  | "INSUFFICIENT_FUEL"
  | "OUT_OF_FUEL"
  | "STRANDED"
  | "ARRIVED";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type UserRole = "command" | "captain";

// ─── Ship ─────────────────────────────────────────────────────────────────────

export interface Position {
  lat: number;
  lng: number;
}

export interface ShipState {
  shipId: string;
  name: string;
  position: Position;
  speed: number; // knots
  heading: number; // degrees true north
  destination: string; // port id
  fuel: number; // tons remaining
  cargo: string;
  status: ShipStatus;
  path: Position[]; // waypoints remaining
  inAdverseWeather: boolean;
  distanceToDest: number; // nautical miles
  fuelSufficient: boolean;
  assignedCaptainId?: string;
  lastUpdated: number; // unix ms
}

// ─── Port ─────────────────────────────────────────────────────────────────────

export interface Port {
  id: string;
  name: string;
  position: Position;
}

// ─── Zone ─────────────────────────────────────────────────────────────────────

export interface RestrictedZone {
  id: string;
  name: string;
  polygon: Position[]; // closed polygon
  active: boolean;
  createdAt: number;
  createdByRole: UserRole;
}

// ─── Directive ────────────────────────────────────────────────────────────────

export interface DirectivePayload {
  portId?: string;
  waypoint?: Position;
}

export interface AiAnalysis {
  severity: AlertSeverity;
  issueType: string;
  injuryCount?: number;
  damageEstimate?: string;
  recommendedAction: string;
  summary: string;
}

export interface Directive {
  id: string;
  shipId: string;
  issuedByRole: UserRole;
  type: DirectiveType;
  payload: DirectivePayload;
  status: DirectiveStatus;
  captainResponse?: "ACCEPT" | "ESCALATE_DISTRESS";
  distressMessage?: string;
  aiAnalysis?: AiAnalysis;
  issuedAt: number;
  respondedAt?: number;
}

// ─── Alert ────────────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  type: AlertType;
  shipId?: string;
  shipIdB?: string; // for proximity warnings
  zoneId?: string;
  severity: AlertSeverity;
  message: string;
  metadata: Record<string, unknown>;
  acknowledged: boolean;
  firedAt: number;
  acknowledgedAt?: number;
}

// ─── Weather ──────────────────────────────────────────────────────────────────

export interface WeatherData {
  lat: number;
  lng: number;
  windSpeed: number; // km/h
  waveHeight: number; // meters
  isAdverse: boolean;
  fetchedAt: number;
  expiresAt: number;
}

// ─── Snapshot (Playback) ──────────────────────────────────────────────────────

export interface FleetSnapshot {
  capturedAt: number;
  fleetState: ShipState[];
  activeAlerts: Alert[];
  activeZones: RestrictedZone[];
  events: SnapshotEvent[];
}

export interface SnapshotEvent {
  type: string;
  shipId?: string;
  description: string;
  timestamp: number;
}

// ─── WebSocket Messages ───────────────────────────────────────────────────────

export type WsMessageType =
  | "FLEET_STATE"
  | "SHIP_UPDATE"
  | "ALERT_FIRED"
  | "ALERT_ACKNOWLEDGED"
  | "ZONE_ADDED"
  | "ZONE_REMOVED"
  | "DIRECTIVE_ISSUED"
  | "DIRECTIVE_RESPONDED"
  | "PROXIMITY_WARNING"
  | "PLAYBACK_SNAPSHOT"
  | "WEATHER_UPDATE"
  | "PING"
  | "PONG";

export interface WsMessage<T = unknown> {
  type: WsMessageType;
  payload: T;
  timestamp: number;
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface AppConfig {
  port: number;
  wsPort: number;
  databaseUrl: string;
  groqApiKey: string;
  openMeteoBaseUrl: string;
  tickIntervalMs: number;
  weatherCacheTtlMs: number;
  snapshotIntervalMs: number;
  snapshotRetentionCount: number;
  proximityThresholdKm: number;
  adverseWeatherFuelPenalty: number;
  jwtSecret: string;
  nodeEnv: string;
}
