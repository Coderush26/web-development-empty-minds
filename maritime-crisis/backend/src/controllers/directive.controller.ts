import type { Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { fleetStore } from "../simulation/fleet-store.js";
import { shipSimulator } from "../simulation/simulator.js";
import { wsManager } from "../websocket/ws-manager.js";
import { alertEngine } from "../alerts/alert-engine.js";
import { analyseDistressMessage } from "../ai/ai-service.js";
import { prisma } from "../db/client.js";
import { playbackService } from "../playback/playback-service.js";
import type {
  Directive,
  DirectiveType,
  DirectivePayload,
  ApiResponse,
} from "../types/index.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("DirectiveController");

function ok<T>(res: Response, data: T): void {
  const body: ApiResponse<T> = { success: true, data, timestamp: Date.now() };
  res.json(body);
}

// ─── POST /api/directives — Command issues a directive ────────────────────────

export async function issueDirective(
  req: Request,
  res: Response,
): Promise<void> {
  const body = (req.body ?? {}) as {
    shipId?: string;
    type?: DirectiveType;
    payload?: DirectivePayload;
  };
  const shipId = body.shipId;
  const type = body.type;
  const payload = body.payload;

  if (!shipId || !type) {
    res.status(400).json({
      success: false,
      error: "shipId and type are required",
      timestamp: Date.now(),
    });
    return;
  }

  const ship = fleetStore.getShip(shipId);
  if (!ship) {
    res
      .status(404)
      .json({ success: false, error: "Ship not found", timestamp: Date.now() });
    return;
  }

  const directive: Directive = {
    id: uuid(),
    shipId,
    issuedByRole: "command",
    type,
    payload: payload ?? {},
    status: "PENDING",
    issuedAt: Date.now(),
  };

  fleetStore.setDirective(directive);

  // Persist
  await prisma.directive
    .create({
      data: {
        id: directive.id,
        shipId,
        issuedByRole: "command",
        type,
        payload: (payload as object) ?? {},
        status: "PENDING",
      },
    })
    .catch((err) => logger.error("Directive persist failed", err));

  playbackService.logEvent({
    type: "DIRECTIVE_ISSUED",
    shipId,
    description: `Directive ${type} issued to ${ship.name}`,
    timestamp: Date.now(),
  });

  // Broadcast to all (command sees it, captain receives it)
  wsManager.broadcast({
    type: "DIRECTIVE_ISSUED",
    payload: directive,
    timestamp: Date.now(),
  });

  logger.info("Directive issued", { id: directive.id, shipId, type });
  ok(res, directive);
}

// ─── POST /api/directives/:directiveId/respond — Captain responds ─────────────

export async function respondToDirective(
  req: Request,
  res: Response,
): Promise<void> {
  const { directiveId } = req.params as { directiveId: string };
  const body = (req.body ?? {}) as {
    response?: "ACCEPT" | "ESCALATE_DISTRESS";
    distressMessage?: string;
  };
  const response = body.response;
  const distressMessage = body.distressMessage;

  if (!response) {
    res.status(400).json({
      success: false,
      error: "response is required",
      timestamp: Date.now(),
    });
    return;
  }

  const directive = fleetStore.getDirective(directiveId);
  if (!directive) {
    res.status(404).json({
      success: false,
      error: "Directive not found",
      timestamp: Date.now(),
    });
    return;
  }

  if (directive.status !== "PENDING") {
    res.status(409).json({
      success: false,
      error: "Directive already responded to",
      timestamp: Date.now(),
    });
    return;
  }

  const ship = fleetStore.getShip(directive.shipId);
  if (!ship) {
    res
      .status(404)
      .json({ success: false, error: "Ship not found", timestamp: Date.now() });
    return;
  }

  let updatedDirective: Directive;

  if (response === "ACCEPT") {
    // Apply the directive to the ship
    applyDirective(directive, ship.shipId);

    updatedDirective = fleetStore.updateDirective(directiveId, {
      status: "ACCEPTED",
      captainResponse: "ACCEPT",
      respondedAt: Date.now(),
    })!;
  } else if (response === "ESCALATE_DISTRESS") {
    if (!distressMessage) {
      res.status(400).json({
        success: false,
        error: "distressMessage required for escalation",
        timestamp: Date.now(),
      });
      return;
    }

    // AI analysis of distress
    const aiAnalysis = await analyseDistressMessage(distressMessage, ship.name);

    // Update ship status
    fleetStore.updateShip(ship.shipId, { status: "distressed" });

    // Fire distress alert
    alertEngine.onDistress(ship, aiAnalysis.severity, aiAnalysis.summary);

    updatedDirective = fleetStore.updateDirective(directiveId, {
      status: "ESCALATED",
      captainResponse: "ESCALATE_DISTRESS",
      distressMessage,
      aiAnalysis,
      respondedAt: Date.now(),
    })!;

    // Persist AI analysis
    await prisma.directive
      .update({
        where: { id: directiveId },
        data: {
          status: "ESCALATED",
          captainResponse: "ESCALATE_DISTRESS",
          distressMessage,
          aiAnalysis: aiAnalysis as object,
          respondedAt: new Date(),
        },
      })
      .catch((err) => logger.error("Directive escalation persist failed", err));
  } else {
    res.status(400).json({
      success: false,
      error: "Invalid response type",
      timestamp: Date.now(),
    });
    return;
  }

  playbackService.logEvent({
    type: `DIRECTIVE_${response}`,
    shipId: ship.shipId,
    description: `${ship.name} ${response === "ACCEPT" ? "accepted" : "escalated"} directive`,
    timestamp: Date.now(),
  });

  wsManager.broadcast({
    type: "DIRECTIVE_RESPONDED",
    payload: updatedDirective,
    timestamp: Date.now(),
  });

  logger.info("Directive responded", { directiveId, response });
  ok(res, updatedDirective);
}

// ─── GET /api/directives — List all directives ────────────────────────────────

export function getDirectives(req: Request, res: Response): void {
  const { shipId } = req.query;
  if (typeof shipId === "string") {
    ok(res, fleetStore.getDirectivesForShip(shipId));
  } else {
    // Return all (command sees all)
    ok(res, []);
  }
}

// ─── Apply directive side-effects to ship ─────────────────────────────────────

function applyDirective(directive: Directive, shipId: string): void {
  const ship = fleetStore.getShip(shipId);
  if (!ship) return;

  switch (directive.type) {
    case "REROUTE_PORT": {
      const portId = directive.payload.portId;
      if (!portId) break;
      const port = fleetStore.getPort(portId);
      if (!port) break;
      fleetStore.updateShip(shipId, {
        destination: portId,
        status: "rerouting",
      });
      shipSimulator.triggerReroute(shipId, port.position);
      break;
    }
    case "DIVERT_WAYPOINT": {
      const wp = directive.payload.waypoint;
      if (!wp) break;
      shipSimulator.triggerReroute(shipId, wp);
      break;
    }
    case "HOLD_POSITION": {
      fleetStore.updateShip(shipId, { status: "stopped", path: [] });
      break;
    }
    case "RESUME": {
      fleetStore.updateShip(shipId, { status: "normal" });
      shipSimulator.triggerReroute(shipId);
      break;
    }
  }
}
