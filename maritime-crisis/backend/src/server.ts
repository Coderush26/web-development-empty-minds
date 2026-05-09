import http from "http";
import { createApp } from "./app.js";
import { wsManager } from "./websocket/ws-manager.js";
import { shipSimulator } from "./simulation/simulator.js";
import { alertEngine } from "./alerts/alert-engine.js";
import { playbackService } from "./playback/playback-service.js";
import { updateFleetWeather } from "./weather/weather-service.js";
import { connectDb, disconnectDb } from "./db/client.js";
import { config } from "./config/index.js";
import { createLogger } from "./utils/logger.js";
import { fleetStore } from "./simulation/fleet-store.js";

const logger = createLogger("Server");

async function bootstrap(): Promise<void> {
  // ─── 1. Connect database ────────────────────────────────────────────────────
  await connectDb();
  logger.info("Database connected");

  // ─── 2. Create HTTP server ──────────────────────────────────────────────────
  const app = createApp();
  const server = http.createServer(app);

  // ─── 3. Attach WebSocket ────────────────────────────────────────────────────
  wsManager.attach(server);

  // ─── 4. Initialise fleet ────────────────────────────────────────────────────
  shipSimulator.initialise();

  // ─── 5. Load playback history ───────────────────────────────────────────────
  await playbackService.loadFromDb();

  // ─── 6. Wire simulator events → alerts → WebSocket ─────────────────────────

  shipSimulator.on("tick", (ships) => {
    const state = fleetStore.getFullState();

    // Check proximity
    alertEngine.checkProximity(ships);

    // Broadcast tick to all WS clients
    wsManager.broadcast({
      type: "TICK",
      payload: state,
      timestamp: Date.now(),
    });
  });

  shipSimulator.on("geofence_breach", ({ ship, zone }) => {
    alertEngine.onGeofenceBreach(ship, zone);
  });

  shipSimulator.on("stranded", (ship) => {
    alertEngine.onShipStranded(ship);
  });

  shipSimulator.on("out_of_fuel", (ship) => {
    alertEngine.onShipOutOfFuel(ship);
  });

  shipSimulator.on("arrived", (ship) => {
    alertEngine.onShipArrived(ship);
    playbackService.logEvent({
      type: "SHIP_ARRIVED",
      shipId: ship.shipId,
      description: `${ship.name} arrived at ${ship.destination}`,
      timestamp: Date.now(),
    });
  });

  // ─── 7. Wire alert engine → WebSocket ──────────────────────────────────────

  alertEngine.on("alert", (alert) => {
    wsManager.broadcast({
      type: "ALERT_FIRED",
      payload: alert,
      timestamp: Date.now(),
    });
    if (alert.type === "PROXIMITY_WARNING") {
      wsManager.broadcast({
        type: "PROXIMITY_WARNING",
        payload: alert,
        timestamp: Date.now(),
      });
    }
    playbackService.logEvent({
      type: "ALERT",
      shipId: alert.shipId,
      description: alert.message,
      timestamp: Date.now(),
    });
  });

  // ─── 8. Start services ──────────────────────────────────────────────────────
  shipSimulator.start();
  playbackService.start();

  // Weather update every 5 minutes
  updateFleetWeather().catch(() => {});
  setInterval(() => updateFleetWeather().catch(() => {}), 5 * 60_000);

  // ─── 9. Start HTTP server ───────────────────────────────────────────────────
  server.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`, {
      env: config.nodeEnv,
      port: config.port,
    });
  });

  // ─── 10. Graceful shutdown ──────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info("Shutting down", { signal });
    shipSimulator.stop();
    playbackService.stop();
    server.close();
    await disconnectDb();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
