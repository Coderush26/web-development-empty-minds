import type { Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { fleetStore } from "../simulation/fleet-store.js";
import { shipSimulator } from "../simulation/simulator.js";
import { wsManager } from "../websocket/ws-manager.js";
import { prisma } from "../db/client.js";
import { alertEngine } from "../alerts/alert-engine.js";
import { pointInPolygon } from "../utils/geo.js";
import { playbackService } from "../playback/playback-service.js";
import type { RestrictedZone, Position, ApiResponse } from "../types/index.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("ZoneController");

function ok<T>(res: Response, data: T): void {
  const body: ApiResponse<T> = { success: true, data, timestamp: Date.now() };
  res.json(body);
}

// ─── GET /api/zones ───────────────────────────────────────────────────────────

export function getAllZones(req: Request, res: Response): void {
  ok(res, fleetStore.getAllZones());
}

// ─── POST /api/zones ──────────────────────────────────────────────────────────

export async function createZone(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as { name?: string; polygon?: Position[] };
  const name = body.name;
  const polygon = body.polygon;

  if (!name || !Array.isArray(polygon) || polygon.length < 3) {
    res.status(400).json({
      success: false,
      error: "Zone requires a name and at least 3 polygon coordinates",
      timestamp: Date.now(),
    });
    return;
  }

  const zone: RestrictedZone = {
    id: uuid(),
    name,
    polygon,
    active: true,
    createdAt: Date.now(),
    createdByRole: req.auth!.role,
  };

  fleetStore.setZone(zone);

  // Persist
  await prisma.restrictedZone
    .create({
      data: {
        id: zone.id,
        name: zone.name,
        polygonCoords: polygon as object[],
        active: true,
        createdByRole: zone.createdByRole,
      },
    })
    .catch((err) => logger.error("Zone persist failed", err));

  // Check all ships — fire alerts for those already inside
  const ships = fleetStore.getAllShips();
  let rerouted = 0;
  for (const ship of ships) {
    if (pointInPolygon(ship.position, polygon)) {
      alertEngine.onGeofenceBreach(ship, zone);
    }
    // Reroute ships whose path intersects the new zone
    const dest = fleetStore.getPort(ship.destination);
    if (dest) {
      shipSimulator.triggerReroute(ship.shipId);
      rerouted++;
    }
  }

  playbackService.logEvent({
    type: "ZONE_CREATED",
    description: `Zone "${name}" created (${rerouted} ships rerouted)`,
    timestamp: Date.now(),
  });

  // Broadcast to all clients
  wsManager.broadcast({
    type: "ZONE_ADDED",
    payload: zone,
    timestamp: Date.now(),
  });

  logger.info("Zone created", { id: zone.id, name, rerouted });
  ok(res, zone);
}

// ─── DELETE /api/zones/:zoneId ────────────────────────────────────────────────

export async function deleteZone(req: Request, res: Response): Promise<void> {
  const { zoneId } = req.params as { zoneId: string };
  const zone = fleetStore.getZone(zoneId);

  if (!zone) {
    res
      .status(404)
      .json({ success: false, error: "Zone not found", timestamp: Date.now() });
    return;
  }

  fleetStore.removeZone(zoneId);

  await prisma.restrictedZone
    .update({
      where: { id: zoneId },
      data: { active: false },
    })
    .catch((err) => logger.error("Zone delete persist failed", err));

  playbackService.logEvent({
    type: "ZONE_REMOVED",
    description: `Zone "${zone.name}" removed`,
    timestamp: Date.now(),
  });

  wsManager.broadcast({
    type: "ZONE_REMOVED",
    payload: { zoneId },
    timestamp: Date.now(),
  });
  logger.info("Zone removed", { zoneId });
  ok(res, { zoneId });
}
