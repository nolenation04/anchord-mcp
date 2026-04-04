import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("SDK transport validation", () => {
  it("StreamableHTTPServerTransport is importable and accepts stateless config", async () => {
    const { StreamableHTTPServerTransport } = await import(
      "@modelcontextprotocol/sdk/server/streamableHttp.js"
    );
    assert.ok(StreamableHTTPServerTransport, "StreamableHTTPServerTransport should be exported");

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    assert.ok(transport, "should create transport instance");
    assert.ok(
      typeof transport.handleRequest === "function",
      "transport should have handleRequest method",
    );
    await transport.close();
  });
});
