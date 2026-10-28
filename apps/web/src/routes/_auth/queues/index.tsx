import { createFileRoute } from "@tanstack/react-router";
import { QueuesOverview } from "@/features/queues/overview";

export const Route = createFileRoute("/_auth/queues/")({
	component: QueuesOverview,
});
