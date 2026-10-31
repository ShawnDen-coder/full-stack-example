import type { createProfileReadClient } from "@full-stack-example/domain/users/jobs/profile-read/producer";
import {
	createQueueMonitor,
	type QueueReadAdapter,
} from "@full-stack-example/runtime/queue-monitor";

declare const queue: ReturnType<
	ReturnType<typeof createProfileReadClient>["getQueueForMonitoring"]
>;
declare const adapter: QueueReadAdapter;
const common = {
	key: "profile",
	name: "Profile",
	summarizeData: () => ({}),
	summarizeResult: () => ({}),
};
function typecheckRegistrations() {
	createQueueMonitor([{ ...common, queue }]);
	createQueueMonitor([{ ...common, adapter }]);
	createQueueMonitor([
		// @ts-expect-error A log-only object is not a native Queue.
		{ ...common, queue: { getJobLogs: adapter.getJobLogs } },
	]);
	// @ts-expect-error Registration must choose exactly one source.
	createQueueMonitor([{ ...common, queue, adapter }]);
}

void typecheckRegistrations;
