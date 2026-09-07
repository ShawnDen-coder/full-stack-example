import type { Logger } from "@full-stack-example/logging";
import { createFactory } from "hono/factory";
import type { RequestIdVariables } from "hono/request-id";

export type AppEnv = {
  Variables: RequestIdVariables & {
    logger: Logger;
  };
};

export const appFactory = createFactory<AppEnv>();
