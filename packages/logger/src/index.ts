import pino, { type DestinationStream, type Logger } from "pino";

export type { Logger };

// Exceptions can contain URLs and SQL parameters. Keep the stack, but never
// serialize arbitrary driver properties, request bodies or nested causes.
function safeText(value: string) {
	return value
		.replace(/Failed query:[\s\S]*/g, "Database query failed")
		.replace(
			/(?:postgres(?:ql)?|rediss?):\/\/[^\s"']+/gi,
			"[REDACTED_CONNECTION]",
		)
		.replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
		.replace(
			/((?:password|token|secret|authorization|cookie)\s*[=:]\s*)[^\s,;]+/gi,
			"$1[REDACTED]",
		);
}

export function createLogger(service: string, destination?: DestinationStream) {
	const options: pino.LoggerOptions = {
		base: { service },
		redact: [
			"password",
			"token",
			"secret",
			"DATABASE_URL",
			"REDIS_URL",
			"authorization",
			"cookie",
			"headers.authorization",
			"headers.cookie",
			"headers.set-cookie",
			"*.password",
			"*.token",
			"*.secret",
		],
		serializers: {
			err: (error: unknown) =>
				error instanceof Error
					? {
							type: error.name,
							message: safeText(error.message),
							stack: error.stack
								? [
										safeText(error.message),
										...error.stack
											.split("\n")
											.filter((line) => line.trimStart().startsWith("at "))
											.map(safeText),
									].join("\n")
								: undefined,
						}
					: { type: "UnknownError" },
		},
	};
	return destination ? pino(options, destination) : pino(options);
}

export async function withDeadline<T>(
	work: Promise<T>,
	timeoutMs: number,
	message: string,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			work,
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error(message)), timeoutMs);
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
}
