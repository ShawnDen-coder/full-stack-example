import { type DescribeRouteOptions, resolver } from "hono-openapi";
import { z } from "zod";

export const userInput = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(200),
});
export const organizationInput = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(100),
  ownerUserId: z.string().min(1),
});
export const statusInput = z.object({ status: z.enum(["active", "disabled"]) });
export const organizationIdParam = z.object({ id: z.string().min(1) });

const unauthorizedSchema = z.object({ error: z.literal("Unauthorized") });
const forbiddenSchema = z.object({ error: z.literal("Forbidden") });
const internalErrorSchema = z.object({ error: z.literal("Internal server error") });
const idResponseSchema = z.object({ id: z.string() });

const platformAuthorizationResponses = {
  401: {
    description: "A valid Better Auth session is required.",
    content: { "application/json": { schema: resolver(unauthorizedSchema) } },
  },
  403: {
    description: "A fresh platform-admin session is required.",
    content: { "application/json": { schema: resolver(forbiddenSchema) } },
  },
  500: {
    description: "Unexpected internal server error.",
    content: { "application/json": { schema: resolver(internalErrorSchema) } },
  },
} as const;

export const createPlatformUserDescription: DescribeRouteOptions = {
  operationId: "createPlatformUser",
  tags: ["Platform Admin"],
  summary: "Create a user",
  description:
    "Create a user and send a password-reset link. Requires a fresh platform-admin session.",
  requestBody: {
    content: { "application/json": { schema: resolver(userInput) } },
  },
  responses: {
    201: {
      description: "Created user.",
      content: { "application/json": { schema: resolver(idResponseSchema) } },
    },
    ...platformAuthorizationResponses,
  },
};

export const createPlatformOrganizationDescription: DescribeRouteOptions = {
  operationId: "createPlatformOrganization",
  tags: ["Platform Admin"],
  summary: "Create an organization",
  description: "Create an organization for a user. Requires a fresh platform-admin session.",
  requestBody: {
    content: { "application/json": { schema: resolver(organizationInput) } },
  },
  responses: {
    201: {
      description: "Created organization.",
      content: { "application/json": { schema: resolver(idResponseSchema) } },
    },
    ...platformAuthorizationResponses,
  },
};

export const setOrganizationStatusDescription: DescribeRouteOptions = {
  operationId: "setOrganizationStatus",
  tags: ["Platform Admin"],
  summary: "Set organization status",
  description: "Enable or disable an organization. Requires a fresh platform-admin session.",
  responses: {
    204: { description: "Organization status updated." },
    ...platformAuthorizationResponses,
  },
};

export const requestPasswordResetDescription: DescribeRouteOptions = {
  operationId: "requestPlatformPasswordReset",
  tags: ["Platform Admin"],
  summary: "Request a password reset",
  description: "Send a password-reset link for a user. Requires a fresh platform-admin session.",
  responses: {
    204: { description: "Password-reset request accepted." },
    ...platformAuthorizationResponses,
  },
};
