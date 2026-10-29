import type { Database } from "@full-stack-example/db";
import { observeOperation } from "@full-stack-example/observability";
import { createTodosRepository } from "./repository";

function normalizeText(text: string) {
	const normalized = text.trim();
	if (!normalized || normalized.length > 500)
		throw new Error("Todo text must contain 1–500 characters");
	return normalized;
}

export function createTodosService({ db }: { db: Database }) {
	const repository = createTodosRepository({ db });
	return {
		async list({
			userId,
			workspaceId,
			cursor,
			limit,
		}: {
			userId: string;
			workspaceId: string;
			cursor?: number;
			limit: number;
		}) {
			const rows = await observeOperation("todos.list", async () =>
				repository
					.forUser(userId, workspaceId)
					.list({ cursor, limit: limit + 1 }),
			);
			const items = rows.slice(0, limit);
			return {
				items,
				nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
			};
		},
		async create({
			userId,
			workspaceId,
			text,
		}: {
			userId: string;
			workspaceId: string;
			text: string;
		}) {
			const normalized = normalizeText(text);
			return observeOperation("todos.create", async () =>
				repository.forUser(userId, workspaceId).create({ text: normalized }),
			);
		},
		async setCompleted({
			userId,
			workspaceId,
			id,
			completed,
		}: {
			userId: string;
			workspaceId: string;
			id: number;
			completed: boolean;
		}) {
			return observeOperation("todos.setCompleted", async () =>
				repository.forUser(userId, workspaceId).setCompleted({ id, completed }),
			);
		},
		async rename({
			userId,
			workspaceId,
			id,
			text,
		}: {
			userId: string;
			workspaceId: string;
			id: number;
			text: string;
		}) {
			const normalized = normalizeText(text);
			return observeOperation("todos.rename", async () =>
				repository
					.forUser(userId, workspaceId)
					.rename({ id, text: normalized }),
			);
		},
		async delete({
			userId,
			workspaceId,
			id,
		}: {
			userId: string;
			workspaceId: string;
			id: number;
		}) {
			return observeOperation("todos.delete", async () =>
				repository.forUser(userId, workspaceId).delete(id),
			);
		},
	};
}

export type TodosService = ReturnType<typeof createTodosService>;
