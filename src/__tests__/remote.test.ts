import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createServer } from "../remote.js";

async function request(
  server: http.Server,
  opts: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  const addr = server.address() as { port: number };
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: addr.port,
        path: opts.path,
        method: opts.method,
        headers: opts.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode!,
            body: Buffer.concat(chunks).toString(),
            headers: res.headers,
          }),
        );
      },
    );
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

describe("remote server", () => {
  let server: http.Server;

  afterEach(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("GET /health returns 200", async () => {
    server = createServer();
    await new Promise<void>((r) => server.listen(0, r));

    const res = await request(server, { method: "GET", path: "/health" });
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.body).status, "ok");
  });

  it("returns 404 for unknown paths", async () => {
    server = createServer();
    await new Promise<void>((r) => server.listen(0, r));

    const res = await request(server, { method: "GET", path: "/unknown" });
    assert.equal(res.status, 404);
    assert.equal(JSON.parse(res.body).error.code, "NOT_FOUND");
  });

  it("returns 401 without Authorization header", async () => {
    server = createServer();
    await new Promise<void>((r) => server.listen(0, r));

    const res = await request(server, {
      method: "POST",
      path: "/mcp",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 401);
    assert.equal(JSON.parse(res.body).error.code, "UNAUTHORIZED");
  });

  it("returns 401 with non-Bearer auth scheme", async () => {
    server = createServer();
    await new Promise<void>((r) => server.listen(0, r));

    const res = await request(server, {
      method: "POST",
      path: "/mcp",
      headers: { authorization: "Basic abc123", "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 401);
  });

  it("returns 415 without application/json content-type", async () => {
    server = createServer();
    await new Promise<void>((r) => server.listen(0, r));

    const res = await request(server, {
      method: "POST",
      path: "/mcp",
      headers: { authorization: "Bearer test-key", "content-type": "text/plain" },
      body: "hello",
    });
    assert.equal(res.status, 415);
    assert.equal(JSON.parse(res.body).error.code, "UNSUPPORTED_MEDIA_TYPE");
  });

  it("returns 400 on invalid JSON body", async () => {
    server = createServer();
    await new Promise<void>((r) => server.listen(0, r));

    const res = await request(server, {
      method: "POST",
      path: "/mcp",
      headers: { authorization: "Bearer test-key", "content-type": "application/json" },
      body: "not-json",
    });
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(res.body).error.code, "INVALID_JSON");
  });

  it("returns 405 for PUT method", async () => {
    server = createServer();
    await new Promise<void>((r) => server.listen(0, r));

    const res = await request(server, {
      method: "PUT",
      path: "/mcp",
      headers: { authorization: "Bearer test-key" },
    });
    assert.equal(res.status, 405);
    assert.equal(JSON.parse(res.body).error.code, "METHOD_NOT_ALLOWED");
  });

  it("returns 405 for GET /mcp (SSE not supported)", async () => {
    server = createServer();
    await new Promise<void>((r) => server.listen(0, r));

    const res = await request(server, {
      method: "GET",
      path: "/mcp",
      headers: { authorization: "Bearer test-key" },
    });
    assert.equal(res.status, 405);
  });

  it("acknowledges DELETE /mcp for session cleanup", async () => {
    server = createServer();
    await new Promise<void>((r) => server.listen(0, r));

    const res = await request(server, {
      method: "DELETE",
      path: "/mcp",
      headers: { authorization: "Bearer test-key" },
    });
    assert.equal(res.status, 200);
  });
});
