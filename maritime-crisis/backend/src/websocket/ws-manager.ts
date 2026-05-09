import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import type { WsMessage, WsMessageType } from "../types/index.js";
import { createLogger } from "../utils/logger.js";
import { fleetStore } from "../simulation/fleet-store.js";

const logger = createLogger("WebSocketServer");

// ─── Client representation ────────────────────────────────────────────────────

export interface WsClient {
  ws: WebSocket;
  role: "command" | "captain";
  shipId?: string; // set for captain role
  clientId: string;
}

// ─── WebSocket Manager ────────────────────────────────────────────────────────

class WsManager {
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, WsClient>();
  private clientIdCounter = 0;

  attach(server: Server): void {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const clientId = `client-${++this.clientIdCounter}`;
      const params = new URLSearchParams(req.url?.split("?")[1] ?? "");
      const role = (
        params.get("role") === "captain" ? "captain" : "command"
      ) as "command" | "captain";
      const shipId = params.get("shipId") ?? undefined;

      const client: WsClient = { ws, role, shipId, clientId };
      this.clients.set(clientId, client);
      logger.info("Client connected", { clientId, role, shipId });

      // Send full fleet state immediately on connect
      const state = fleetStore.getFullState();
      this.sendTo(client, {
        type: "FLEET_STATE",
        payload: state,
        timestamp: Date.now(),
      });

      ws.on("message", (data: any) => {
        try {
          const msg = JSON.parse(data.toString()) as WsMessage;
          this.handleClientMessage(client, msg);
        } catch {
          logger.warn("Invalid WS message", { clientId });
        }
      });

      ws.on("close", () => {
        this.clients.delete(clientId);
        logger.info("Client disconnected", { clientId });
      });

      ws.on("error", (err: any) => {
        logger.error("WebSocket error", { clientId, err: String(err) });
        this.clients.delete(clientId);
      });
    });

    logger.info("WebSocket server attached");
  }

  private handleClientMessage(client: WsClient, msg: WsMessage): void {
    if (msg.type === "PING") {
      this.sendTo(client, {
        type: "PONG",
        payload: null,
        timestamp: Date.now(),
      });
    }
    // Additional client → server messages handled via REST
  }

  // ─── Broadcast to all clients ───────────────────────────────────────────────

  broadcast(msg: WsMessage): void {
    const data = JSON.stringify(msg);
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
        count++;
      }
    }
    if (count > 0)
      logger.debug("Broadcast", { type: msg.type, clients: count });
  }

  // ─── Broadcast to specific role ─────────────────────────────────────────────

  broadcastToRole(role: "command" | "captain", msg: WsMessage): void {
    const data = JSON.stringify(msg);
    for (const client of this.clients.values()) {
      if (client.role === role && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }

  // ─── Send to a specific ship's captain ──────────────────────────────────────

  broadcastToShipCaptain(shipId: string, msg: WsMessage): void {
    const data = JSON.stringify(msg);
    for (const client of this.clients.values()) {
      if (
        client.role === "captain" &&
        client.shipId === shipId &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(data);
      }
    }
  }

  // ─── Send to a single client ────────────────────────────────────────────────

  private sendTo(client: WsClient, msg: WsMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(msg));
    }
  }

  getConnectedCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WsManager();
