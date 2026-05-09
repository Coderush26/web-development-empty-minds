import { fleetStore } from "../simulation/fleet-store.js";
import { config } from "../config/index.js";
import { prisma } from "../db/client.js";
import type { WeatherData, Position } from "../types/index.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("WeatherService");

// ─── Thresholds for "adverse weather" ─────────────────────────────────────────
const ADVERSE_WIND_SPEED_KMH = 50; // km/h
const ADVERSE_WAVE_HEIGHT_M = 2.5; // meters

// ─── In-memory cache (key: "lat:lng") ─────────────────────────────────────────
const memCache = new Map<string, WeatherData>();
const inFlight = new Map<string, Promise<WeatherData>>();

function cacheKey(lat: number, lng: number): string {
  // Round to 1 decimal to cluster nearby points
  return `${lat.toFixed(1)}:${lng.toFixed(1)}`;
}

function roundedCoords(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Number(lat.toFixed(1)),
    lng: Number(lng.toFixed(1)),
  };
}

async function fetchFromApi(lat: number, lng: number): Promise<WeatherData> {
  const url = new URL(config.openMeteoBaseUrl);
  url.searchParams.set("latitude", lat.toFixed(3));
  url.searchParams.set("longitude", lng.toFixed(3));
  url.searchParams.set("current", "wind_speed_10m,wave_height");
  url.searchParams.set("wind_speed_unit", "kmh");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo error ${res.status}`);

  const json = (await res.json()) as {
    current: { wind_speed_10m: number; wave_height?: number };
  };

  const windSpeed = json.current.wind_speed_10m ?? 0;
  const waveHeight = json.current.wave_height ?? 0;
  const isAdverse =
    windSpeed >= ADVERSE_WIND_SPEED_KMH || waveHeight >= ADVERSE_WAVE_HEIGHT_M;

  return {
    lat,
    lng,
    windSpeed,
    waveHeight,
    isAdverse,
    fetchedAt: Date.now(),
    expiresAt: Date.now() + config.weatherCacheTtlMs,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getWeather(pos: Position): Promise<WeatherData> {
  const key = cacheKey(pos.lat, pos.lng);
  const now = Date.now();

  // 1. Check mem cache
  const cached = memCache.get(key);
  if (cached && cached.expiresAt > now) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    // 2. Try DB cache
    try {
      const { lat, lng } = roundedCoords(pos.lat, pos.lng);
      const dbCache = await prisma.weatherCache.findUnique({
        where: {
          lat_lng: { lat, lng },
        },
      });
      if (dbCache && dbCache.expiresAt > new Date()) {
        const data = dbCache.data as any as WeatherData;
        memCache.set(key, data);
        return data;
      }
    } catch {
      /* skip db cache on error */
    }

    // 3. Fetch fresh
    let data: WeatherData;
    try {
      data = await fetchFromApi(pos.lat, pos.lng);
      logger.debug("Weather fetched", {
        lat: pos.lat,
        lng: pos.lng,
        isAdverse: data.isAdverse,
      });
    } catch (err) {
      logger.warn("Weather fetch failed, using defaults", { err });
      // Safe fallback — non-adverse
      data = {
        lat: pos.lat,
        lng: pos.lng,
        windSpeed: 10,
        waveHeight: 0.5,
        isAdverse: false,
        fetchedAt: now,
        expiresAt: now + 60_000, // 1 min retry
      };
    }

    memCache.set(key, data);

    const { lat, lng } = roundedCoords(pos.lat, pos.lng);

    // Persist to DB (non-blocking)
    prisma.weatherCache
      .upsert({
        where: {
          lat_lng: { lat, lng },
        },
        create: {
          lat,
          lng,
          data: data as object,
          isAdverse: data.isAdverse,
          fetchedAt: new Date(data.fetchedAt),
          expiresAt: new Date(data.expiresAt),
        },
        update: {
          data: data as object,
          isAdverse: data.isAdverse,
          fetchedAt: new Date(data.fetchedAt),
          expiresAt: new Date(data.expiresAt),
        },
      })
      .catch(async () => {
        // Best-effort fallback if another request won the race.
        try {
          await prisma.weatherCache.update({
            where: { lat_lng: { lat, lng } },
            data: {
              data: data as object,
              isAdverse: data.isAdverse,
              fetchedAt: new Date(data.fetchedAt),
              expiresAt: new Date(data.expiresAt),
            },
          });
        } catch {
          /* ignore persistence errors */
        }
      });

    return data;
  })();

  inFlight.set(key, request);
  try {
    return await request;
  } finally {
    inFlight.delete(key);
  }
}

/**
 * Update weather for all ships. Called every few minutes by the scheduler.
 * Updates ship.inAdverseWeather in the store.
 */
export async function updateFleetWeather(): Promise<void> {
  const ships = fleetStore.getAllShips();
  await Promise.allSettled(
    ships.map(async (ship) => {
      const weather = await getWeather(ship.position);
      fleetStore.updateShip(ship.shipId, {
        inAdverseWeather: weather.isAdverse,
      });
    }),
  );
  logger.debug("Fleet weather updated");
}
