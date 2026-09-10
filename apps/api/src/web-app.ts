import { serveStatic } from "@hono/node-server/serve-static";
import type { Env, Hono, Schema } from "hono";

export function setupWebApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: { readonly assetsDirectory?: string },
) {
  if (!options.assetsDirectory) return app;

  const staticFiles = serveStatic({
    root: options.assetsDirectory,
    onFound: (_path, context) => {
      context.header(
        "Cache-Control",
        context.req.path.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600",
      );
    },
  });
  const index = serveStatic({
    root: options.assetsDirectory,
    path: "index.html",
    onFound: (_path, context) => context.header("Cache-Control", "no-cache"),
  });

  return app
    .all("/api/*", (context) => context.notFound())
    .use("*", async (context, next) => {
      if (context.req.method !== "GET" && context.req.method !== "HEAD") return next();
      return staticFiles(context, next);
    })
    .get("*", (context, next) => index(context, next));
}
