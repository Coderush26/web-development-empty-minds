import fleetData from './fleet.json';

export interface Ship {
  shipId: string;
  name: string;
  position: [number, number];
  speed: number;
  heading: number;
  destination: string;
  fuel: number;
  cargo: string;
  status: "normal" | "warning" | "critical" | string;
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

// Mock ships data initialized from fleet.json
export const mockShips: Ship[] = fleetData.fleet as Ship[];

// Restricted zones
export const restrictedZones: RestrictedZone[] = [
  {
    id: "zone-001",
    name: "Military Zone Alpha",
    level: "danger",
    coords: [
      [26.5, 55.5],
      [26.8, 55.5],
      [26.8, 56.0],
      [26.5, 56.0],
    ],
  },
  {
    id: "zone-002",
    name: "Caution Area Beta",
    level: "caution",
    coords: [
      [25.0, 54.0],
      [25.5, 54.0],
      [25.5, 54.8],
      [25.0, 54.8],
    ],
  },
];

// Mock alerts mapped to the new MV-x ships
export const mockAlerts: Alert[] = [
  {
    id: "alert-001",
    shipId: "MV-4",
    type: "communication_loss",
    severity: "critical",
    message: "Dragon - No signal for 15 minutes",
    timestamp: new Date(Date.now() - 15 * 60000),
    read: false,
  },
  {
    id: "alert-002",
    shipId: "MV-2",
    type: "course_change",
    severity: "warning",
    message: "Borealis - Course deviation detected",
    timestamp: new Date(Date.now() - 8 * 60000),
    read: false,
  },
  {
    id: "alert-003",
    shipId: "MV-13",
    type: "communication_loss",
    severity: "critical",
    message: "Mirage - Lost contact 25 minutes ago",
    timestamp: new Date(Date.now() - 25 * 60000),
    read: false,
  },
  {
    id: "alert-004",
    shipId: "MV-8",
    type: "collision_risk",
    severity: "warning",
    message: "Halcyon - Potential collision risk detected",
    timestamp: new Date(Date.now() - 12 * 60000),
    read: false,
  },
];
