import type { LogRecord } from "@logtape/logtape";

export interface StreamLogRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly severity: string;
  readonly category: readonly string[];
  readonly message: string;
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface LogReplay {
  readonly records: readonly StreamLogRecord[];
  readonly truncated: boolean;
}

export interface LogStream {
  readonly publish: (record: LogRecord) => void;
  readonly subscribe: (lastEventId?: string) => LogSubscription;
  readonly latestId: () => string;
}

export interface LogSubscription {
  readonly replay: LogReplay;
  readonly next: () => Promise<StreamLogRecord | undefined>;
  readonly close: () => void;
  readonly overflowed: () => boolean;
}

const MAX_SNAPSHOT_DEPTH = 8;

function snapshotValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "undefined") return "[Undefined]";
  if (typeof value === "symbol") return String(value);
  if (typeof value === "function") return "[Function]";
  if (depth >= MAX_SNAPSHOT_DEPTH) return "[MaxDepth]";
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) {
    return value.map((item) => snapshotValue(item, seen, depth + 1));
  }
  const result: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    result[key] = descriptor && "value" in descriptor
      ? snapshotValue(descriptor.value, seen, depth + 1)
      : "[Unavailable]";
  }
  return result;
}

function safeSnapshot(value: unknown): Readonly<Record<string, unknown>> {
  const snapshot = snapshotValue(value, new WeakSet<object>(), 0);
  return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
    ? snapshot as Record<string, unknown>
    : { value: snapshot };
}

export function createLogStream(options: { readonly capacity?: number } = {}): LogStream {
  const capacity = options.capacity ?? 1000;
  if (!Number.isSafeInteger(capacity) || capacity < 1) {
    throw new Error("capacity must be a positive integer");
  }
  const records: StreamLogRecord[] = [];
  const listeners = new Set<(record: StreamLogRecord) => void>();
  let sequence = 0;
  return {
    publish(record) {
      const entry: StreamLogRecord = {
        id: String(++sequence),
        timestamp: new Date(record.timestamp).toISOString(),
        severity: record.level,
        category: [...record.category],
        message: record.message.map((part) => String(part)).join(""),
        properties: safeSnapshot(record.properties),
      };
      records.push(entry);
      if (records.length > capacity) records.shift();
      for (const listener of listeners) listener(entry);
    },
    subscribe(lastEventId) {
      let closed = false;
      let overflow = false;
      const queue: StreamLogRecord[] = [];
      let resolveNext: ((record: StreamLogRecord | undefined) => void) | undefined;
      const snapshot = (): LogReplay => {
        if (!lastEventId) return { records: [...records], truncated: false };
        const requested = Number(lastEventId);
        const first = records[0] ? Number(records[0].id) : sequence;
        if (!Number.isSafeInteger(requested) || requested < first - 1)
          return { records: [...records], truncated: true };
        return {
          records: records.filter((record) => Number(record.id) > requested),
          truncated: false,
        };
      };
      const listener = (record: StreamLogRecord) => {
        if (closed) return;
        if (resolveNext) {
          const resolve = resolveNext;
          resolveNext = undefined;
          resolve(record);
          return;
        }
        if (queue.length >= 100) {
          overflow = true;
          close();
          return;
        }
        queue.push(record);
      };
      const close = () => {
        if (closed) return;
        closed = true;
        listeners.delete(listener);
        if (resolveNext) {
          resolveNext(undefined);
          resolveNext = undefined;
        }
      };
      listeners.add(listener);
      const replay = snapshot();
      return {
        replay,
        next: () => {
          const queued = queue.shift();
          if (queued) return Promise.resolve(queued);
          if (closed) return Promise.resolve(undefined);
          return new Promise((resolve) => {
            resolveNext = resolve;
          });
        },
        close,
        overflowed: () => overflow,
      };
    },
    latestId: () => String(sequence),
  };
}
