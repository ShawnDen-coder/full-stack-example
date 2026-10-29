import assert from "node:assert/strict";
import { type TestContext, test } from "node:test";
import { createDb } from "@full-stack-example/db";
import { createTodosRepository } from "../src/todos/repository";
import { createTodosService } from "../src/todos/service";

type Query = { text: string; values: unknown[] };

function fixture(t: TestContext, rows: unknown[][] = []) {
	// Exercise Drizzle's actual SQL compilation without connecting to PostgreSQL.
	const db = createDb({ DATABASE_URL: "postgresql://localhost/unused" });
	t.after(() => db.close());
	const queries: Query[] = [];
	t.mock.method(
		db.$client,
		"query",
		async (config: { text: string }, values: unknown[]) => {
			queries.push({ text: config.text, values });
			return { rows, rowCount: rows.length };
		},
	);
	return {
		repository: createTodosRepository({ db }),
		service: createTodosService({ db }),
		queries,
	};
}

function assertFilter(query: Query, column: string, value: unknown) {
	const parameter = query.text.match(new RegExp(`"${column}" = \\$(\\d+)`));
	assert.ok(parameter, `Missing ${column} filter`);
	assert.equal(query.values[Number(parameter[1]) - 1], value);
}

test("interleaved Todo scopes keep their own owner on reads and mutations", async (t) => {
	const { repository, queries } = fixture(t);
	const alice = repository.forUser("alice");
	const bob = repository.forUser("bob");
	assert.deepEqual(await alice.list({ cursor: 50, limit: 2 }), []);
	assert.deepEqual(await bob.list({ limit: 3 }), []);
	assert.equal(await alice.setCompleted({ id: 20, completed: true }), null);
	assert.equal(await bob.delete(20), null);
	await alice.list({ limit: 1 });

	assert.equal(queries.length, 5);
	for (const [index, query] of queries.entries()) {
		assert.match(query.text, /where/);
		assertFilter(
			query,
			"user_id",
			index === 1 || index === 3 ? "bob" : "alice",
		);
	}
	const [page, , updated, deleted] = queries;
	assert.ok(page && updated && deleted);
	assert.match(page.text, /"id" < \$\d+/);
	assert.ok(page.values.includes(50));
	assertFilter(updated, "id", 20);
	assertFilter(deleted, "id", 20);
});

test("Todo creation fixes the owner and projects only public fields", async (t) => {
	const { repository, queries } = fixture(t, [[7, "private", false]]);
	const untrusted = {
		text: "private",
		userId: "bob",
		completed: true,
		id: 999,
	};
	assert.deepEqual(await repository.forUser("alice").create(untrusted), {
		id: 7,
		text: "private",
		completed: false,
	});
	assert.equal(queries.length, 1);
	const [query] = queries;
	assert.ok(query);
	assert.deepEqual(query.values, ["alice", "private"]);
	assert.match(query.text, /returning "id", "text", "completed"$/);
});

test("Todo insertion failures reject instead of returning an empty success", async (t) => {
	const { repository } = fixture(t);
	await assert.rejects(
		() => repository.forUser("alice").create({ text: "todo" }),
		{
			message: "Todo insert returned no row",
		},
	);
});

test("rename scopes cannot change another owner's task and return null for missing rows", async (t) => {
	const { repository, queries } = fixture(t);
	const alice = repository.forUser("alice");
	const bob = repository.forUser("bob");
	assert.equal(await alice.rename({ id: 7, text: "Alice edit" }), null);
	assert.equal(await bob.rename({ id: 7, text: "Bob edit" }), null);
	for (const [index, query] of queries.entries()) {
		assertFilter(query, "id", 7);
		assertFilter(query, "user_id", index === 0 ? "alice" : "bob");
		assert.match(query.text, /returning "id", "text", "completed"$/);
	}
});

test("rename normalizes text and rejects invalid service input before executing SQL", async (t) => {
	const { service, queries } = fixture(t, [[7, "Updated task", true]]);
	assert.deepEqual(
		await service.rename({ userId: "alice", id: 7, text: "  Updated task  " }),
		{ id: 7, text: "Updated task", completed: true },
	);
	assert.ok(queries[0]?.values.includes("Updated task"));
	for (const text of ["", " \t\n ", "x".repeat(501)]) {
		await assert.rejects(
			() => service.rename({ userId: "alice", id: 7, text }),
			/1–500/,
		);
	}
	assert.equal(queries.length, 1);
	await service.rename({ userId: "alice", id: 7, text: "x".repeat(500) });
	assert.equal(queries.length, 2);
});

test("create normalizes text and rejects invalid service input before executing SQL", async (t) => {
	const { service, queries } = fixture(t, [[7, "New task", false]]);
	assert.deepEqual(
		await service.create({ userId: "alice", text: "  New task  " }),
		{
			id: 7,
			text: "New task",
			completed: false,
		},
	);
	assert.deepEqual(queries[0]?.values, ["alice", "New task"]);
	for (const text of ["", " \t\n ", "x".repeat(501)]) {
		await assert.rejects(
			() => service.create({ userId: "alice", text }),
			/1–500/,
		);
	}
	assert.equal(queries.length, 1);
	await service.create({ userId: "alice", text: ` ${"x".repeat(500)} ` });
	assert.equal(queries.length, 2);
	assert.equal(queries[1]?.values[1], "x".repeat(500));
});
