import {
	jobStatuses,
	QueueMonitorUnavailableError,
} from "@full-stack-example/runtime/queue-monitor";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import { platformProcedure } from "../procedures";

const queueKey = z.string().trim().min(1).max(64);
const jobId = z.string().trim().min(1).max(128);
const page = z.number().int().min(1).max(10_000).default(1);
const pageSize = z.number().int().min(1).max(50).default(20);

async function runQueueOperation<T>(
	context: Context,
	operation: string,
	work: () => Promise<T | null>,
) {
	let result: T | null;
	try {
		result = await work();
	} catch (error) {
		const dependency = error instanceof QueueMonitorUnavailableError;
		context.logger.error(
			{
				event: "queue_monitor.failed",
				failure_kind: dependency ? "dependency" : "internal",
				operation,
				...(dependency ? { source: error.source } : {}),
			},
			"Queue monitor failed",
		);
		if (dependency)
			throw new ORPCError("SERVICE_UNAVAILABLE", {
				message: "Queue monitoring is temporarily unavailable",
			});
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Internal server error",
		});
	}
	if (result === null) throw new ORPCError("NOT_FOUND");
	return result;
}

const procedure = platformProcedure;

export const queuesRouter = {
	list: procedure.handler(({ context }) =>
		runQueueOperation(context, "list", () =>
			context.services.queueMonitor.list(),
		),
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
			runQueueOperation(context, "jobs", () =>
				context.services.queueMonitor.jobs(input),
			),
		),
	job: procedure
		.input(z.object({ queueKey, jobId }))
		.handler(({ context, input }) =>
			runQueueOperation(context, "job", () =>
				context.services.queueMonitor.job(input),
			),
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
			runQueueOperation(context, "logs", () =>
				context.services.queueMonitor.logs(input),
			),
		),
	schedulers: procedure
		.input(z.object({ queueKey, page }))
		.handler(({ context, input }) =>
			runQueueOperation(context, "schedulers", () =>
				context.services.queueMonitor.schedulers(input),
			),
		),
};
