import { config } from "../config/index.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};
const MIN_LEVEL: LogLevel = config.nodeEnv === "production" ? "info" : "debug";

function log(
  level: LogLevel,
  context: string,
  message: string,
  data?: unknown,
): void {
  if (LEVELS[level] < LEVELS[MIN_LEVEL]) return;
  const entry = {
    level,
    context,
    message,
    timestamp: new Date().toISOString(),
    ...(data !== undefined ? { data } : {}),
  };
  const out = JSON.stringify(entry);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export function createLogger(context: string) {
  return {
    debug: (msg: string, data?: unknown) => log("debug", context, msg, data),
    info: (msg: string, data?: unknown) => log("info", context, msg, data),
    warn: (msg: string, data?: unknown) => log("warn", context, msg, data),
    error: (msg: string, data?: unknown) => log("error", context, msg, data),
  };
}
