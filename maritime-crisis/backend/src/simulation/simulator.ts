import { EventEmitter } from "events";
import { fleetStore } from "./fleet-store.js";
import {
  computeRoute,
  pathNeedsReroute,
  snapToNavigableWater,
} from "../routing/astar.js";
import {
  distanceKm,
  distanceNm,
  bearingDeg,
  movePosition,
  knotsSecondsToKm,
  pointInPolygon,
} from "../utils/geo.js";
import type { ShipState, Position, RestrictedZone } from "../types/index.js";
import { config } from "../config/index.js";
import { createLogger } from "../utils/logger.js";
import fleetJson from "../config/fleet.json" with { type: "json" };

const logger = createLogger("Simulator");

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_TICK_S = config.tickIntervalMs / 1000;
const EFFECTIVE_TICK_S = BASE_TICK_S * config.simulationSpeedMultiplier;
const ARRIVAL_THRESHOLD_KM = 2.0; // km — ship considered "arrived"
const LOW_FUEL_THRESHOLD = 500; // tons
const FUEL_BURN_RATE = 2.5; // tons/hour per knot (simplified model)
const ARRIVAL_HOLD_TICKS = 5; // ticks to wait at port before reassigning
const BASE_FUEL_REFILL = 8000; // tons refilled at port

export class ShipSimulator extends EventEmitter {
  private tickTimer: NodeJS.Timeout | null = null;
  private running = false;
  /** Per-ship countdown (ticks remaining) before patrol reassignment */
  private arrivalHold = new Map<string, number>();

  // ─── Initialise fleet from fleet.json ─────────────────────────────────────

  initialise(): void {
    // Load ports
    for (const p of fleetJson.ports) {
      fleetStore.setPort({
        id: p.id,
        name: p.name,
        position: {
          lat: p.position[0] as number,
          lng: p.position[1] as number,
        },
      });
    }

    // Load ships
    for (const s of fleetJson.fleet) {
      const position: Position = {
        lat: s.position[0] as number,
        lng: s.position[1] as number,
      };
      const destPort = fleetStore.getPort(s.destination);
      const destination = snapToNavigableWater(destPort?.position ?? position);

      // Initial route computation
      const route = computeRoute(position, destination, []);

      const ship: ShipState = {
        shipId: s.shipId,
        name: s.name,
        position,
        speed: s.speed,
        heading: s.heading,
        destination: s.destination,
        fuel: s.fuel,
        cargo: s.cargo,
        status: route.reachable
          ? (s.status as ShipState["status"])
          : "stranded",
        path: route.reachable ? route.path.slice(1) : [], // first point is current position
        inAdverseWeather: false,
        distanceToDest: route.distanceKm * 0.539957, // km → nm
        fuelSufficient: true,
        lastUpdated: Date.now(),
      };

      fleetStore.setShip(ship);
    }

    logger.info("Fleet initialised", { count: fleetJson.fleet.length });
  }

  // ─── Start / Stop ─────────────────────────────────────────────────────────

  start(): void {
    if (this.running) return;
    this.running = true;
    this.tickTimer = setInterval(() => this.tick(), config.tickIntervalMs);
    logger.info("Simulator started", { tickMs: config.tickIntervalMs });
  }

