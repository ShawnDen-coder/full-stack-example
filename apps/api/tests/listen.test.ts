import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { waitForListening } from "../src/runtime/listen.js";

describe("waitForListening", () => {
  let occupiedServer: ReturnType<typeof createServer> | undefined;

  afterEach(async () => {
    if (occupiedServer?.listening)
      await new Promise<void>((resolve, reject) =>
        occupiedServer?.close((error) => (error ? reject(error) : resolve())),
      );
    occupiedServer = undefined;
  });

  it("resolves only after the server starts listening", async () => {
    const server = createServer();
    server.listen(0, "127.0.0.1");
    await expect(waitForListening(server)).resolves.toBeUndefined();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("rejects when the requested port is already occupied", async () => {
    occupiedServer = createServer();
    occupiedServer.listen(0, "127.0.0.1");
    await waitForListening(occupiedServer);
    const address = occupiedServer.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP address");

    const server = createServer();
    server.listen(address.port, "127.0.0.1");
    await expect(waitForListening(server)).rejects.toMatchObject({ code: "EADDRINUSE" });
  });
});
