import type { Request, Response } from "express";
import { generateToken } from "../middleware/auth.js";
import { fleetStore } from "../simulation/fleet-store.js";
import type { ApiResponse } from "../types/index.js";

function ok<T>(res: Response, data: T): void {
  const body: ApiResponse<T> = { success: true, data, timestamp: Date.now() };
  res.json(body);
}

// ─── POST /api/auth/token ─────────────────────────────────────────────────────
// Get a role token (no credentials needed — role-based access only)
// In production, this would be protected by an identity provider.

export function getToken(req: Request, res: Response): void {
  const body = (req.body ?? {}) as { role?: string; shipId?: string };
  const query = req.query as { role?: string; shipId?: string };
  const role = body.role ?? query.role;
  const shipId = body.shipId ?? query.shipId;

  if (role !== "command" && role !== "captain") {
    res.status(400).json({
      success: false,
      error: 'Role must be "command" or "captain"',
      timestamp: Date.now(),
    });
    return;
  }

  if (role === "captain") {
    if (!shipId) {
      res.status(400).json({
        success: false,
        error: "shipId is required for captain role",
        timestamp: Date.now(),
      });
      return;
    }
    const ship = fleetStore.getShip(shipId);
    if (!ship) {
      res.status(404).json({
        success: false,
        error: "Ship not found",
        timestamp: Date.now(),
      });
      return;
    }
  }

  const token = generateToken(role as "command" | "captain", shipId);
  ok(res, { token, role, shipId, expiresIn: "24h" });
}

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

export function getMe(req: Request, res: Response): void {
  ok(res, req.auth ?? null);
}
