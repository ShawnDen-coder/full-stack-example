import { z } from "zod";
import { jobStatuses } from "./statuses";

export const jobsSearchSchema = z.object({
	status: z.enum(jobStatuses).optional().catch(undefined),
	page: z.number().int().positive().optional().catch(1),
	pageSize: z.number().int().min(1).max(50).optional().catch(20),
	jobId: z.string().trim().min(1).max(128).optional().catch(undefined),
});
