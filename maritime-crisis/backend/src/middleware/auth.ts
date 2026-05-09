import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import type { UserRole } from "../types/index.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("AuthMiddleware");

export interface AuthPayload {
  role: UserRole;
  shipId?: string; // for captain role
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

// ─── Token generation (no user DB needed — role tokens) ──────────────────────

export function generateToken(role: UserRole, shipId?: string): string {
  const payload: AuthPayload = {
    role,
    shipId,
    sessionId: Math.random().toString(36).slice(2),
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "24h" });
}

// ─── Middleware: optional auth (attaches auth if token present) ──────────────

export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token = extractToken(req);
  if (token) {
    try {
      req.auth = jwt.verify(token, config.jwtSecret) as AuthPayload;
    } catch {
      // Invalid token — treat as unauthenticated
    }
  }
  next();
}

// ─── Middleware: require auth ────────────────────────────────────────────────

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({
      success: false,
      error: "Authentication required",
      timestamp: Date.now(),
    });
    return;
  }
  try {
    req.auth = jwt.verify(token, config.jwtSecret) as AuthPayload;
    next();
  } catch (err) {
    logger.warn("Invalid token", { err: String(err) });
    const body: any = {
      success: false,
      error: "Invalid or expired token",
      timestamp: Date.now(),
    };
    if (config.nodeEnv === "development") body.debug = String(err);
    res.status(401).json(body);
  }
}

// ─── Middleware: require specific role ───────────────────────────────────────

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      if (!req.auth || !roles.includes(req.auth.role)) {
        res.status(403).json({
          success: false,
          error: `Requires role: ${roles.join(" or ")}`,
          timestamp: Date.now(),
        });
        return;
      }
      next();
    });
  };
}

// ─── Middleware: captain can only act on their own ship ──────────────────────

export function requireShipAccess(shipIdParam = "shipId") {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      const auth = req.auth!;
      if (auth.role === "command") return next(); // command has full access
      const requestedShipId = req.params[shipIdParam] ?? req.body?.shipId;
      if (auth.role === "captain" && auth.shipId !== requestedShipId) {
        res.status(403).json({
          success: false,
          error: "Captains can only access their assigned ship",
          timestamp: Date.now(),
        });
        return;
      }
      next();
    });
  };
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  const query = req.query.token;
  if (typeof query === "string") return query;
  return null;
}
