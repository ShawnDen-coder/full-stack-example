import { createServerResources } from "@full-stack-example/runtime/server";

export type { ServerConfig } from "@full-stack-example/runtime/server";

// The application invokes its adjacent-layer resource factory; it owns shutdown.
export const createServices = createServerResources;
