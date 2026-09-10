import type { AuthVariables } from "./contracts.js";
import type { AuthModule } from "./server.js";

export type AuthRouteEnv = { Variables: AuthVariables };

export interface SetupAuthAppOptions {
  readonly auth: AuthModule;
}
