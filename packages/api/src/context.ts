import type { TodosService } from "@full-stack-example/domain/todos";
import type { UsersService } from "@full-stack-example/domain/users";
import type { ProfileReadClient } from "@full-stack-example/domain/users/jobs/profile-read/producer";
import type { AccessService } from "@full-stack-example/identity/access";
import type { Auth, Session } from "@full-stack-example/identity/auth";
import type { QueueMonitor } from "@full-stack-example/runtime/queue-monitor";
import type { Logger } from "pino";

export type Services = {
	accessService: AccessService;
	usersService: UsersService;
	todosService: TodosService;
	profileJobs: Pick<
		ProfileReadClient,
		"enqueueProfileRead" | "getProfileReadJob"
	>;
	queueMonitor: QueueMonitor;
};

export type Context = {
	session: Session | null;
	headers: Headers;
	requestId: string;
	services: Services;
	logger: Logger;
};

export type ContextDependencies = {
	auth: Pick<Auth, "handler">;
	getSession: (headers: Headers) => Promise<Session | null>;
	services: Services;
	logger: Logger;
};

export async function createContext(
	headers: Headers,
	deps: ContextDependencies,
	requestId: string,
): Promise<Context> {
	return {
		session: await deps.getSession(headers),
		headers,
		services: deps.services,
		requestId,
		logger: deps.logger.child({ request_id: requestId }),
	};
}
