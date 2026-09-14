import type { AuthModule } from "@full-stack-example/auth/server";
import { swaggerUI } from "@hono/swagger-ui";
import type { Env, Hono, Schema } from "hono";
import { openAPIRouteHandler } from "hono-openapi";

type OpenApiDocument = {
  readonly paths?: Record<string, Record<string, unknown>>;
  readonly components?: Record<string, unknown>;
  readonly [key: string]: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

const documentation = {
  openapi: "3.1.0",
  info: {
    title: "Full Stack Example API",
    version: "0.1.0",
    description:
      "HTTP API for health checks and todo management. Todo operations require a Better Auth session and an active workspace.",
  },
};

function mergeAuthDocument(
  document: OpenApiDocument,
  authDocument: OpenApiDocument,
): OpenApiDocument {
  const paths = { ...(document.paths ?? {}), ...(authDocument.paths ?? {}) };
  const documentComponents = record(document.components);
  const authComponents = record(authDocument.components);
  const componentSections = new Set([
    ...Object.keys(documentComponents),
    ...Object.keys(authComponents),
  ]);
  const components: Record<string, unknown> = {};
  for (const section of componentSections) {
    components[section] = {
      ...record(documentComponents[section]),
      ...record(authComponents[section]),
    };
  }
  return {
    ...document,
    paths,
    components,
    security: [{ apiKeyCookie: [] }],
  };
}

export function setupApiDocs<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: { readonly enabled: boolean; readonly auth?: AuthModule },
) {
  if (!options.enabled) return app;

  const honoDocument = openAPIRouteHandler(app, {
    documentation,
    exclude: [/^\/docs$/, /^\/openapi\.json$/],
  });
  const withOpenApi = app.get("/openapi.json", async (context, next) => {
    const response = await honoDocument(context, next);
    if (!response || !options.auth?.getOpenApiDocument) return response;
    const document = (await response.json()) as OpenApiDocument;
    const authDocument = (await options.auth.getOpenApiDocument()) as OpenApiDocument;
    return context.json(mergeAuthDocument(document, authDocument));
  });
  return withOpenApi.get(
    "/docs",
    swaggerUI({
      title: "Full Stack Example API",
      url: "/openapi.json",
      withCredentials: true,
    }),
  );
}
