import {
  distanceKm,
  pointInPolygon,
  pathIntersectsPolygon,
} from "../utils/geo.js";
import type { Position, RestrictedZone } from "../types/index.js";
import { createLogger } from "../utils/logger.js";
import { config } from "../config/index.js";
import fleetJson from "../config/fleet.json" with { type: "json" };

const logger = createLogger("Router");

// ─── Grid Configuration ───────────────────────────────────────────────────────
// We operate in the Strait of Hormuz bounding box
const BOUNDS = { north: 30.5, south: 22.0, east: 60.0, west: 47.5 };

// The grid resolution is now configurable at runtime via `config.gridRes`.
// Use helper getters so tests or process.env can change config before import.
function getGridRes(): number {
  return config.gridRes ?? 0.15;
}

function getCols(gridRes = getGridRes()): number {
  return Math.ceil((BOUNDS.east - BOUNDS.west) / gridRes);
}

function getRows(gridRes = getGridRes()): number {
  return Math.ceil((BOUNDS.north - BOUNDS.south) / gridRes);
}

// ─── Navigable Water Polygon (from fleet.json) ────────────────────────────────
const NAVIGABLE_WATER: Position[] = (fleetJson.navigableWater as number[][]).map(
  ([lat, lng]) => ({ lat, lng }),
);

// ─── Grid Node ────────────────────────────────────────────────────────────────
interface Node {
  row: number;
  col: number;
  g: number; // cost from start
  h: number; // heuristic to goal
  f: number; // g + h
  parent: Node | null;
}

function toGrid(pos: Position): { row: number; col: number } {
  const gridRes = getGridRes();
  return {
    row: Math.floor((pos.lat - BOUNDS.south) / gridRes),
    col: Math.floor((pos.lng - BOUNDS.west) / gridRes),
  };
}

function toPosition(row: number, col: number): Position {
  const gridRes = getGridRes();
  return {
    lat: BOUNDS.south + row * gridRes + gridRes / 2,
    lng: BOUNDS.west + col * gridRes + gridRes / 2,
  };
}

function isNavigable(
  row: number,
  col: number,
  zones: RestrictedZone[],
): boolean {
  const rows = getRows();
  const cols = getCols();
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
  const pos = toPosition(row, col);
  if (!pointInPolygon(pos, NAVIGABLE_WATER)) return false;
  for (const zone of zones) {
    if (zone.active && pointInPolygon(pos, zone.polygon)) return false;
  }
  return true;
}

function nearestNavigableGridCell(
  source: { row: number; col: number },
  zones: RestrictedZone[],
): { row: number; col: number } | null {
  if (isNavigable(source.row, source.col, zones)) return source;
  const maxRadius = Math.max(getRows(), getCols());
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
        const row = source.row + dr;
        const col = source.col + dc;
        if (isNavigable(row, col, zones)) return { row, col };
      }
    }
  }
  return null;
}

function segmentWithinNavigableWater(a: Position, b: Position): boolean {
  const sampleCount = Math.max(6, Math.ceil(distanceKm(a, b) / 3));
  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount;
    const p: Position = {
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
    };
    if (!pointInPolygon(p, NAVIGABLE_WATER)) return false;
  }
  return true;
}

function pathWithinNavigableWater(path: Position[]): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    if (!segmentWithinNavigableWater(path[i]!, path[i + 1]!)) {
      return false;
    }
  }
  return true;
}

