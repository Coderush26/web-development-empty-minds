import type { Request, Response } from "express";
import { fleetStore } from "../simulation/fleet-store.js";
import { alertEngine } from "../alerts/alert-engine.js";
import { wsManager } from "../websocket/ws-manager.js";
import { prisma } from "../db/client.js";
import type { ApiResponse } from "../types/index.js";

function ok<T>(res: Response, data: T): void {
  const body: ApiResponse<T> = { success: true, data, timestamp: Date.now() };
  res.json(body);
}

// ─── GET /api/alerts ──────────────────────────────────────────────────────────

export function getAlerts(req: Request, res: Response): void {
  const { active } = req.query;
  prisma.alert
    .findMany({
      where: active === "true" ? { acknowledged: false } : undefined,
      orderBy: { firedAt: "desc" },
      take: 200,
    })
    .then((rows) =>
      rows.map((row) => ({
        id: row.id,
        type: row.type,
        shipId: row.shipId ?? undefined,
        shipIdB: row.shipIdB ?? undefined,
        zoneId: row.zoneId ?? undefined,
        severity: row.severity,
        message: row.message,
        metadata: row.metadata as Record<string, unknown>,
        acknowledged: row.acknowledged,
        firedAt: row.firedAt.getTime(),
        acknowledgedAt: row.acknowledgedAt?.getTime(),
      })),
    )
    .then((alerts) => ok(res, alerts))
    .catch((_err) => {
      // Fallback to in-memory if DB read fails
      const alerts =
        active === "true"
          ? fleetStore.getActiveAlerts()
          : fleetStore.getAllAlerts();
      ok(res, alerts);
    });
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

// ─── POST /api/alerts/acknowledge-all ─────────────────────────────────────────
export async function acknowledgeAllAlerts(
  _req: Request,
  res: Response,
): Promise<void> {
  const activeAlerts = fleetStore.getActiveAlerts();
  const acknowledged: typeof activeAlerts = [];
  for (const alert of activeAlerts) {
    const updated = await alertEngine.acknowledge(alert.id);
    if (updated) acknowledged.push(updated);
  }

  wsManager.broadcast({
    type: "ALERTS_ACKNOWLEDGED",
    payload: { ids: acknowledged.map((a) => a.id) },
    timestamp: Date.now(),
  });

  ok(res, { count: acknowledged.length, ids: acknowledged.map((a) => a.id) });
}
