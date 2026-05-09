import { v4 as uuid } from "uuid";
import { EventEmitter } from "events";
import { fleetStore } from "../simulation/fleet-store.js";
import { distanceKm } from "../utils/geo.js";
import { prisma } from "../db/client.js";
import type {
  Alert,
  AlertType,
  AlertSeverity,
  ShipState,
  RestrictedZone,
} from "../types/index.js";
import { createLogger } from "../utils/logger.js";
import { config } from "../config/index.js";

const logger = createLogger("AlertEngine");

export class AlertEngine extends EventEmitter {
  // Track which proximity pairs are already warned (avoid spam)
  private proximityActive = new Set<string>();
  // Track geofence breaches (shipId:zoneId)
  private geofenceActive = new Set<string>();

  private proximityPairKey(shipIdA: string, shipIdB: string): string {
    return [shipIdA, shipIdB].sort().join(":");
  }

  // ─── Check proximity between all ship pairs ──────────────────────────────

  checkProximity(ships: ShipState[]): void {
    const threshold = config.proximityThresholdKm;

    // Clear pairs that are now far apart
    const currentClose = new Set<string>();

    for (let i = 0; i < ships.length; i++) {
      for (let j = i + 1; j < ships.length; j++) {
        const a = ships[i]!;
        const b = ships[j]!;
        const dist = distanceKm(a.position, b.position);
        const pairKey = this.proximityPairKey(a.shipId, b.shipId);

        if (dist < threshold) {
          currentClose.add(pairKey);
          if (!this.proximityActive.has(pairKey)) {
            this.proximityActive.add(pairKey);
            this.fireAlert({
              type: "PROXIMITY_WARNING",
              shipId: a.shipId,
              shipIdB: b.shipId,
              severity: dist < 0.5 ? "critical" : "high",
              message: `${a.name} and ${b.name} are ${dist.toFixed(2)} km apart`,
              metadata: {
                distanceKm: dist,
                thresholdKm: threshold,
                shipAName: a.name,
                shipBName: b.name,
              },
            });
          }
        }
      }
    }

    // Remove stale proximity pairs
    for (const key of this.proximityActive) {
      if (!currentClose.has(key)) {
        this.proximityActive.delete(key);
        const [shipIdA, shipIdB] = key.split(":");
        if (!shipIdA || !shipIdB) continue;
        const staleAlerts = fleetStore
          .getActiveAlerts()
          .filter(
            (alert) =>
              alert.type === "PROXIMITY_WARNING" &&
              alert.shipId &&
              alert.shipIdB &&
              this.proximityPairKey(alert.shipId, alert.shipIdB) === key,
          );
        for (const alert of staleAlerts) {
          // Auto-resolve proximity warning when ships separate.
          this.acknowledge(alert.id).catch(() => {});
        }
      }
    }
  }

  // ─── Check geofence breaches ─────────────────────────────────────────────

  checkGeofence(ships: ShipState[], zones: RestrictedZone[]): void {
    const activeZones = zones.filter((z) => z.active);
    const nowActive = new Set<string>();

    for (const ship of ships) {
      for (const zone of activeZones) {
        const key = `${ship.shipId}:${zone.id}`;
        // pointInPolygon is checked by simulator, we listen to its events
        // This handles the "already inside when zone is drawn" case
        nowActive.add(key);
      }
    }
  }

  // ─── Fire a geofence breach alert ────────────────────────────────────────

  onGeofenceBreach(ship: ShipState, zone: RestrictedZone): void {
    const key = `${ship.shipId}:${zone.id}`;
    if (this.geofenceActive.has(key)) return;
    this.geofenceActive.add(key);

    this.fireAlert({
      type: "GEOFENCE_BREACH",
      shipId: ship.shipId,
      zoneId: zone.id,
      severity: "critical",
      message: `${ship.name} has entered restricted zone "${zone.name}"`,
      metadata: { zoneName: zone.name, position: ship.position },
    });
  }

  clearGeofence(shipId: string, zoneId: string): void {
    this.geofenceActive.delete(`${shipId}:${zoneId}`);
  }

