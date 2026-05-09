import type { Request, Response } from "express";
import { getFleetAdvisory } from "../ai/ai-service.js";
import { fleetStore } from "../simulation/fleet-store.js";
import type { ApiResponse } from "../types/index.js";

function ok<T>(res: Response, data: T): void {
  const body: ApiResponse<T> = { success: true, data, timestamp: Date.now() };
  res.json(body);
}

// ─── GET /api/ai/advisory ─────────────────────────────────────────────────────
// Proactive AI fleet recommendations

export async function getAdvisory(req: Request, res: Response): Promise<void> {
  const ships = fleetStore.getAllShips().map((s) => ({
    shipId: s.shipId,
    name: s.name,
    status: s.status,
    fuel: s.fuel,
    position: s.position,
    destination: s.destination,
    inAdverseWeather: s.inAdverseWeather,
    distanceToDest: s.distanceToDest,
  }));

  const activeAlerts = fleetStore.getActiveAlerts().map((a) => ({
    type: a.type,
    severity: a.severity,
    message: a.message,
  }));

  const activeZones = fleetStore
    .getAllZones()
    .filter((z) => z.active)
    .map((z) => ({ name: z.name }));

  const advisory = await getFleetAdvisory({ ships, activeAlerts, activeZones });
  ok(res, advisory);
}
