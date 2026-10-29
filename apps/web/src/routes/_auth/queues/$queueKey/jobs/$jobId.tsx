import { createFileRoute } from "@tanstack/react-router";
import { QueueJobDetail } from "@/features/queues/job-detail";

import { jobsSearchSchema } from "@/features/queues/search";

export const Route = createFileRoute("/_auth/queues/$queueKey/jobs/$jobId")({
	staticData: { breadcrumb: "queue-job" },
	component: QueueJobDetail,
	validateSearch: jobsSearchSchema,
});
