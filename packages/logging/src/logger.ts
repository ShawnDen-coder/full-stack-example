import pino, { type Logger } from "pino";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";
export type Environment = "development" | "test" | "production";

export interface CreateLoggerOptions {
  readonly service: string;
  readonly environment: Environment;
  readonly level: LogLevel;
  readonly version?: string;
  readonly pretty: boolean;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const loggerOptions = {
    level: options.level,
    base: {
      service: options.service,
      environment: options.environment,
      ...(options.version ? { version: options.version } : {}),
    },
    redact: {
      paths: [
        "authorization",
        "cookie",
        "set-cookie",
        "password",
        "token",
        "accessToken",
        "refreshToken",
        "apiKey",
        "secret",
        "databaseUrl",
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
      ],
      censor: "[Redacted]",
    },
  };
  return options.pretty && options.environment !== "production"
    ? pino({
        ...loggerOptions,
        transport: { target: "pino-pretty", options: { colorize: true, singleLine: true } },
      })
    : pino(loggerOptions);
}
