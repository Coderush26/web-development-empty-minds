export interface Ship {
  id: string;
  name: string;
  type: "cargo" | "tanker" | "container" | "fishing";
  lat: number;
  lng: number;
  heading: number;
  status: "normal" | "warning" | "critical";
  speed: number;
  destination: string;
  lastSeen: Date;
}

export interface RestrictedZone {
  id: string;
  name: string;
  coords: [number, number][];
  level: "caution" | "danger";
}

export interface Alert {
  id: string;
  shipId: string;
  type: "unauthorized_zone" | "course_change" | "communication_loss" | "collision_risk";
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: Date;
  read: boolean;
}

// Mock ships data (Mediterranean Sea area)
export const mockShips: Ship[] = [
  {
    id: "ship-001",
    name: "MV Aegean Spirit",
    type: "container",
    lat: 40.7128,
    lng: 12.5723,
    heading: 45,
    status: "normal",
    speed: 18.5,
    destination: "Port of Piraeus",
    lastSeen: new Date(Date.now() - 2 * 60000),
  },
  {
    id: "ship-002",
    name: "Tanker Olympus",
    type: "tanker",
    lat: 38.2975,
    lng: 23.6271,
    heading: 120,
    status: "warning",
    speed: 12.3,
    destination: "Alexandria",
    lastSeen: new Date(Date.now() - 5 * 60000),
  },
  {
    id: "ship-003",
    name: "Cargo Aurora",
    type: "cargo",
    lat: 43.2965,
    lng: 16.4401,
    heading: 90,
    status: "normal",
    speed: 15.8,
    destination: "Port of Rijeka",
    lastSeen: new Date(Date.now() - 1 * 60000),
  },
  {
    id: "ship-004",
    name: "FV Neptune",
    type: "fishing",
    lat: 40.5,
    lng: 14.3,
    heading: 200,
    status: "critical",
    speed: 8.2,
    destination: "Unknown",
    lastSeen: new Date(Date.now() - 15 * 60000),
  },
  {
    id: "ship-005",
    name: "Container Star",
    type: "container",
    lat: 37.9577,
    lng: 23.6331,
    heading: 270,
    status: "normal",
    speed: 19.2,
    destination: "Port of Souda",
    lastSeen: new Date(Date.now() - 3 * 60000),
  },
  {
    id: "ship-006",
    name: "Tanker Marathon",
    type: "tanker",
    lat: 42.6432,
    lng: 19.2694,
    heading: 15,
    status: "normal",
    speed: 14.1,
    destination: "Port of Durrës",
    lastSeen: new Date(Date.now() - 4 * 60000),
  },
  {
    id: "ship-007",
    name: "MV Columbia",
    type: "container",
    lat: 41.3275,
    lng: 19.8187,
    heading: 180,
    status: "normal",
    speed: 17.6,
    destination: "Port of Vlorë",
    lastSeen: new Date(Date.now() - 2 * 60000),
  },
  {
    id: "ship-008",
    name: "Cargo Horizon",
    type: "cargo",
    lat: 39.0564,
    lng: 21.7279,
    heading: 45,
    status: "warning",
    speed: 11.9,
    destination: "Port of Igoumenitsa",
    lastSeen: new Date(Date.now() - 8 * 60000),
  },
  {
    id: "ship-009",
    name: "FV Poseidon",
    type: "fishing",
    lat: 40.2,
    lng: 17.5,
    heading: 315,
    status: "normal",
    speed: 6.5,
    destination: "Home Port",
    lastSeen: new Date(Date.now() - 6 * 60000),
  },
  {
    id: "ship-010",
    name: "Container Pacific",
    type: "container",
    lat: 36.8,
    lng: 25.1,
    heading: 90,
    status: "normal",
    speed: 20.1,
    destination: "Port of Haifa",
    lastSeen: new Date(Date.now() - 1 * 60000),
  },
  {
    id: "ship-011",
    name: "Tanker Express",
    type: "tanker",
    lat: 41.9028,
    lng: 12.4964,
    heading: 225,
    status: "normal",
    speed: 13.4,
    destination: "Port of Civitavecchia",
    lastSeen: new Date(Date.now() - 7 * 60000),
  },
  {
    id: "ship-012",
    name: "MV Helios",
    type: "cargo",
    lat: 38.9,
    lng: 20.5,
    heading: 135,
    status: "normal",
    speed: 16.2,
    destination: "Port of Lefkada",
    lastSeen: new Date(Date.now() - 9 * 60000),
  },
  {
    id: "ship-013",
    name: "Fishing Aurora",
    type: "fishing",
    lat: 42.1,
    lng: 18.0,
    heading: 0,
    status: "critical",
    speed: 2.1,
    destination: "Unknown",
    lastSeen: new Date(Date.now() - 25 * 60000),
  },
  {
    id: "ship-014",
    name: "Container Swift",
    type: "container",
    lat: 40.0,
    lng: 15.9,
    heading: 270,
    status: "normal",
    speed: 18.8,
    destination: "Port of Bari",
    lastSeen: new Date(Date.now() - 3 * 60000),
  },
  {
    id: "ship-015",
    name: "Tanker Artemis",
    type: "tanker",
    lat: 39.5,
    lng: 22.9,
    heading: 60,
    status: "warning",
    speed: 10.5,
    destination: "Port of Volos",
    lastSeen: new Date(Date.now() - 12 * 60000),
  },
];

// Restricted zones
export const restrictedZones: RestrictedZone[] = [
  {
    id: "zone-001",
    name: "Military Zone Alpha",
    level: "danger",
    coords: [
      [40.8, 12.2],
      [40.9, 12.2],
      [40.9, 12.4],
      [40.8, 12.4],
    ],
  },
  {
    id: "zone-002",
    name: "Caution Area Beta",
    level: "caution",
    coords: [
      [38.0, 23.5],
      [38.2, 23.5],
      [38.2, 23.8],
      [38.0, 23.8],
    ],
  },
];

// Mock alerts
export const mockAlerts: Alert[] = [
  {
    id: "alert-001",
    shipId: "ship-004",
    type: "communication_loss",
    severity: "critical",
    message: "FV Neptune - No signal for 15 minutes",
    timestamp: new Date(Date.now() - 15 * 60000),
    read: false,
  },
  {
    id: "alert-002",
    shipId: "ship-002",
    type: "course_change",
    severity: "warning",
    message: "Tanker Olympus - Course deviation detected",
    timestamp: new Date(Date.now() - 8 * 60000),
    read: false,
  },
  {
    id: "alert-003",
    shipId: "ship-013",
    type: "communication_loss",
    severity: "critical",
    message: "Fishing Aurora - Lost contact 25 minutes ago",
    timestamp: new Date(Date.now() - 25 * 60000),
    read: false,
  },
  {
    id: "alert-004",
    shipId: "ship-008",
    type: "collision_risk",
    severity: "warning",
    message: "Cargo Horizon - Potential collision risk detected",
    timestamp: new Date(Date.now() - 12 * 60000),
    read: false,
  },
];
