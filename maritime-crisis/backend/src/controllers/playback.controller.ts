import type { Request, Response } from "express";
import { playbackService } from "../playback/playback-service.js";
import type { ApiResponse } from "../types/index.js";

function ok<T>(res: Response, data: T): void {
  const body: ApiResponse<T> = { success: true, data, timestamp: Date.now() };
  res.json(body);
}

// ─── GET /api/playback/snapshots ──────────────────────────────────────────────
// Returns all snapshots for timeline display

export function getSnapshots(req: Request, res: Response): void {
  const { from, to } = req.query;
  if (from && to) {
    const snapshots = playbackService.getSnapshotsInRange(
      parseInt(from as string, 10),
      parseInt(to as string, 10),
    );
    ok(res, snapshots);
  } else {
    ok(res, playbackService.getSnapshots());
  }
}

// ─── GET /api/playback/snapshots/:timestamp ───────────────────────────────────
// Closest snapshot to a given timestamp

export function getSnapshotAt(req: Request, res: Response): void {
  const ts = parseInt((req.params as { timestamp: string }).timestamp, 10);
  const snapshots = playbackService.getSnapshots();
  if (snapshots.length === 0) {
    res.status(404).json({
      success: false,
      error: "No snapshots available",
      timestamp: Date.now(),
    });
    return;
  }
  const closest = snapshots.reduce((prev, curr) =>
    Math.abs(curr.capturedAt - ts) < Math.abs(prev.capturedAt - ts)
      ? curr
      : prev,
  );
  ok(res, closest);
}
