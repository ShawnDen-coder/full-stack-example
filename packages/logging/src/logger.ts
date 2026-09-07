import { AsyncLocalStorage } from "node:async_hooks";
import {
  configure,
  dispose,
  getConsoleSink,
  getLogger,
  jsonLinesFormatter,
  type Logger,
  type LogRecord,
  type Sink,
} from "@logtape/logtape";
import { getPrettyFormatter } from "@logtape/pretty";
import { DEFAULT_REDACT_FIELDS, redactByField } from "@logtape/redaction";
import { type LogStream, createLogStream as makeLogStream } from "./stream.js";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";
export type Environment = "development" | "test" | "production";

export interface ConfigureLoggingOptions {
  readonly service: string;
  readonly environment: Environment;
  readonly level: LogLevel;
  readonly version?: string;
  readonly pretty: boolean;
  readonly stream?: LogStream;
}

const redactedFields = [
  ...DEFAULT_REDACT_FIELDS,
  "authorization",
  "cookie",
  "set-cookie",
  "accessToken",
  "refreshToken",
  "apiKey",
  "databaseUrl",
];

function toLogTapeLevel(
  level: LogLevel,
): "trace" | "debug" | "info" | "warning" | "error" | "fatal" | null {
  if (level === "silent") return null;
  return level === "warn" ? "warning" : level;
}

function streamSink(stream: LogStream): Sink {
  return (record: LogRecord) => stream.publish(record);
}

function withServiceMetadata(sink: Sink, options: ConfigureLoggingOptions): Sink {
  return (record) =>
    sink({
      ...record,
      properties: {
        service: options.service,
        environment: options.environment,
        ...(options.version ? { version: options.version } : {}),
        ...record.properties,
      },
    });
}

export async function configureLogging(options: ConfigureLoggingOptions): Promise<void> {
  const consoleSink = getConsoleSink({
    formatter:
      options.pretty && options.environment !== "production"
        ? getPrettyFormatter({ properties: true, icons: false })
        : jsonLinesFormatter,
  });
  const sinks: Record<string, Sink> = {
    console: redactByField(withServiceMetadata(consoleSink, options), {
      fieldPatterns: redactedFields,
      action: () => "[Redacted]",
    }) as Sink,
  };
  if (options.stream) {
    sinks.stream = redactByField(withServiceMetadata(streamSink(options.stream), options), {
      fieldPatterns: redactedFields,
      action: () => "[Redacted]",
    }) as Sink;
  }
  await configure({
    reset: true,
    contextLocalStorage: new AsyncLocalStorage<Record<string, unknown>>(),
    sinks,
    loggers: [
      {
        category: "full-stack-example",
        sinks: options.stream ? ["console", "stream"] : ["console"],
        lowestLevel: toLogTapeLevel(options.level),
      },
      { category: "logtape", sinks: ["console"], lowestLevel: "error" },
    ],
  });
}

export function getAppLogger(category: string | readonly string[]): Logger {
  return getLogger([
    "full-stack-example",
    ...(typeof category === "string" ? category.split(".") : category),
  ]);
}

export function createLogStream(options?: { readonly capacity?: number }): LogStream {
  return makeLogStream(options);
}

export async function shutdownLogging(): Promise<void> {
  await dispose();
}

export type { Logger } from "@logtape/logtape";
