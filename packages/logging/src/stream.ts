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
  readonly snapshotAfter: (lastEventId?: string) => LogReplay;
  readonly subscribe: (listener: (record: StreamLogRecord) => void) => () => void;
  readonly latestId: () => string;
}

export function createLogStream(options: { readonly capacity?: number } = {}): LogStream {
  const capacity = options.capacity ?? 1000;
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
        properties: JSON.parse(JSON.stringify(record.properties)) as Record<string, unknown>,
      };
      records.push(entry);
      if (records.length > capacity) records.shift();
      for (const listener of listeners) listener(entry);
    },
    snapshotAfter(lastEventId) {
      if (!lastEventId) return { records: [...records], truncated: false };
      const requested = Number(lastEventId);
      const first = records[0] ? Number(records[0].id) : sequence;
      if (!Number.isSafeInteger(requested) || requested < first - 1)
        return { records: [...records], truncated: true };
      return { records: records.filter((record) => Number(record.id) > requested), truncated: false };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    latestId: () => String(sequence),
  };
}
