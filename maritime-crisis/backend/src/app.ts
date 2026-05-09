import express, { type Application } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { optionalAuth } from "./middleware/auth.js";
import apiRouter from "./routes.js";
import { createLogger } from "./utils/logger.js";
import swaggerSpec from "./config/swagger.json" with { type: "json" };

const logger = createLogger("App");

export function createApp(): Application {
  const app = express();

  // ─── Security ─────────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: false, // Frontend handles its own CSP
    }),
  );

  app.use(
    cors({
      origin: [
        "http://localhost:5173",
        "http://localhost:3000",
        process.env.FRONTEND_URL ?? "https://maritime-crisis.vercel.app",
      ],
      credentials: true,
    }),
  );

  // ─── Rate limiting ────────────────────────────────────────────────────────
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // ─── Body parsing ─────────────────────────────────────────────────────────
  app.use(express.json({ limit: "1mb" }));

  // ─── Optional auth (attaches req.auth when token present) ─────────────────
  app.use(optionalAuth);

  // ─── Swagger UI documentation ─────────────────────────────────────────────
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec as any, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: "list",
        tagsSorter: "alpha",
      },
      customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 20px 0; }
      `,
      customSiteTitle: "Maritime Crisis API Documentation",
      customfavIcon: "https://cdn-icons-png.flaticon.com/512/1183/1183591.png",
    }),
  );

  // ─── Swagger JSON endpoint ────────────────────────────────────────────────
  app.get("/api-docs.json", (_req, res) => {
    res.json(swaggerSpec);
  });

  // ─── API routes ───────────────────────────────────────────────────────────
  app.use("/api", apiRouter);

  // ─── Root endpoint ────────────────────────────────────────────────────────
  app.get("/", (_req, res) => {
    res.json({
      service: "Maritime Crisis Backend",
      version: "1.0.0",
      status: "online",
      timestamp: new Date().toISOString(),
      links: {
        documentation: "http://localhost:3001/api-docs",
        swagger_json: "http://localhost:3001/api-docs.json",
        health: "http://localhost:3001/health",
        api: "http://localhost:3001/api",
      },
      documentation: {
        setup: "See BACKEND_SETUP.md",
        testing: "See SWAGGER_TESTING.md",
        swagger_ui:
          "Visit /api-docs in your browser for interactive API testing",
      },
      fleet_info: {
        total_ships: 15,
        total_ports: 10,
        region: "Strait of Hormuz",
        simulator_tick_hz: 1,
      },
    });
  });

  // ─── Health check ─────────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ─── 404 ─────────────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: `Route not found: ${req.method} ${req.path}`,
      timestamp: Date.now(),
    });
  });

  // ─── Error handler ────────────────────────────────────────────────────────
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      logger.error("Unhandled error", {
        message: err.message,
        stack: err.stack,
      });
      res.status(500).json({
        success: false,
        error: "Internal server error",
        timestamp: Date.now(),
      });
    },
  );

  return app;
}
