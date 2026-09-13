import type { AuthModule } from "@full-stack-example/auth/server";
import type { Logger } from "@full-stack-example/logging";
import type { Context, MiddlewareHandler, Next } from "hono";

const readMethods = new Set(["GET", "HEAD", "OPTIONS"]);

function decodePathSegment(segment: string | undefined): string | undefined {
  if (!segment) return undefined;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function requireSameOrigin(webOrigin: string): MiddlewareHandler {
  return async (context: Context, next: Next) => {
    if (readMethods.has(context.req.method)) return next();
    const origin = context.req.header("Origin");
    const requestOrigin = new URL(context.req.url).origin;
    if (!origin || (origin !== webOrigin && origin !== requestOrigin))
      return context.json({ error: "CSRF validation failed" }, 403);
    return next();
  };
}

function auditMutation(logger: Logger): MiddlewareHandler {
  return async (context, next) => {
    if (readMethods.has(context.req.method)) return next();
    const startedAt = Date.now();
    await next();

    const path = new URL(context.req.url).pathname;
    const segments = path.split("/").filter(Boolean);
    const queueIndex = segments.lastIndexOf("queues");
    const jobIndex = segments.indexOf("jobs");
    const boardJobsIndex = segments.lastIndexOf("jobs");
    const queueName = decodePathSegment(queueIndex >= 0 ? segments[queueIndex + 1] : undefined);
    const jobId = decodePathSegment(
      queueIndex >= 0 && boardJobsIndex > queueIndex ? segments[boardJobsIndex + 1] : undefined,
    );
    const jobResource = decodePathSegment(jobIndex >= 0 ? segments[jobIndex + 1] : undefined);

    logger.info("Job administration mutation", {
      event: "jobs.mutation",
      actorUserId: (context.get("sessionPrincipal") as { readonly userId?: string } | undefined)
        ?.userId,
      requestId: context.get("requestId"),
      method: context.req.method,
      path,
      ...(queueName ? { queueName } : {}),
      ...(jobId ? { jobId } : {}),
      ...(jobResource ? { jobResource } : {}),
      status: context.res.status,
      durationMs: Date.now() - startedAt,
    });
  };
}

export function createJobsAdminPolicy(options: {
  readonly auth: AuthModule;
  readonly logger: Logger;
  readonly webOrigin: string;
}) {
  return {
    beforeAuthorization: [auditMutation(options.logger)],
    authorization: [
      requireSameOrigin(options.webOrigin),
      options.auth.require.requireSession,
      options.auth.require.requirePlatformAdmin,
      options.auth.require.requireFreshSession,
    ],
    boardAuthorization: [
      requireSameOrigin(options.webOrigin),
      options.auth.require.requireSession,
      options.auth.require.requirePlatformAdmin,
      async (context: Context, next: Next) => {
        if (readMethods.has(context.req.method)) return next();
        return options.auth.require.requireFreshSession(context, next);
      },
    ],
  } as const;
}
