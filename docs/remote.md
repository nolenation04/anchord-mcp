# Remote (Hosted) MCP Server

Anchord provides a hosted remote MCP endpoint — no local installation,
no Docker, no Node.js required. Connect any MCP client directly over HTTPS.

## Endpoint

| Environment | URL |
|-------------|-----|
| Production  | `https://mcp.anchord.ai/mcp` |
| Staging     | `https://mcp.staging.anchord.ai/mcp` |

## Authentication

Pass your Anchord API key as a Bearer token in the `Authorization` header.
Each request is scoped to the tenant associated with the key.

```
Authorization: Bearer <your-api-key>
```

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
        "Authorization": "Bearer your-api-key"
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
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

### Any MCP client

Send a POST request with a JSON-RPC body:

```bash
curl -X POST https://mcp.anchord.ai/mcp \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

## Health check

The `/health` endpoint requires no authentication:

```bash
curl https://mcp.anchord.ai/health
# {"status":"ok"}
```

## Hosted vs local (stdio)

| | Hosted remote | Local (npx / Docker) |
|--|--------------|---------------------|
| Install required | No | Node.js >= 20 |
| Auth method | `Authorization: Bearer` header | `ANCHORD_API_KEY` env var |
| Transport | Streamable HTTP (POST) | stdio |
| Session state | Stateless (per-request) | Persistent process |
| Best for | Zero-install agents, registries | Local dev, CI/CD pipelines |

Both modes connect to the same Anchord API and expose the same 11 MCP tools.

## Architecture

```
MCP Client  →  HTTPS  →  mcp.anchord.ai (CloudFront)  →  Lambda  →  api.anchord.ai
                          (Bearer token forwarded)
```

The hosted server is a stateless AWS Lambda function behind CloudFront.
Each request constructs a fresh MCP server scoped to the caller's API key.
No tenant secrets are stored on the server.

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

| Status | Code | Meaning |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | Missing or invalid Bearer token |
| 405 | `METHOD_NOT_ALLOWED` | Wrong HTTP method |
| 413 | `BODY_TOO_LARGE` | Request body exceeds 1 MB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Content-Type not application/json |
| 400 | `INVALID_JSON` | Malformed JSON body |
| 500 | `INTERNAL_ERROR` | Server error (includes request_id in logs) |
