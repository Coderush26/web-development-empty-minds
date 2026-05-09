import type {
  ShipState,
  RestrictedZone,
  Alert,
  Directive,
  Port,
} from "../types/index.js";

/**
 * FleetStore is the in-memory single source of truth for real-time fleet state.
 * All services read/write through this store.
 * Prisma is used for persistence (alerts, directives, snapshots).
 */
class FleetStore {
  private ships = new Map<string, ShipState>();
  private zones = new Map<string, RestrictedZone>();
  private alerts = new Map<string, Alert>();
  private directives = new Map<string, Directive>();
  private ports = new Map<string, Port>();

  // ─── Ships ──────────────────────────────────────────────────────────────────

  setShip(ship: ShipState): void {
    this.ships.set(ship.shipId, { ...ship });
  }

  getShip(id: string): ShipState | undefined {
    return this.ships.get(id);
  }

  getAllShips(): ShipState[] {
    return Array.from(this.ships.values());
  }

  updateShip(id: string, partial: Partial<ShipState>): ShipState | undefined {
    const ship = this.ships.get(id);
    if (!ship) return undefined;
    const updated = { ...ship, ...partial, lastUpdated: Date.now() };
    this.ships.set(id, updated);
    return updated;
  }

  // ─── Zones ──────────────────────────────────────────────────────────────────

  setZone(zone: RestrictedZone): void {
    this.zones.set(zone.id, { ...zone });
  }

  getZone(id: string): RestrictedZone | undefined {
    return this.zones.get(id);
  }

  getAllZones(): RestrictedZone[] {
    return Array.from(this.zones.values());
  }

  removeZone(id: string): boolean {
    return this.zones.delete(id);
  }

  // ─── Alerts ─────────────────────────────────────────────────────────────────

  setAlert(alert: Alert): void {
    this.alerts.set(alert.id, { ...alert });
  }

  getAlert(id: string): Alert | undefined {
    return this.alerts.get(id);
  }

  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  getActiveAlerts(): Alert[] {
    return this.getAllAlerts().filter((a) => !a.acknowledged);
  }

  acknowledgeAlert(id: string): Alert | undefined {
    const alert = this.alerts.get(id);
    if (!alert) return undefined;
    const updated = {
      ...alert,
      acknowledged: true,
      acknowledgedAt: Date.now(),
    };
    this.alerts.set(id, updated);
    return updated;
  }

  // ─── Directives ─────────────────────────────────────────────────────────────

  setDirective(directive: Directive): void {
    this.directives.set(directive.id, { ...directive });
  }

  getDirective(id: string): Directive | undefined {
    return this.directives.get(id);
  }

  getDirectivesForShip(shipId: string): Directive[] {
    return Array.from(this.directives.values()).filter(
      (d) => d.shipId === shipId,
    );
  }

  updateDirective(
    id: string,
    partial: Partial<Directive>,
  ): Directive | undefined {
    const d = this.directives.get(id);
    if (!d) return undefined;
    const updated = { ...d, ...partial };
    this.directives.set(id, updated);
    return updated;
  }

  // ─── Ports ──────────────────────────────────────────────────────────────────

  setPort(port: Port): void {
    this.ports.set(port.id, port);
  }

  getPort(id: string): Port | undefined {
    return this.ports.get(id);
  }

  getAllPorts(): Port[] {
    return Array.from(this.ports.values());
  }

  // ─── Snapshot helper ────────────────────────────────────────────────────────

  getFullState() {
    return {
      ships: this.getAllShips(),
      zones: this.getAllZones(),
      alerts: this.getActiveAlerts(),
      ports: this.getAllPorts(),
    };
  }
}

// Singleton
export const fleetStore = new FleetStore();
