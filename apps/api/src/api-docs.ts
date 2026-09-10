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

const authPaths = new Set([
  "/sign-up/email",
  "/sign-in/email",
  "/sign-out",
  "/get-session",
  "/organization/list",
  "/organization/create",
  "/organization/set-active",
]);
const publicAuthPaths = new Set(["/sign-up/email", "/sign-in/email"]);
const todoPaths = new Set(["/api/todos", "/api/todos/{id}"]);

const documentation = {
  openapi: "3.1.0",
  info: {
    title: "Full Stack Example API",
    version: "0.1.0",
    description:
      "HTTP API for health checks and todo management. Todo operations require a Better Auth session and an active workspace.",
  },
  servers: [{ url: "http://localhost:3000", description: "Local development" }],
};

function mergeAuthDocument(
  document: OpenApiDocument,
  authDocument: OpenApiDocument,
): OpenApiDocument {
  const paths = { ...(document.paths ?? {}) };
  for (const [path, item] of Object.entries(authDocument.paths ?? {})) {
    if (!authPaths.has(path)) continue;
    paths[`/api/auth${path}`] = {
      ...item,
      security: publicAuthPaths.has(path) ? [] : [{ apiKeyCookie: [] }],
    };
  }
  for (const path of todoPaths) {
    const item = paths[path];
    if (item) paths[path] = { ...item, security: [{ apiKeyCookie: [] }] };
  }
  const health = paths["/health"];
  if (health) paths["/health"] = { ...health, security: [] };
  return {
    ...document,
    paths,
    components: {
      ...(document.components ?? {}),
      ...(authDocument.components ?? {}),
      schemas: {
        ...record(record(document.components).schemas),
        ...record(record(authDocument.components).schemas),
      },
      securitySchemes: {
        ...record(record(document.components).securitySchemes),
        ...record(record(authDocument.components).securitySchemes),
      },
    },
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
    exclude: [/^\/api\/logs\/stream$/, /^\/docs$/, /^\/openapi\.json$/],
  });
  const withOpenApi = app.get("/openapi.json", async (context, next) => {
    const response = await honoDocument(context, next);
    if (!response || !options.auth?.getOpenApiSchema) return response;
    const document = (await response.json()) as OpenApiDocument;
    const authDocument = (await options.auth.getOpenApiSchema()) as OpenApiDocument;
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
