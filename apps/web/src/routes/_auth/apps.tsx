import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Apps } from "@/features/apps";
export const Route = createFileRoute("/_auth/apps")({
	validateSearch: z.object({
		type: z
			.enum(["all", "connected", "notConnected"])
			.optional()
			.catch(undefined),
		filter: z.string().optional().catch(""),
		sort: z.enum(["asc", "desc"]).optional().catch(undefined),
	}),
	component: Apps,
});
