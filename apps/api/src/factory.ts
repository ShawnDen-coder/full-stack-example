import { createFactory } from "hono/factory";
import type { RequestIdVariables } from "hono/request-id";
import type { Logger } from "pino";

export type AppEnv = {
  Variables: RequestIdVariables & {
    logger: Logger;
  };
};

export const appFactory = createFactory<AppEnv>();
