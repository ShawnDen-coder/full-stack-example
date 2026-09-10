import type { DescribeRouteOptions } from "hono-openapi";

export const logStreamDescription: DescribeRouteOptions = {
  operationId: "streamLogs",
  tags: ["Diagnostics"],
  summary: "Stream application logs",
  description:
    "Open a long-lived Server-Sent Events stream for redacted diagnostic logs. Swagger Try it out keeps this request open.",
  parameters: [
    {
      in: "header",
      name: "Last-Event-ID",
      required: false,
      schema: { type: "string" },
      description: "Resume replay after this event ID when it is still buffered.",
    },
  ],
  responses: {
    200: {
      description:
        "SSE stream containing ready, log, reset, and overflow events with periodic heartbeat comments.",
      content: { "text/event-stream": { schema: { type: "string" } } },
    },
    401: { description: "A valid Better Auth session is required." },
    403: { description: "A fresh platform-admin session is required." },
    500: { description: "Unexpected internal server error." },
  },
};