  stop(): void {
    this.running = false;
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  // ─── Main Tick ────────────────────────────────────────────────────────────

  private tick(): void {
    const ships = fleetStore.getAllShips();
    const zones = fleetStore.getAllZones();
    const updatedShips: ShipState[] = [];

    for (const ship of ships) {
      const updated = this.advanceShip(ship, zones);
      fleetStore.setShip(updated);
      updatedShips.push(updated);
    }

    // Emit fleet update for WebSocket broadcast
    this.emit("tick", updatedShips);
  }

  // ─── Pick a random port different from the current destination ────────────

  private pickNextDestination(currentDest: string): string {
    const ports = fleetStore.getAllPorts();
    const candidates = ports.filter((p) => p.id !== currentDest);
    if (candidates.length === 0) return currentDest;
    return candidates[Math.floor(Math.random() * candidates.length)]!.id;
  }

  // ─── Advance a Single Ship ────────────────────────────────────────────────

  private advanceShip(ship: ShipState, zones: RestrictedZone[]): ShipState {
    // ── Handle arrived ships → patrol loop ────────────────────────────────
    if (ship.status === "arrived") {
      const remaining = this.arrivalHold.get(ship.shipId);
      if (remaining === undefined) {
        // Just arrived — start hold countdown
        this.arrivalHold.set(ship.shipId, ARRIVAL_HOLD_TICKS);
        return { ...ship, lastUpdated: Date.now() };
      }
      if (remaining > 0) {
        this.arrivalHold.set(ship.shipId, remaining - 1);
        return { ...ship, lastUpdated: Date.now() };
      }
      // Hold expired → assign new destination and resume sailing
      this.arrivalHold.delete(ship.shipId);
      const newDest = this.pickNextDestination(ship.destination);
      const newPort = fleetStore.getPort(newDest);
      if (!newPort) return { ...ship, lastUpdated: Date.now() };
      const destPos = snapToNavigableWater(newPort.position);
      const route = computeRoute(ship.position, destPos, zones.filter((z) => z.active));
      const refueled = Math.min(BASE_FUEL_REFILL, ship.fuel + BASE_FUEL_REFILL * 0.5);
      logger.info("Ship patrol reassigned", {
        shipId: ship.shipId,
        from: ship.destination,
        to: newDest,
      });
      return {
        ...ship,
        destination: newDest,
        status: route.reachable ? "normal" : "stranded",
        path: route.reachable ? route.path.slice(1) : [],
        fuel: refueled,
        fuelSufficient: true,
        distanceToDest: route.distanceKm * 0.539957,
        lastUpdated: Date.now(),
      };
    }

    // Skip stopped/stranded/out_of_fuel ships
    if (["stopped", "stranded", "out_of_fuel"].includes(ship.status)) {
      return { ...ship, lastUpdated: Date.now() };
    }

    const destPort = fleetStore.getPort(ship.destination);
    if (!destPort) return ship;

    const destPos = snapToNavigableWater(destPort.position);

    // ── Check arrival ──────────────────────────────────────────────────────
    const distToDest = distanceKm(ship.position, destPos);
    if (distToDest <= ARRIVAL_THRESHOLD_KM) {
      const arrived = {
        ...ship,
        status: "arrived" as const,
        position: destPos,
        path: [],
        lastUpdated: Date.now(),
      };
      this.emit("arrived", arrived);
      logger.info("Ship arrived", {
        shipId: ship.shipId,
        port: ship.destination,
      });
      return arrived;
    }

    // ── Check if current path intersects a newly added zone ───────────────
    const activeZones = zones.filter((z) => z.active);
    if (ship.path.length > 0 && pathNeedsReroute(ship.path, activeZones)) {
      return this.reroute(ship, destPos, activeZones, "zone_intersection");
    }

    // ── If path is empty, recompute route ─────────────────────────────────
    if (ship.path.length === 0) {
      return this.reroute(ship, destPos, activeZones, "empty_path");
    }

    // ── Check if ship is inside a restricted zone ─────────────────────────
    const insideZone = activeZones.find((z) =>
      pointInPolygon(ship.position, z.polygon),
    );
    if (insideZone) {
      this.emit("geofence_breach", { ship, zone: insideZone });
      // Attempt reroute out
      return this.reroute(ship, destPos, activeZones, "inside_zone");
    }

    // ── Fuel consumption ──────────────────────────────────────────────────
    const weatherPenalty = ship.inAdverseWeather
      ? config.adverseWeatherFuelPenalty
      : 0;
    const baseBurn = (FUEL_BURN_RATE * ship.speed * EFFECTIVE_TICK_S) / 3600;
    const fuelBurned = baseBurn * (1 + weatherPenalty);
    const newFuel = Math.max(0, ship.fuel - fuelBurned);

    // ── Out of fuel ───────────────────────────────────────────────────────
    if (newFuel <= 0) {
      const outOfFuel = {
        ...ship,
        fuel: 0,
        status: "out_of_fuel" as const,
        lastUpdated: Date.now(),
      };
      this.emit("out_of_fuel", outOfFuel);
      return outOfFuel;
    }

    // ── Fuel sufficiency check ────────────────────────────────────────────
    const fuelNeeded = this.estimateFuelNeeded(ship, ship.path);
    const fuelSufficient = newFuel >= fuelNeeded;

    // ── Move toward next waypoint ─────────────────────────────────────────
    const distanceToMoveKm = knotsSecondsToKm(ship.speed, EFFECTIVE_TICK_S);
    const { newPosition, newPath, newHeading } = this.moveAlongPath(
      ship.position,
      ship.path,
      distanceToMoveKm,
    );

    // ── Determine status ──────────────────────────────────────────────────
    let status: ShipState["status"] = ship.status;
    if (status === "rerouting" && newPath.length > 0) {
      status = "normal"; // back to normal after reroute consumed first waypoint
    }
    if (!fuelSufficient && status === "normal") {
      status = "insufficient_fuel";
    }

    return {
      ...ship,
      position: newPosition,
      heading: newHeading,
      path: newPath,
      fuel: newFuel,
      fuelSufficient,
      distanceToDest: distanceNm(newPosition, destPos),
      status,
      lastUpdated: Date.now(),
    };
  }

  // ─── Move along planned path by distKm ────────────────────────────────────

  private moveAlongPath(
    current: Position,
    path: Position[],
    distKm: number,
  ): { newPosition: Position; newPath: Position[]; newHeading: number } {
    let remaining = distKm;
    let pos = current;
    const waypointsCopy = [...path];

    while (remaining > 0 && waypointsCopy.length > 0) {
      const next = waypointsCopy[0];
      const d = distanceKm(pos, next!);
      if (d <= remaining) {
        pos = next!;
        remaining -= d;
        waypointsCopy.shift();
      } else {
        const bearing = bearingDeg(pos, next!);
        pos = movePosition(pos, remaining, bearing);
        remaining = 0;
      }
    }

    const newHeading =
      waypointsCopy.length > 0
        ? bearingDeg(pos, waypointsCopy[0]!)
        : bearingDeg(current, pos);

    return { newPosition: pos, newPath: waypointsCopy, newHeading };
  }

  // ─── Reroute a ship ────────────────────────────────────────────────────────

  reroute(
    ship: ShipState,
    destination: Position,
    zones: RestrictedZone[],
    reason: string,
  ): ShipState {
    const result = computeRoute(ship.position, destination, zones);

    if (!result.reachable) {
      logger.warn("Ship stranded — no valid path", {
        shipId: ship.shipId,
        reason,
      });
      const stranded = {
        ...ship,
        status: "stranded" as const,
        path: [],
        lastUpdated: Date.now(),
      };
      this.emit("stranded", stranded);
      return stranded;
    }

    logger.info("Ship rerouted", {
      shipId: ship.shipId,
      reason,
      waypoints: result.path.length,
    });
    return {
      ...ship,
      status: "rerouting",
      path: result.path.slice(1),
      lastUpdated: Date.now(),
    };
  }

  // ─── Estimate fuel needed for a path ─────────────────────────────────────

  estimateFuelNeeded(ship: ShipState, path: Position[]): number {
    let totalKm = 0;
    const allPts = [ship.position, ...path];
    for (let i = 0; i < allPts.length - 1; i++) {
      totalKm += distanceKm(allPts[i]!, allPts[i + 1]!);
    }
    const hours = totalKm / (ship.speed * 1.852);
    const penalty = ship.inAdverseWeather
      ? 1 + config.adverseWeatherFuelPenalty
      : 1;
    return FUEL_BURN_RATE * ship.speed * hours * penalty;
  }

  // ─── Manual reroute trigger (from directive / zone creation) ───────────────

  triggerReroute(shipId: string, destination?: Position): void {
    const ship = fleetStore.getShip(shipId);
    if (!ship) return;
    const zones = fleetStore.getAllZones();
    const destPort = fleetStore.getPort(ship.destination);
    const dest = destination ?? destPort?.position;
    if (!dest) return;
    const rerouted = this.reroute(ship, dest, zones, "manual_trigger");
    fleetStore.setShip(rerouted);
  }
}

export const shipSimulator = new ShipSimulator();
