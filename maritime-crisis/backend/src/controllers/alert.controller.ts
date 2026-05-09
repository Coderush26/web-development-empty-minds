import type { Request, Response } from "express";
import { fleetStore } from "../simulation/fleet-store.js";
import { alertEngine } from "../alerts/alert-engine.js";
import { wsManager } from "../websocket/ws-manager.js";
import type { ApiResponse } from "../types/index.js";

function ok<T>(res: Response, data: T): void {
  const body: ApiResponse<T> = { success: true, data, timestamp: Date.now() };
  res.json(body);
}

// ─── GET /api/alerts ──────────────────────────────────────────────────────────

export function getAlerts(req: Request, res: Response): void {
  const { active } = req.query;
  const alerts =
    active === "true"
      ? fleetStore.getActiveAlerts()
      : fleetStore.getAllAlerts();
  ok(res, alerts);
}

// ─── POST /api/alerts/:alertId/acknowledge ────────────────────────────────────

export async function acknowledgeAlert(
  req: Request,
  res: Response,
): Promise<void> {
  const { alertId } = req.params as { alertId: string };
  const alert = await alertEngine.acknowledge(alertId);
  if (!alert) {
    res.status(404).json({
      success: false,
      error: "Alert not found",
      timestamp: Date.now(),
    });
    return;
  }
  wsManager.broadcast({
    type: "ALERT_ACKNOWLEDGED",
    payload: alert,
    timestamp: Date.now(),
  });
  ok(res, alert);
}
