# Anchord MCP Server

**Identity resolution and pre-write safety checks for AI agents.**

[![npm](https://img.shields.io/npm/v/@anchord/mcp-server)](https://www.npmjs.com/package/@anchord/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An [MCP](https://modelcontextprotocol.io) server that gives AI agents access
to the [Anchord](https://www.anchord.ai) identity resolution API. Resolve
companies and people to canonical AnchorIDs, run pre-write safety checks,
and export golden records — through the standard MCP tool interface.

**Hosted API-backed.** This MCP server is a thin proxy to the Anchord SaaS
platform. All scoring, matching, validation, and data persistence happen
server-side. No business logic runs locally.

**Read-only by design.** Anchord never writes to your external systems
(CRMs, databases, etc.). `guard_write` evaluates a proposed write and
returns allowed/blocked — the caller decides whether to proceed.

---

## Quick start

### 1. Get an API key

Sign up at [app.anchord.ai/signup](https://app.anchord.ai/signup) and
create an API key in **Settings > API Keys**.

### 2. Run with npx (no install)

```bash
ANCHORD_API_KEY=your-key npx -y @anchord/mcp-server
```

That's it. The server starts over stdio and is ready for MCP clients.

### 3. Or connect to the hosted remote (zero install)

No local install needed. Point any MCP client at the hosted endpoint:

```json
{
  "mcpServers": {
    "anchord": {
      "url": "https://mcp.anchord.ai/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

See [docs/remote.md](docs/remote.md) for full details.

---

## MCP client setup

### Cursor (local stdio)

Add to `.cursor/mcp.json` (workspace) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "anchord": {
      "command": "npx",
      "args": ["-y", "@anchord/mcp-server"],
      "env": {
        "ANCHORD_API_KEY": "your-api-key",
        "ANCHORD_API_BASE_URL": "https://api.anchord.ai"
      }
    }
  }
}
```

See [examples/cursor-mcp.json](examples/cursor-mcp.json).

### Claude Desktop

Add to your Claude Desktop config
(`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS,
`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "anchord": {
      "command": "npx",
      "args": ["-y", "@anchord/mcp-server"],
      "env": {
        "ANCHORD_API_KEY": "your-api-key",
        "ANCHORD_API_BASE_URL": "https://api.anchord.ai"
      }
    }
  }
}
```

See [examples/claude-desktop-config.json](examples/claude-desktop-config.json).

### Cursor / Claude Desktop (hosted remote)

For zero-install remote access, use the hosted endpoint instead:

```json
{
  "mcpServers": {
    "anchord": {
      "url": "https://mcp.anchord.ai/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

No Node.js, no npx, no Docker required. See [docs/remote.md](docs/remote.md).

### Docker

```bash
docker build -t anchord-mcp .
echo '{"jsonrpc":"2.0","id":1,"method":"initialize",...}' | \
  docker run --rm -i -e ANCHORD_API_KEY=your-key anchord-mcp
```

Or use the compose file for local testing:

```bash
cp examples/env.example .env
# Edit .env with your API key
docker compose up
```

---

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANCHORD_API_KEY` | Yes | — | Your Anchord API key (Bearer token) |
| `ANCHORD_API_BASE_URL` | No | `https://api.anchord.ai` | API base URL |

See [docs/auth.md](docs/auth.md) for details on authentication and tenant
scoping.

---

## Available tools

| Tool | Description |
|------|-------------|
| `resolve_company` | Resolve a company to a canonical AnchorID |
| `resolve_company_batch` | Batch company resolution (max 200) |
| `resolve_person` | Resolve a person to a canonical AnchorID |
| `resolve_person_batch` | Batch person resolution (max 200) |
| `get_entity` | Fetch an AnchorID with optional linked records |
| `get_entity_export` | Export the golden record for an AnchorID |
| `link_source_record` | Link a source record to an AnchorID |
| `unlink_source_record` | Soft-delete a source record link |
| `guard_write` | Pre-write safety check (evaluation-only) |
| `guard_write_batch` | Batch pre-write safety check (max 200) |
| `ingest_record` | Ingest a source record into Anchord |

Full parameter reference: [docs/tools.md](docs/tools.md)

---

## Safe agent workflow

The recommended sequence for agents writing to external systems:

```
1. ingest_record        Push the source record into Anchord
                        (optional if using OAuth integrations)

2. resolve_company      Match to a canonical AnchorID
   or resolve_person    → status: resolved | not_found | needs_review

3. IF needs_review      STOP. Do not write.
                        Surface candidates to the user.
                        Direct them to the Review Queue.

4. guard_write          Evaluate the proposed write
                        → allowed: true | false (with block codes)

5. IF allowed           The agent performs the external write.
                        Anchord never writes.

6. Log request_id       Every response includes a request_id
                        for audit trail and debugging.
```

Use `get_entity` or `get_entity_export` at any point to inspect AnchorID
details or retrieve the merged golden record.

---

## Handling `needs_review`

Only `resolve_*` returns `needs_review`. It means Anchord found multiple
plausible matches and cannot auto-resolve with confidence.

**For agents:**

1. **Do not write.** The data is ambiguous.
2. **Surface the candidates** to the user — the response includes entity IDs
   and match scores.
3. **Direct the user to the Review Queue:**
   `https://app.anchord.ai/app/queues/needs-review`
4. **Retry later.** Once a human resolves the ambiguity, subsequent resolve
   calls return `resolved`.

**Example agent message:**

> I tried to resolve "Acme Corp" but Anchord found multiple possible matches.
> A human needs to review this in the
> [Review Queue](https://app.anchord.ai/app/queues/needs-review).
> I'll retry after it's resolved.

---

## Error handling

When the API returns 4xx/5xx, the MCP tool response is marked `isError: true`
with a structured payload:

```json
{
  "error": "[422] BATCH_TOO_LARGE: Batch size must not exceed 100 records. (request_id: req_01ABC123)",
  "status_code": 422,
  "request_id": "req_01ABC123",
  "details": { "records": ["Too many records."] }
}
```

- `request_id` is always present — from the API response body, `x-request-id`
  header, or a client-generated UUID.
- `details` contains validation errors when available (null for non-JSON errors).
- API keys are never included in error messages.

---

## Architecture

```
MCP Client (Cursor / Claude Desktop / etc.)
    │  stdio (JSON-RPC)
    ▼
┌──────────────┐
│  MCP Server  │  Node.js + TypeScript
│  (this pkg)  │  Zod schemas · no business logic
└──────┬───────┘
       │  HTTPS + Bearer auth
       ▼
┌──────────────┐
│  Anchord API │  Hosted SaaS
│              │  Scoring, matching, persistence,
│              │  tenant isolation
└──────────────┘
```

---

## FAQ

### Is Anchord self-hosted?

No. Anchord is a hosted SaaS platform. This MCP server is a thin client
that calls the Anchord API. You need an API key from
[app.anchord.ai/signup](https://app.anchord.ai/signup).

### Does Anchord write to my CRMs?

No. Anchord is strictly read-only. It reads data from connected systems
(Salesforce, HubSpot, Stripe) to build identity graphs, but never writes
back. `guard_write` returns a decision — the caller performs any actual write.

### What systems does Anchord work with?

Anchord has OAuth integrations for **Salesforce**, **HubSpot**, and
**Stripe**. You can also push records from any system via the `ingest_record`
tool or the REST API.

### What happens when there's ambiguity?

When `resolve_*` returns `needs_review`, it means multiple candidate
AnchorIDs matched with similar confidence. The agent should stop, surface
the candidates to a human, and direct them to the Anchord Review Queue.
Once resolved, subsequent calls return `resolved`.

### What are the rate limits?

120 requests/minute per tenant. Batch endpoints accept up to 200 items
(resolve, guard) or 100 records (ingest). Plan-level monthly and daily
quotas apply. See [docs/auth.md](docs/auth.md).

---

## Links

- [Anchord website](https://www.anchord.ai)
- [Sign up](https://app.anchord.ai/signup)
- [API docs (Swagger)](https://api.anchord.ai/docs)
- [Agent quickstart](https://www.anchord.ai/docs/agent-quickstart)
- [Tool reference](docs/tools.md)
- [Authentication](docs/auth.md)

---

## License

[MIT](LICENSE)
