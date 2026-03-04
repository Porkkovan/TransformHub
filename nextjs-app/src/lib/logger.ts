type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): LogLevel {
  const env =
    typeof process !== "undefined"
      ? process.env.LOG_LEVEL?.toLowerCase()
      : undefined;
  if (env && env in LOG_LEVEL_PRIORITY) return env as LogLevel;
  return typeof process !== "undefined" && process.env.NODE_ENV === "production"
    ? "info"
    : "debug";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[getMinLevel()];
}

function formatEntry(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>
): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata,
  };
  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, metadata?: Record<string, unknown>): void {
    if (!shouldLog("debug")) return;
    console.debug(formatEntry("debug", message, metadata));
  },

  info(message: string, metadata?: Record<string, unknown>): void {
    if (!shouldLog("info")) return;
    console.info(formatEntry("info", message, metadata));
  },

  warn(message: string, metadata?: Record<string, unknown>): void {
    if (!shouldLog("warn")) return;
    console.warn(formatEntry("warn", message, metadata));
  },

  error(message: string, metadata?: Record<string, unknown>): void {
    if (!shouldLog("error")) return;
    console.error(formatEntry("error", message, metadata));
  },
};

export default logger;
