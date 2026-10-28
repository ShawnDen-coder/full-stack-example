import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { AdminUsers } from "@/features/access/admin-users";
import { roles } from "@/features/users/data/data";

const usersSearchSchema = z.object({
	page: z.number().int().positive().optional().catch(1),
	pageSize: z.number().int().min(1).max(100).optional().catch(10),
	// Facet filters
	status: z
		.array(
			z.union([
				z.literal("active"),
				z.literal("inactive"),
				z.literal("invited"),
				z.literal("suspended"),
			]),
		)
		.optional()
		.catch([]),
	role: z
		.array(z.enum(roles.map((r) => r.value as (typeof roles)[number]["value"])))
		.optional()
		.catch([]),
	// Per-column text filter (example for username)
	username: z.string().optional().catch(""),
});

export const Route = createFileRoute("/_auth/users")({
	validateSearch: usersSearchSchema,
	component: AdminUsers,
});
