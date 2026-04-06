/**
 * Anchord MCP Remote Server
 *
 * Stateless HTTP entrypoint for hosted MCP. Each request:
 *   1. Extracts Bearer token from the Authorization header
 *   2. Creates a fresh ApiClient + McpServer scoped to that token
 *   3. Delegates to StreamableHTTPServerTransport (stateless, no sessions)
 *   4. Cleans up after the response is sent
 *
 * Designed for AWS Lambda via Lambda Web Adapter but runs as a
 * standard Node.js HTTP server anywhere.
 */
import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ApiClient } from "./api-client.js";
import { registerTools } from "./tools.js";
import { extractBearerToken } from "./auth.js";
import { logRequest } from "./logging.js";
import { VERSION } from "./version.js";

const MAX_BODY_SIZE = 1_048_576; // 1 MB

const API_BASE_URL = process.env.ANCHORD_API_BASE_URL ?? "https://api.anchord.ai";

function sendJson(res: http.ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_SIZE) {
      throw Object.assign(new Error("Request body too large"), { code: "BODY_TOO_LARGE" });
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export function createServer(): http.Server {
  return http.createServer(async (req, res) => {
    const start = Date.now();

    // Health check — no auth required
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    // Only serve MCP at /mcp
    if (req.url !== "/mcp" && req.url !== "/mcp/") {
      sendJson(res, 404, { error: { code: "NOT_FOUND", message: "Not found" } });
      return;
    }

    // ── Auth ──────────────────────────────────────────────────────────
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      sendJson(res, 401, {
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or invalid Authorization: Bearer <token> header",
        },
      });
      return;
    }

    // DELETE — session cleanup (stateless mode, just acknowledge)
    if (req.method === "DELETE") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    // GET — SSE stream not supported in stateless mode
    if (req.method === "GET") {
      sendJson(res, 405, {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "SSE not supported in stateless mode. Use POST.",
        },
      });
      return;
    }

    // Only POST beyond this point
    if (req.method !== "POST") {
      sendJson(res, 405, {
        error: { code: "METHOD_NOT_ALLOWED", message: `Method ${req.method} not allowed` },
      });
      return;
    }

    // ── Request validation ────────────────────────────────────────────
    const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim();
    if (contentType !== "application/json") {
      sendJson(res, 415, {
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Content-Type must be application/json",
        },
      });
      return;
    }

    let body: unknown;
    try {
      const raw = await readBody(req);
      body = JSON.parse(raw.toString("utf-8"));
    } catch (err: unknown) {
      const code = (err as { code?: string }).code === "BODY_TOO_LARGE"
        ? "BODY_TOO_LARGE" : "INVALID_JSON";
      const status = code === "BODY_TOO_LARGE" ? 413 : 400;
      sendJson(res, status, {
        error: {
          code,
          message: code === "BODY_TOO_LARGE"
            ? "Request body exceeds 1 MB limit"
            : "Invalid JSON in request body",
        },
      });
      return;
    }

    // ── Per-request MCP server ────────────────────────────────────────
    let mcpServer: McpServer | undefined;
    let transport: StreamableHTTPServerTransport | undefined;
    try {
      const apiClient = new ApiClient({ apiKey: token, baseUrl: API_BASE_URL });
      mcpServer = new McpServer({ name: "anchord", version: VERSION });
      registerTools(mcpServer, apiClient);

      transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, body);

      logRequest({ tool: "mcp_request", latency_ms: Date.now() - start, status: 200 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logRequest({
        tool: "mcp_request",
        latency_ms: Date.now() - start,
        error_code: "INTERNAL_ERROR",
        message,
      });
      if (!res.headersSent) {
        sendJson(res, 500, {
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        });
      }
    } finally {
      try { await transport?.close(); } catch { /* cleanup best-effort */ }
      try { await mcpServer?.close(); } catch { /* cleanup best-effort */ }
    }
  });
}

// Auto-start when run directly (not when imported by tests)
const argv1 = process.argv[1]?.replace(/\\/g, "/") ?? "";
if (argv1.endsWith("/remote.js") || argv1.endsWith("/remote.ts")) {
  const PORT = parseInt(process.env.PORT ?? "8080", 10);
  const server = createServer();
  server.listen(PORT, () => {
    logRequest({ message: `Anchord MCP remote server listening on port ${PORT}` });
  });
}
