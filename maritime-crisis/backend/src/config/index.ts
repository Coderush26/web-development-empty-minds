import type { AppConfig } from "../types/index.js";

function requireEnv(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT ?? "3001", 10),
    wsPort: parseInt(process.env.WS_PORT ?? "3001", 10),
    databaseUrl: requireEnv(
      "DATABASE_URL",
      "postgresql://postgres:postgres@localhost:5432/maritime",
    ),
    groqApiKey: requireEnv("GROQ_API_KEY", ""),
    openMeteoBaseUrl: "https://api.open-meteo.com/v1/forecast",
    tickIntervalMs: parseInt(process.env.TICK_INTERVAL_MS ?? "1000", 10),
    weatherCacheTtlMs: parseInt(
      process.env.WEATHER_CACHE_TTL_MS ?? "300000",
      10,
    ), // 5 min
    snapshotIntervalMs: parseInt(
      process.env.SNAPSHOT_INTERVAL_MS ?? "30000",
      10,
    ), // 30s
    snapshotRetentionCount: parseInt(
      process.env.SNAPSHOT_RETENTION_COUNT ?? "120",
      10,
    ), // 1hr at 30s
    proximityThresholdKm: parseFloat(
      process.env.PROXIMITY_THRESHOLD_KM ?? "2.0",
    ),
    adverseWeatherFuelPenalty: parseFloat(
      process.env.ADVERSE_WEATHER_FUEL_PENALTY ?? "0.30",
    ),
    jwtSecret: requireEnv(
      "JWT_SECRET",
      "maritime-crisis-dev-secret-change-in-prod",
    ),
    nodeEnv: process.env.NODE_ENV ?? "development",
  };
}

export const config = loadConfig();
