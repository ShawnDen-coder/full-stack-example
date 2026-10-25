import type { Auth, Session } from "@my-better-t-app/api/auth";
import type { TodosService } from "@my-better-t-app/business/todos";
import type { UsersService } from "@my-better-t-app/business/users";
import type { ProfileReadClient } from "@my-better-t-app/business/users/jobs/profile-read/producer";
import type { Logger } from "@my-better-t-app/observability";

export type Services = {
	usersService: UsersService;
	todosService: TodosService;
	profileJobs: Pick<
		ProfileReadClient,
		"enqueueProfileRead" | "getProfileReadJob"
	>;
};

export type Context = {
	session: Session | null;
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
		services: deps.services,
		requestId,
		logger: deps.logger.child({ request_id: requestId }),
	};
}
