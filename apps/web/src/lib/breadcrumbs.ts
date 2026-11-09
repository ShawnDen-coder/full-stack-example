export type BreadcrumbKey =
	| "tool-center"
	| "todos"
	| "queues"
	| "queue-jobs"
	| "queue-job"
	| "queue-schedulers"
	| "workspaces"
	| "users"
	| "dashboard"
	| "tasks"
	| "integrations"
	| "chats"
	| "profile"
	| "appearance";

import { linkOptions } from "@tanstack/react-router";

export const breadcrumbTargets = {
	toolHome: linkOptions({ to: "/apps" }),
	queues: linkOptions({ to: "/queues" }),
	jobs: (queueKey: string) =>
		linkOptions({ to: "/queues/$queueKey/jobs", params: { queueKey } }),
};

export function breadcrumbAncestors(
	key: BreadcrumbKey | undefined,
	queueKey: string | undefined,
	access: { toolHome: boolean; queues: boolean },
): ("tool-home" | "queues" | "queue" | "jobs")[] {
	if (key === "todos" && access.toolHome) return ["tool-home"];
	if (!queueKey || !access.queues) return [];
	if (key === "queue-job") return ["queues", "queue", "jobs"];
	if (key === "queue-jobs" || key === "queue-schedulers")
		return ["queues", "queue"];
	return [];
}

export function breadcrumbViewModel({
	key,
	queueKey,
	jobId,
	workspaceName,
	leafTitle,
	access,
}: {
	key: BreadcrumbKey | undefined;
	queueKey?: string;
	jobId?: string;
	workspaceName?: string;
	leafTitle?: string;
	access: { toolHome: boolean; queues: boolean };
}) {
	const queuePage =
		key === "queue-job" || key === "queue-jobs" || key === "queue-schedulers";
	const leaf =
		key === "queue-job"
			? jobId
			: key === "queue-jobs"
				? "Jobs"
				: key === "queue-schedulers"
					? "Schedulers"
					: leafTitle;
	const current =
		queuePage && queueKey && leaf
			? `${queueKey} / ${leaf}`
			: key === "workspaces"
				? "Platform / Workspaces"
				: key === "users" && workspaceName
					? `${workspaceName} / ${leaf}`
					: leaf;
	const chain = breadcrumbAncestors(key, queueKey, access);
	return { queuePage, current, leaf, chain };
}
