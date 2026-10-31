// Better Auth CLI only: no queues, workers, or HTTP listeners.
import { createAuthSchema } from "@full-stack-example/runtime/deployment";
import { ENV } from "./env.server";

export const auth = createAuthSchema(ENV);
