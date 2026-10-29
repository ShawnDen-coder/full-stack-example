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
