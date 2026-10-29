import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Tasks } from "@/features/tasks";
export const Route = createFileRoute("/_auth/tasks")({
	staticData: { layout: "fixed", breadcrumb: "tasks" },
	validateSearch: z.object({
		page: z.number().int().positive().optional().catch(1),
		pageSize: z.number().int().min(1).max(100).optional().catch(10),
		status: z
			.array(z.enum(["todo", "in progress", "done", "canceled", "backlog"]))
			.optional()
			.catch([]),
		priority: z
			.array(z.enum(["low", "medium", "high"]))
			.optional()
			.catch([]),
		filter: z.string().optional().catch(""),
	}),
	component: Tasks,
});
