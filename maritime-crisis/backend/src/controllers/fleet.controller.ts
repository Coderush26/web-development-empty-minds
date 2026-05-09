import type { Request, Response } from "express";
import { fleetStore } from "../simulation/fleet-store.js";
import { wsManager } from "../websocket/ws-manager.js";
import type { ApiResponse } from "../types/index.js";

function ok<T>(res: Response, data: T): void {
  const body: ApiResponse<T> = { success: true, data, timestamp: Date.now() };
  res.json(body);
}

// ─── GET /api/ships ───────────────────────────────────────────────────────────

export function getAllShips(req: Request, res: Response): void {
  ok(res, fleetStore.getAllShips());
}

// ─── GET /api/ships/:shipId ───────────────────────────────────────────────────

export function getShip(req: Request, res: Response): void {
  const ship = fleetStore.getShip((req.params as { shipId: string }).shipId);
  if (!ship) {
    res
      .status(404)
      .json({ success: false, error: "Ship not found", timestamp: Date.now() });
    return;
  }
  ok(res, ship);
}

// ─── GET /api/ports ───────────────────────────────────────────────────────────

export function getAllPorts(req: Request, res: Response): void {
  ok(res, fleetStore.getAllPorts());
}

// ─── GET /api/fleet/state ─────────────────────────────────────────────────────
// Full snapshot for initial load

export function getFleetState(req: Request, res: Response): void {
  ok(res, fleetStore.getFullState());
}

// ─── GET /api/fleet/stats ─────────────────────────────────────────────────────

export function getFleetStats(req: Request, res: Response): void {
  const ships = fleetStore.getAllShips();
  const stats = {
    total: ships.length,
    byStatus: ships.reduce(
      (acc, s) => {
        acc[s.status] = (acc[s.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    inAdverseWeather: ships.filter((s) => s.inAdverseWeather).length,
    lowFuel: ships.filter((s) => s.fuel < 1000).length,
    connectedClients: wsManager.getConnectedCount(),
  };
  ok(res, stats);
}
