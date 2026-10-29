import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { platformProcedure } from "../procedures";
import { jobStatuses, QueueMonitorUnavailableError } from "../queue-monitor";

const queueKey = z.string().trim().min(1).max(64);
const jobId = z.string().trim().min(1).max(128);
const page = z.number().int().min(1).max(10_000).default(1);
const pageSize = z.number().int().min(1).max(50).default(20);

async function run<T>(work: () => Promise<T | null>) {
	try {
		const result = await work();
		if (result === null) throw new ORPCError("NOT_FOUND");
		return result;
	} catch (error) {
		if (error instanceof ORPCError) throw error;
		if (error instanceof QueueMonitorUnavailableError)
			throw new ORPCError("SERVICE_UNAVAILABLE", {
				message: "Queue monitoring is temporarily unavailable",
			});
		throw error;
	}
}

const procedure = platformProcedure;

export const queuesRouter = {
	list: procedure.handler(({ context }) =>
		run(() => context.services.queueMonitor.list()),
	),
	jobs: procedure
		.input(
			z
				.object({
					queueKey,
					status: z.enum(jobStatuses).default("waiting"),
					page,
					pageSize,
					jobId: jobId.optional(),
					mode: z.enum(["browse", "id", "name"]).optional(),
					query: jobId.optional(),
				})
				.refine(
					(input) =>
						!input.mode ||
						input.mode === "browse" ||
						!!input.query ||
						(input.mode === "id" && !!input.jobId),
				),
		)
		.handler(({ context, input }) =>
			run(() => context.services.queueMonitor.jobs(input)),
		),
	job: procedure
		.input(z.object({ queueKey, jobId }))
		.handler(({ context, input }) =>
			run(() => context.services.queueMonitor.job(input)),
		),
	logs: procedure
		.input(
			z.object({
				queueKey,
				jobId,
				page,
				pageSize: z.number().int().min(1).max(100).default(50),
			}),
		)
		.handler(({ context, input }) =>
			run(() => context.services.queueMonitor.logs(input)),
		),
	schedulers: procedure
		.input(z.object({ queueKey, page }))
		.handler(({ context, input }) =>
			run(() => context.services.queueMonitor.schedulers(input)),
		),
};