const NEIGHBORS_8: Array<[number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

// ─── A* Implementation ────────────────────────────────────────────────────────

function aStar(
  start: { row: number; col: number },
  goal: { row: number; col: number },
  zones: RestrictedZone[],
): Array<{ row: number; col: number }> | null {
  const key = (r: number, c: number) => `${r},${c}`;

  const open = new Map<string, Node>();
  const closed = new Set<string>();

  const startNode: Node = {
    row: start.row,
    col: start.col,
    g: 0,
    h: Math.hypot(goal.row - start.row, goal.col - start.col),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.h;
  open.set(key(start.row, start.col), startNode);

  let iterations = 0;
  const MAX_ITER = getRows() * getCols(); // safety cap

  while (open.size > 0 && iterations++ < MAX_ITER) {
    // Get node with lowest f
    let current: Node | null = null;
    for (const node of open.values()) {
      if (!current || node.f < current.f) current = node;
    }
    if (!current) break;

    const ck = key(current.row, current.col);
    open.delete(ck);
    closed.add(ck);

    // Goal reached
    if (current.row === goal.row && current.col === goal.col) {
      const path: Array<{ row: number; col: number }> = [];
      let node: Node | null = current;
      while (node) {
        path.unshift({ row: node.row, col: node.col });
        node = node.parent;
      }
      return path;
    }

    for (const [dr, dc] of NEIGHBORS_8) {
      const nr = current.row + dr;
      const nc = current.col + dc;
      const nk = key(nr, nc);
      if (closed.has(nk) || !isNavigable(nr, nc, zones)) continue;

      const moveCost = Math.hypot(dr, dc); // diagonal = √2
      const g = current.g + moveCost;
      const h = Math.hypot(goal.row - nr, goal.col - nc);
      const f = g + h;

      const existing = open.get(nk);
      if (!existing || g < existing.g) {
        open.set(nk, { row: nr, col: nc, g, h, f, parent: current });
      }
    }
  }

  return null; // no path found
}

// ─── Waypoint Simplification (Douglas-Peucker) ────────────────────────────────
function simplifyPath(path: Position[], tolerance: number = 0.08): Position[] {
  if (path.length <= 2) return path;
  let maxDist = 0;
  let maxIdx = 0;
  const start = path[0]!;
  const end = path[path.length - 1]!;
  const lineLen = distanceKm(start, end);

  for (let i = 1; i < path.length - 1; i++) {
    let dist: number;
    if (lineLen < 0.001) {
      dist = distanceKm(path[i]!, start);
    } else {
      // Perpendicular distance approximation
      const t = Math.max(
        0,
        Math.min(
          1,
          ((path[i]!.lat - start.lat) * (end.lat - start.lat) +
            (path[i]!.lng - start.lng) * (end.lng - start.lng)) /
            (lineLen * lineLen),
        ),
      );
      const proj: Position = {
        lat: start.lat + t * (end.lat - start.lat),
        lng: start.lng + t * (end.lng - start.lng),
      };
      dist = distanceKm(path[i]!, proj);
    }
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPath(path.slice(0, maxIdx + 1), tolerance);
    const right = simplifyPath(path.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [start, end];
}

// ─── Public Router Interface ──────────────────────────────────────────────────

export interface RouteResult {
  path: Position[];
  distanceKm: number;
  reachable: boolean;
}

/**
 * Compute a navigable path from `from` to `to`, avoiding all active restricted zones.
 * Returns simplified waypoints. If no path exists, returns reachable=false.
 */
export function computeRoute(
  from: Position,
  to: Position,
  zones: RestrictedZone[],
): RouteResult {
  const activeZones = zones.filter((z) => z.active);
  const startGrid = nearestNavigableGridCell(toGrid(from), activeZones);
  const goalGrid = nearestNavigableGridCell(toGrid(to), activeZones);
  if (!startGrid || !goalGrid) {
    logger.warn("No navigable start/goal cell found", { from, to });
    return {
      path: [from, to],
      distanceKm: distanceKm(from, to),
      reachable: false,
    };
  }

  const gridPath = aStar(startGrid, goalGrid, activeZones);
  if (!gridPath) {
    logger.warn("No path found", { from, to, zones: activeZones.length });
    return {
      path: [from, to],
      distanceKm: distanceKm(from, to),
      reachable: false,
    };
  }

  // Convert grid path → positions
  const rawPath: Position[] = [
    from,
    ...gridPath.slice(1, -1).map(({ row, col }) => toPosition(row, col)),
    to,
  ];

  // Simplify
  const simplified = simplifyPath(rawPath);
  const finalPath = pathWithinNavigableWater(simplified) ? simplified : rawPath;

  // Total distance
  let totalKm = 0;
  for (let i = 0; i < finalPath.length - 1; i++) {
    totalKm += distanceKm(finalPath[i]!, finalPath[i + 1]!);
  }

  return { path: finalPath, distanceKm: totalKm, reachable: true };
}

/**
 * Check if a ship's current planned path intersects any active zone.
 * Used to trigger reroute on zone creation.
 */
export function pathNeedsReroute(
  path: Position[],
  zones: RestrictedZone[],
): boolean {
  const activeZones = zones.filter((z) => z.active);
  for (const zone of activeZones) {
    if (pathIntersectsPolygon(path, zone.polygon)) return true;
  }
  return false;
}

export { NAVIGABLE_WATER };
