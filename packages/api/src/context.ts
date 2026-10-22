import type { Auth, Session } from "@my-better-t-app/auth";
import type { Database } from "@my-better-t-app/db";
import type { QueueClient } from "@my-better-t-app/queue";
import type { UsersService } from "@my-better-t-app/users";

export type Services = {
	usersService: UsersService;
	queueClient: Pick<QueueClient, "enqueueUserProfile" | "getUserProfileJob">;
};

export type Context = {
	session: Session | null;
	db: Database;
	services: Services;
};

export type ContextDependencies = {
	auth: Pick<Auth, "handler">;
	getSession: (headers: Headers) => Promise<Session | null>;
	db: Database;
	services: Services;
};

export async function createContext(
	headers: Headers,
	deps: ContextDependencies,
): Promise<Context> {
	return {
		session: await deps.getSession(headers),
		db: deps.db,
		services: deps.services,
	};
}
