import { z } from "zod";
import { jobStatuses } from "./statuses";
export const jobsSearchSchema = z
	.object({
		status: z.enum(jobStatuses).optional().catch(undefined),
		page: z.number().int().min(1).max(10000).optional().catch(1),
		pageSize: z.number().int().min(1).max(50).optional().catch(20),
		mode: z.enum(["browse", "id", "name"]).optional().catch(undefined),
		query: z.string().trim().min(1).max(128).optional().catch(undefined),
		jobId: z.string().trim().min(1).max(128).optional().catch(undefined),
	})
	.transform(({ jobId, mode, query, ...rest }) => ({
		...rest,
		mode: mode ?? (jobId ? ("id" as const) : undefined),
		query: query ?? jobId,
	}));
