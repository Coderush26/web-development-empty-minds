import { fleetStore } from "../simulation/fleet-store.js";
import { prisma } from "../db/client.js";
import { config } from "../config/index.js";
import type { FleetSnapshot, SnapshotEvent } from "../types/index.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("PlaybackService");

class PlaybackService {
  // In-memory ring buffer
  private snapshots: FleetSnapshot[] = [];
  private pendingEvents: SnapshotEvent[] = [];
  private snapshotTimer: NodeJS.Timeout | null = null;

  start(): void {
    this.snapshotTimer = setInterval(
      () => this.captureSnapshot(),
      config.snapshotIntervalMs,
    );
    logger.info("Playback service started", {
      intervalMs: config.snapshotIntervalMs,
    });
  }

  stop(): void {
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
  }

  // ─── Add an event to attach to the next snapshot ───────────────────────────

  logEvent(event: SnapshotEvent): void {
    this.pendingEvents.push(event);
  }

  // ─── Capture current fleet state ───────────────────────────────────────────

  private async captureSnapshot(): Promise<void> {
    const state = fleetStore.getFullState();
    const snapshot: FleetSnapshot = {
      capturedAt: Date.now(),
      fleetState: state.ships,
      activeAlerts: state.alerts,
      activeZones: state.zones,
      events: [...this.pendingEvents],
    };

    this.pendingEvents = [];
    this.snapshots.push(snapshot);

    // Enforce retention
    if (this.snapshots.length > config.snapshotRetentionCount) {
      this.snapshots.shift();
    }

    // Persist to DB
    try {
      await prisma.snapshot.create({
        data: {
          capturedAt: new Date(snapshot.capturedAt),
          fleetState: snapshot.fleetState as any,
          activeAlerts: snapshot.activeAlerts as any,
          activeZones: snapshot.activeZones as any,
          events: snapshot.events as any,
        },
      });

      // Prune old DB snapshots (keep last hour = snapshotRetentionCount)
      const cutoff = new Date(Date.now() - 3_600_000);
      await prisma.snapshot.deleteMany({
        where: { capturedAt: { lt: cutoff } },
      });
    } catch (err) {
      logger.warn("Snapshot persist failed", err);
    }
  }

  // ─── Get all snapshots (for timeline scrubbing) ────────────────────────────

  getSnapshots(): FleetSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get snapshots in a time range.
   * Clients can also query DB for older data.
   */
  getSnapshotsInRange(fromMs: number, toMs: number): FleetSnapshot[] {
    return this.snapshots.filter(
      (s) => s.capturedAt >= fromMs && s.capturedAt <= toMs,
    );
  }

  // ─── Load snapshots from DB on startup ────────────────────────────────────

  async loadFromDb(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - 3_600_000);
      const rows = await prisma.snapshot.findMany({
        where: { capturedAt: { gte: cutoff } },
        orderBy: { capturedAt: "asc" },
        take: config.snapshotRetentionCount,
      });

      this.snapshots = rows.map((row) => ({
        capturedAt: row.capturedAt.getTime(),
        fleetState: row.fleetState as any as FleetSnapshot["fleetState"],
        activeAlerts: row.activeAlerts as any as FleetSnapshot["activeAlerts"],
        activeZones: row.activeZones as any as FleetSnapshot["activeZones"],
        events: row.events as any as SnapshotEvent[],
      }));

      logger.info("Snapshots loaded from DB", { count: this.snapshots.length });
    } catch (err) {
      logger.warn("Failed to load snapshots from DB", err);
    }
  }
}

export const playbackService = new PlaybackService();
