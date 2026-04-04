import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { redactKey, logRequest } from "../logging.js";

describe("redactKey", () => {
  it("redacts middle of long keys, showing first 4 and last 4", () => {
    assert.equal(redactKey("anch_key_abc123xyz789"), "anch***z789");
  });

  it("fully redacts keys of 8 characters or fewer", () => {
    assert.equal(redactKey("short"), "***");
    assert.equal(redactKey("12345678"), "***");
  });

  it("shows partial for 9-character key", () => {
    assert.equal(redactKey("123456789"), "1234***6789");
  });

  it("handles empty string", () => {
    assert.equal(redactKey(""), "***");
  });
});

describe("logRequest", () => {
  let originalConsoleLog: typeof console.log;
  let captured: string[];

  beforeEach(() => {
    originalConsoleLog = console.log;
    captured = [];
    console.log = mock.fn((...args: unknown[]) => {
      captured.push(String(args[0]));
    }) as typeof console.log;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it("outputs valid JSON with ts field", () => {
    logRequest({ tool: "resolve_company", request_id: "req_123" });

    assert.equal(captured.length, 1);
    const parsed = JSON.parse(captured[0]);
    assert.ok(parsed.ts, "should have ts field");
    assert.equal(parsed.tool, "resolve_company");
    assert.equal(parsed.request_id, "req_123");
  });

  it("includes all provided fields", () => {
    logRequest({
      tool: "guard_write",
      request_id: "req_456",
      status: 200,
      latency_ms: 42,
    });

    const parsed = JSON.parse(captured[0]);
    assert.equal(parsed.status, 200);
    assert.equal(parsed.latency_ms, 42);
  });

  it("omits undefined fields", () => {
    logRequest({ tool: "get_entity" });

    const parsed = JSON.parse(captured[0]);
    assert.equal(parsed.tool, "get_entity");
    assert.ok(!("request_id" in parsed));
    assert.ok(!("status" in parsed));
  });
});
