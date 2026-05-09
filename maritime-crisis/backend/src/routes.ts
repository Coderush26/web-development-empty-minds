import { Router } from "express";
import {
  requireAuth,
  requireRole,
  requireShipAccess,
  optionalAuth,
} from "./middleware/auth.js";

import { getToken, getMe } from "./controllers/auth.controller.js";
import {
  getAllShips,
  getShip,
  getAllPorts,
  getFleetState,
  getFleetStats,
} from "./controllers/fleet.controller.js";
import {
  getAllZones,
  createZone,
  deleteZone,
} from "./controllers/zone.controller.js";
import {
  issueDirective,
  respondToDirective,
  getDirectives,
} from "./controllers/directive.controller.js";
import {
  getAlerts,
  acknowledgeAlert,
  acknowledgeAllAlerts,
} from "./controllers/alert.controller.js";
import {
  getSnapshots,
  getSnapshotAt,
} from "./controllers/playback.controller.js";
import { getAdvisory } from "./controllers/ai.controller.js";

const router = Router();

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.post("/auth/token", getToken);
router.get("/auth/me", requireAuth, getMe);

// ─── Fleet (public read) ──────────────────────────────────────────────────────
router.get("/ships", getAllShips);
router.get("/ships/:shipId", getShip);
router.get("/ports", getAllPorts);
router.get("/fleet/state", getFleetState);
router.get("/fleet/stats", getFleetStats);

// ─── Zones (command only for write) ──────────────────────────────────────────
router.get("/zones", getAllZones);
router.post("/zones", requireRole("command"), createZone);
router.delete("/zones/:zoneId", requireRole("command"), deleteZone);

// ─── Directives ───────────────────────────────────────────────────────────────
router.get("/directives", requireAuth, getDirectives);
router.post("/directives", requireRole("command"), issueDirective);
router.post(
  "/directives/:directiveId/respond",
  requireAuth,
  respondToDirective,
);

// ─── Alerts ───────────────────────────────────────────────────────────────────
router.get("/alerts", requireAuth, getAlerts);
router.post(
  "/alerts/:alertId/acknowledge",
  requireRole("command"),
  acknowledgeAlert,
);
router.post("/alerts/acknowledge-all", requireRole("command"), acknowledgeAllAlerts);

// ─── Playback ─────────────────────────────────────────────────────────────────
router.get("/playback/snapshots", requireAuth, getSnapshots);
router.get("/playback/snapshots/:timestamp", requireAuth, getSnapshotAt);

// ─── AI ───────────────────────────────────────────────────────────────────────
router.get("/ai/advisory", requireRole("command"), getAdvisory);

export default router;
