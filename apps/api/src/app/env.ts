import type { AuthVariables } from "@full-stack-example/auth/contracts";
import type { Logger } from "@full-stack-example/logging";
import { createFactory } from "hono/factory";
import type { RequestIdVariables } from "hono/request-id";

export type AppEnv = {
  Variables: RequestIdVariables & {
    logger: Logger;
  } & AuthVariables;
};

export const appFactory = createFactory<AppEnv>();
