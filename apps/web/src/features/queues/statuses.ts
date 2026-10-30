export const jobStatuses = [
	"waiting",
	"active",
	"completed",
	"failed",
	"delayed",
	"waiting-children",
	"prioritized",
] as const;
export type JobStatus = (typeof jobStatuses)[number];

export const jobStatusLabels: Record<JobStatus, string> = {
	waiting: "Waiting",
	active: "Active",
	delayed: "Delayed",
	completed: "Completed",
	failed: "Failed",
	prioritized: "Prioritized",
	"waiting-children": "Waiting children",
};
