import assert from "node:assert/strict";
import { test } from "node:test";
import { createLogger } from "../src/index";

test("structured logs redact credentials and retain request correlation and stack", () => {
	const lines: string[] = [];
	const logger = createLogger("redaction-test", {
		write: (line) => {
			lines.push(line);
		},
	});
	logger.error(
		{
			err: new Error("connection postgres://user:secret-value@host/db failed"),
			requestId: "request-1",
			headers: {
				cookie: "private-cookie",
				authorization: "Bearer private-token",
			},
			password: "private-password",
		},
		"Request failed",
	);
	const output = lines.join("");
	for (const value of [
		"secret-value",
		"private-cookie",
		"private-token",
		"private-password",
	])
		assert.ok(!output.includes(value));
	const entry = JSON.parse(output);
	assert.equal(entry.requestId, "request-1");
	assert.ok(entry.err.stack);
});
