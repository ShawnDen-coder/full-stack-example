import { createFileRoute } from "@tanstack/react-router";
import { QueueSchedulersScreen } from "@/features/queues/schedulers-screen";

export const Route = createFileRoute("/_auth/queues/$queueKey/schedulers")({
	staticData: { layout: "fixed", breadcrumb: "queue-schedulers" },
	component: QueueSchedulersScreen,
});
