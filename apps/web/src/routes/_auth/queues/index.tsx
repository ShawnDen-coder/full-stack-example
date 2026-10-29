import { createFileRoute } from "@tanstack/react-router";
import { QueuesOverview } from "@/features/queues/overview";

export const Route = createFileRoute("/_auth/queues/")({
	staticData: { layout: "fixed", breadcrumb: "queues" },
	component: QueuesOverview,
});
