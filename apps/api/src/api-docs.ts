import { swaggerUI } from "@hono/swagger-ui";
import type { Env, Hono, Schema } from "hono";
import { openAPIRouteHandler } from "hono-openapi";

const documentation = {
  openapi: "3.1.0",
  info: {
    title: "Full Stack Example API",
    version: "0.1.0",
    description: "HTTP API for health checks and todo management.",
  },
  servers: [{ url: "http://localhost:3000", description: "Local development" }],
};

export function setupApiDocs<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: { readonly enabled: boolean },
) {
  if (!options.enabled) return app;

  const withOpenApi = app.get(
    "/openapi.json",
    openAPIRouteHandler(app, {
      documentation,
      exclude: [/^\/api\/logs\/stream$/, /^\/docs$/, /^\/openapi\.json$/],
    }),
  );
  return withOpenApi.get(
    "/docs",
    swaggerUI({ title: "Full Stack Example API", url: "/openapi.json" }),
  );
}
