type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  module?: string;
  message: string;
  data?: Record<string, unknown>;
}

function emit(level: LogLevel, payload: LogPayload) {
  const timestamp = new Date().toISOString();
  const base = {
    level,
    timestamp,
    ...payload,
  };

  // For now, just use console; this can later be routed to a service.
  // eslint-disable-next-line no-console
  console[level === "info" ? "log" : level](base);
}

export const log = {
  info(payload: LogPayload) {
    emit("info", payload);
  },
  warn(payload: LogPayload) {
    emit("warn", payload);
  },
  error(payload: LogPayload) {
    emit("error", payload);
  },
};

