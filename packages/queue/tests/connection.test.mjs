import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import { RedisConnection } from "bullmq";

function fixture() {
	const checkingVersion = Promise.withResolvers();
	const version = Promise.withResolvers();
	const failure = new Error("Connection closed during Redis version check");
	// The public driver factory lets us hold initialization open without Redis.
	const client = Object.assign(new EventEmitter(), {
		status: "ready",
		defineCommand() {},
		info() {
			checkingVersion.resolve();
			return version.promise;
		},
		disconnect() {
			client.status = "end";
			version.reject(failure);
			client.emit("end");
		},
	});
	const originalFactory = RedisConnection.clientFactory;
	let connection;
	try {
		RedisConnection.clientFactory = () => client;
		connection = new RedisConnection({}, { blocking: false });
	} finally {
		RedisConnection.clientFactory = originalFactory;
	}
	const errors = [];
	connection.on("error", (error) => errors.push(error));
	return { connection, checkingVersion, version, failure, errors };
}

test("closing during initialization settles errors before removing listeners", async () => {
	const { connection, checkingVersion, failure, errors } = fixture();
	await checkingVersion.promise;
	await connection.close();
	assert.deepEqual(errors, [failure]);
	assert.equal(connection.status, "closed");
	assert.equal(connection.listenerCount("error"), 0);
	await assert.rejects(connection.client, (error) => error === failure);
});

test("initialization failures still reach live connection error listeners", async () => {
	const { connection, checkingVersion, version, failure, errors } = fixture();
	try {
		await checkingVersion.promise;
		const rejected = assert.rejects(
			connection.client,
			(error) => error === failure,
		);
		version.reject(failure);
		await rejected;
		assert.deepEqual(errors, [failure]);
	} finally {
		await connection.close();
	}
});
