import type { Auth, Session } from "@my-better-t-app/auth";
import type { Database } from "@my-better-t-app/db";
import type { Logger } from "@my-better-t-app/logger";
import type { QueueClient } from "@my-better-t-app/queue";

import type { TodosService } from "@my-better-t-app/todos";
import type { UsersService } from "@my-better-t-app/users";

export type Services = {
	usersService: UsersService;
	todosService: TodosService;
	queueClient: Pick<QueueClient, "enqueueUserProfile" | "getUserProfileJob">;
};

export type Context = {
	session: Session | null;
	requestId: string;
	db: Database;
	services: Services;
	logger: Logger;
};

export type ContextDependencies = {
	auth: Pick<Auth, "handler">;
	getSession: (headers: Headers) => Promise<Session | null>;
	db: Database;
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
		db: deps.db,
		services: deps.services,
		requestId,
		logger: deps.logger.child({ requestId }),
	};
}
