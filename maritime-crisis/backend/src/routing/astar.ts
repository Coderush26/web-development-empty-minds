import {
  distanceKm,
  pointInPolygon,
  pathIntersectsPolygon,
} from "../utils/geo.js";
import type { Position, RestrictedZone } from "../types/index.js";
import { createLogger } from "../utils/logger.js";
import { config } from "../config/index.js";

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
const NAVIGABLE_WATER: Position[] = [
  { lat: 29.8, lng: 48.6 },
  { lat: 29.5, lng: 50.0 },
  { lat: 28.8, lng: 50.8 },
  { lat: 27.8, lng: 52.0 },
  { lat: 26.7, lng: 53.5 },
  { lat: 26.3, lng: 55.0 },
  { lat: 26.65, lng: 56.1 },
  { lat: 26.5, lng: 56.4 },
  { lat: 26.0, lng: 56.8 },
  { lat: 25.5, lng: 57.5 },
  { lat: 25.5, lng: 58.5 },
  { lat: 25.0, lng: 60.0 },
  { lat: 22.0, lng: 60.0 },
  { lat: 22.5, lng: 60.0 },
  { lat: 23.8, lng: 58.8 },
  { lat: 24.5, lng: 57.2 },
  { lat: 25.2, lng: 56.5 },
  { lat: 26.45, lng: 56.45 },
  { lat: 26.3, lng: 55.9 },
  { lat: 26.0, lng: 55.5 },
  { lat: 25.3, lng: 54.5 },
  { lat: 24.8, lng: 53.0 },
  { lat: 25.3, lng: 52.0 },
  { lat: 26.4, lng: 51.5 },
  { lat: 26.5, lng: 50.3 },
  { lat: 27.5, lng: 49.8 },
  { lat: 28.5, lng: 49.0 },
  { lat: 29.5, lng: 48.3 },
  { lat: 29.8, lng: 48.6 },
];

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
  const startGrid = toGrid(from);
  const goalGrid = toGrid(to);

  // Snap to navigable if start/end are in a zone (best effort)
  const activeZones = zones.filter((z) => z.active);

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

  // Total distance
  let totalKm = 0;
  for (let i = 0; i < simplified.length - 1; i++) {
    totalKm += distanceKm(simplified[i]!, simplified[i + 1]!);
  }

  return { path: simplified, distanceKm: totalKm, reachable: true };
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