  // ─── Ship status alerts ──────────────────────────────────────────────────

  onShipStranded(ship: ShipState): void {
    this.fireAlert({
      type: "STRANDED",
      shipId: ship.shipId,
      severity: "critical",
      message: `${ship.name} is stranded — no navigable path to destination`,
      metadata: { position: ship.position, destination: ship.destination },
    });
  }

  onShipOutOfFuel(ship: ShipState): void {
    this.fireAlert({
      type: "OUT_OF_FUEL",
      shipId: ship.shipId,
      severity: "critical",
      message: `${ship.name} has run out of fuel at position (${ship.position.lat.toFixed(3)}, ${ship.position.lng.toFixed(3)})`,
      metadata: { position: ship.position },
    });
  }

  onShipArrived(ship: ShipState): void {
    this.fireAlert({
      type: "ARRIVED",
      shipId: ship.shipId,
      severity: "low",
      message: `${ship.name} has arrived at destination`,
      metadata: { destination: ship.destination },
    });
  }

  // ─── Distress alert ───────────────────────────────────────────────────────

  onDistress(ship: ShipState, severity: AlertSeverity, summary: string): void {
    this.fireAlert({
      type: "DISTRESS_SIGNAL",
      shipId: ship.shipId,
      severity,
      message: `${ship.name}: ${summary}`,
      metadata: { position: ship.position },
    });
  }

  // ─── Core alert creation ─────────────────────────────────────────────────
  private async persistAlert(alert: Alert): Promise<void> {
    const shipRow = alert.shipId
      ? await prisma.ship.findUnique({
          where: { shipId: alert.shipId },
          select: { id: true },
        })
      : null;
    const shipBRow = alert.shipIdB
      ? await prisma.ship.findUnique({
          where: { shipId: alert.shipIdB },
          select: { id: true },
        })
      : null;
    const zoneRow = alert.zoneId
      ? await prisma.restrictedZone.findUnique({
          where: { id: alert.zoneId },
          select: { id: true },
        })
      : null;

    await prisma.alert.create({
      data: {
        id: alert.id,
        type: alert.type,
        // Prisma relation expects DB primary ids, not external shipId codes.
        shipId: shipRow?.id,
        shipIdB: shipBRow?.id,
        zoneId: zoneRow?.id,
        severity: alert.severity,
        message: alert.message,
        metadata: {
          ...alert.metadata,
          sourceShipId: alert.shipId ?? null,
          sourceShipIdB: alert.shipIdB ?? null,
          sourceZoneId: alert.zoneId ?? null,
        } as any,
        firedAt: new Date(alert.firedAt),
      },
    });
  }

  private fireAlert(params: {
    type: AlertType;
    shipId?: string;
    shipIdB?: string;
    zoneId?: string;
    severity: AlertSeverity;
    message: string;
    metadata: Record<string, unknown>;
  }): Alert {
    const alert: Alert = {
      id: uuid(),
      type: params.type,
      shipId: params.shipId,
      shipIdB: params.shipIdB,
      zoneId: params.zoneId,
      severity: params.severity,
      message: params.message,
      metadata: params.metadata,
      acknowledged: false,
      firedAt: Date.now(),
    };

    fleetStore.setAlert(alert);

    // Persist to DB (non-blocking)
    this.persistAlert(alert).catch((err) =>
      logger.error("Failed to persist alert", err),
    );

    logger.info("Alert fired", {
      type: alert.type,
      severity: alert.severity,
      id: alert.id,
    });
    this.emit("alert", alert);
    return alert;
  }

  // ─── Acknowledge ──────────────────────────────────────────────────────────

  async acknowledge(alertId: string): Promise<Alert | null> {
    const alert = fleetStore.acknowledgeAlert(alertId);
    if (!alert) return null;

    await prisma.alert
      .update({
        where: { id: alertId },
        data: { acknowledged: true, acknowledgedAt: new Date() },
      })
      .catch((err) => logger.error("Failed to persist ack", err));

    this.emit("alert_acknowledged", alert);
    return alert;
  }
}

export const alertEngine = new AlertEngine();
