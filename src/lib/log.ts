type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  module?: string;
  message: string;
  data?: Record<string, unknown>;
}

type LogRecord = LogPayload & {
  level: LogLevel;
  timestamp: string;
  runtime: "node" | "browser";
};

const NODE_PROCESS = typeof process === "object" && process !== null ? process : null;
const HAS_WINDOW = typeof window !== "undefined";
const FORCE_FILE_LOGGING = NODE_PROCESS?.env?.LOG_FORCE_FILE_OUTPUT === "true";
const LOG_FILE_PATH = NODE_PROCESS?.env?.LOG_FILE_PATH ?? "logs/menuplanner-audit.jsonl";

async function maybeImportNodeModule<T>(specifier: string): Promise<T | null> {
  try {
    return (await import(specifier)) as T;
  } catch {
    return null;
  }
}

function getDirname(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash > 0 ? normalized.slice(0, lastSlash) : ".";
}

function buildLogRecord(level: LogLevel, payload: LogPayload): LogRecord {
  return {
    level,
    timestamp: new Date().toISOString(),
    runtime: HAS_WINDOW ? "browser" : "node",
    ...payload,
  };
}

function shouldWriteToFile() {
  if (!NODE_PROCESS?.versions?.node) return false;
  if (FORCE_FILE_LOGGING) return true;
  return !HAS_WINDOW;
}

async function writeToFile(payload: LogRecord) {
  if (!shouldWriteToFile() || !LOG_FILE_PATH || !NODE_PROCESS?.versions?.node) return;
  try {
    const fsModule = await maybeImportNodeModule<{
      mkdir: (path: string, options: { recursive?: boolean }) => Promise<void>;
      appendFile: (file: string, data: string, encoding: "utf8") => Promise<void>;
    }>("fs/promises");
    if (!fsModule) return;
    await fsModule.mkdir(getDirname(LOG_FILE_PATH), { recursive: true });
    const { appendFile } = fsModule;
    await appendFile(LOG_FILE_PATH, `${JSON.stringify(payload)}\n`, "utf8");
  } catch {
    // Best effort logging. Console already has output.
  }
}

function emit(level: LogLevel, payload: LogPayload) {
  const record = buildLogRecord(level, payload);
  const base = record;

  // For now, just use console; this can later be routed to a service.
  // eslint-disable-next-line no-console
  console[level === "info" ? "log" : level](base);
  void writeToFile(base);
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

