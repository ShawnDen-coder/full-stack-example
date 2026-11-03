import assert from "node:assert/strict";
import { test } from "node:test";
import { createQueueConnection } from "../src/index.ts";

test("Redis connection supports TLS, database selection and rejects invalid protocols", () => {
	const connection = createQueueConnection("rediss://localhost:6380/2");
	assert.ok("host" in connection);
	if ("host" in connection) {
		assert.equal(connection.port, 6380);
		assert.equal(connection.db, 2);
		assert.equal(connection.commandTimeout, 2000);
		const worker = createQueueConnection("redis://localhost", "worker");
		assert.equal(worker.maxRetriesPerRequest, null);
		assert.equal(worker.commandTimeout, undefined);
		assert.deepEqual(connection.tls, {});
	}
	assert.throws(() => createQueueConnection("https://localhost"));
	assert.throws(() =>
		createQueueConnection("redis://localhost/not-a-database"),
	);
});
