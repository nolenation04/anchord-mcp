# Remote (Hosted) MCP Server

Anchord provides a hosted remote MCP endpoint — no local installation,
no Docker, no Node.js required. Connect any MCP client directly over HTTPS.

## Endpoints

| Environment | URL                                       |
|-------------|-------------------------------------------|
| Production  | `https://mcp.anchord.ai/mcp`              |
| Staging     | `https://mcp.staging.anchord.ai/mcp`      |

## Authentication

Pass your Anchord API key as a Bearer token in the `Authorization` header.
Each request is scoped to the tenant associated with the key.

```http
Authorization: Bearer anchord_key_abc123...
```

> Replace `anchord_key_abc123...` with the API key from
> **Settings > API Keys** at [app.anchord.ai](https://app.anchord.ai).

No OAuth flow, no stored credentials on the server. Each request brings its
own auth — the hosted MCP server is fully stateless.

## Client configuration

### Cursor (remote)

Add to `.cursor/mcp.json` (workspace) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "anchord": {
      "url": "https://mcp.anchord.ai/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_ANCHORD_API_KEY>"
      }
    }
  }
}
```

### Claude Desktop (remote)

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "anchord": {
      "url": "https://mcp.anchord.ai/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_ANCHORD_API_KEY>"
      }
    }
  }
}
```

> Remote MCP support varies by client and version. If your client does not
> yet support the `url` + `headers` format, use the
> [local stdio setup](../README.md#cursor-local-stdio) instead.

### Any MCP client

Send a POST request with a JSON-RPC body:

```bash
curl -X POST https://mcp.anchord.ai/mcp \
  -H "Authorization: Bearer <YOUR_ANCHORD_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

## Health check

The `/health` endpoint requires no authentication:

```bash
curl https://mcp.anchord.ai/health
# {"status":"ok"}
```

## Hosted vs local

| Aspect             | Hosted remote                  | Local (npx / Docker)          |
|--------------------|--------------------------------|-------------------------------|
| Install required   | None                           | Node.js >= 20                 |
| Auth method        | `Authorization: Bearer` header | `ANCHORD_API_KEY` env var     |
| Transport          | Streamable HTTP (POST)         | stdio                         |
| Session state      | Stateless (per-request)        | Persistent process            |
| Best for           | Zero-install agents, registries| Local dev, CI/CD pipelines    |

Both modes connect to the same Anchord API and expose the same 11 MCP tools.

## Architecture

```
MCP Client
    │  HTTPS POST + Bearer token
    ▼
┌──────────────────────────────┐
│  mcp.anchord.ai (CloudFront) │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Lambda (stateless)          │  Per-request MCP server
│  Extracts Bearer → ApiClient │  No stored secrets
└──────────┬───────────────────┘
           │  HTTPS + Bearer auth
           ▼
┌──────────────────────────────┐
│  api.anchord.ai              │  Hosted Anchord API
│  Scoring, matching, tenant   │
│  isolation, persistence      │
└──────────────────────────────┘
```

## Request limits

- **Body size**: 1 MB max per request
- **Content-Type**: must be `application/json`
- **Timeout**: 30 seconds per request
- API rate limits still apply (120 req/min per tenant)

## Error responses

All errors return structured JSON:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid Authorization: Bearer <token> header"
  }
}
```

| Status | Code                     | Meaning                              |
|--------|--------------------------|--------------------------------------|
| 401    | `UNAUTHORIZED`           | Missing or invalid Bearer token      |
| 405    | `METHOD_NOT_ALLOWED`     | Wrong HTTP method                    |
| 413    | `BODY_TOO_LARGE`         | Request body exceeds 1 MB            |
| 415    | `UNSUPPORTED_MEDIA_TYPE` | Content-Type not `application/json`  |
| 400    | `INVALID_JSON`           | Malformed JSON body                  |
| 500    | `INTERNAL_ERROR`         | Server error (request_id in logs)    |
