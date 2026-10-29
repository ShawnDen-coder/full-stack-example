import { createFileRoute } from "@tanstack/react-router";
import { QueueJobsScreen } from "@/features/queues/jobs-screen";
import { jobsSearchSchema } from "@/features/queues/search";

export const Route = createFileRoute("/_auth/queues/$queueKey/jobs/")({
	staticData: { layout: "fixed" },
	validateSearch: jobsSearchSchema,
	component: QueueJobsScreen,
});
