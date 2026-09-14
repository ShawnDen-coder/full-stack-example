import type { Env, Hono, Schema } from "hono";
import { createFactory } from "hono/factory";
import {
  authHandler,
  createPlatformOrganizationHandlers,
  setOrganizationStatusHandlers,
} from "./route.handler.js";
import type { AuthRouteEnv, SetupAuthAppOptions } from "./types.js";

const authFactory = createFactory<AuthRouteEnv>();

function createAuthRoutes(options: SetupAuthAppOptions) {
  return authFactory
    .createApp()
    .post("/platform/organizations", ...createPlatformOrganizationHandlers(options))
    .patch("/platform/organizations/:id/status", ...setOrganizationStatusHandlers(options))
    .on(["GET", "POST"], "/auth/*", ...authHandler(options));
}

export function setupAuthApp<E extends Env, S extends Schema, BasePath extends string>(
  app: Hono<E, S, BasePath>,
  options: SetupAuthAppOptions,
) {
  return app.route("/", createAuthRoutes(options));
}
