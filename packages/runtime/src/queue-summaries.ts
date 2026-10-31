import { userProfileJobSchema } from "@full-stack-example/domain/users/jobs/profile-read/contract";

export function summarizeProfileJobData(data: unknown): Record<string, string> {
	const parsed = userProfileJobSchema.safeParse(data);
	if (!parsed.success) return {};
	const summary: Record<string, string> = { userId: parsed.data.userId };
	if (parsed.data.requestId) summary.requestId = parsed.data.requestId;
	return summary;
}

export function summarizeProfileJobResult(
	result: unknown,
): Record<string, string> {
	if (!result || typeof result !== "object") return {};
	const record = result as Record<string, unknown>;
	const summary: Record<string, string> = {};
	if (typeof record.id === "string") summary.id = record.id;
	if (typeof record.emailVerified === "boolean")
		summary.emailVerified = String(record.emailVerified);
	return summary;
}
