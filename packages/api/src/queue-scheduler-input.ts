import { CronExpressionParser } from "cron-parser";
import { z } from "zod";

const positiveInteger = z.number().int().positive().safe();
const epoch = z.number().int().safe().nullable();
const common = {
	limit: positiveInteger.nullable(),
	startDate: epoch,
	endDate: epoch,
};

export const schedulerScheduleSchema = z.union([
	z.strictObject({
		...common,
		pattern: z.string().trim().min(1).max(256),
		every: z.null(),
		tz: z.string().nullable(),
	}),
	z.strictObject({
		...common,
		pattern: z.null(),
		every: positiveInteger,
		tz: z.null(),
	}),
]);

export type SchedulerSchedule = z.infer<typeof schedulerScheduleSchema>;

/** Validate against the current server clock and the freshly read iteration count. */
export function validateSchedulerSchedule(
	schedule: SchedulerSchedule,
	iterationCount: number,
	now = Date.now(),
): { reason: "INVALID_SCHEDULE" | "NO_NEXT_RUN"; field: string } | null {
	if (schedule.limit !== null && schedule.limit <= iterationCount)
		return { reason: "INVALID_SCHEDULE", field: "limit" };
	if (schedule.endDate !== null && schedule.endDate <= now)
		return { reason: "INVALID_SCHEDULE", field: "endDate" };
	if (
		schedule.startDate !== null &&
		schedule.endDate !== null &&
		schedule.startDate >= schedule.endDate
	)
		return { reason: "INVALID_SCHEDULE", field: "endDate" };
	if (schedule.pattern !== null) {
		if (schedule.tz !== null) {
			try {
				if (/^[+-]/.test(schedule.tz)) throw new Error();
				new Intl.DateTimeFormat("en", { timeZone: schedule.tz });
			} catch {
				return { reason: "INVALID_SCHEDULE", field: "tz" };
			}
		}
		if (![5, 6].includes(schedule.pattern.split(/\s+/).length))
			return { reason: "INVALID_SCHEDULE", field: "pattern" };
		try {
			const expression = CronExpressionParser.parse(schedule.pattern, {
				tz: schedule.tz ?? undefined,
				currentDate: Math.max(now, (schedule.startDate ?? 0) - 1),
			});
			const next = expression.next().getTime();
			if (schedule.endDate !== null && next > schedule.endDate)
				return { reason: "NO_NEXT_RUN", field: "endDate" };
		} catch {
			return { reason: "INVALID_SCHEDULE", field: "pattern" };
		}
	}
	return null;
}
