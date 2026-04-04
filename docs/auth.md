# Authentication

The Anchord MCP server authenticates with the hosted Anchord API using a
Bearer token. All requests are tenant-scoped — your API key determines which
tenant's data you access.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANCHORD_API_KEY` | Yes | — | Your Anchord API key (Bearer token) |
| `ANCHORD_API_BASE_URL` | No | `https://api.anchord.ai` | Anchord API base URL |

## Getting an API key

1. Sign up at [app.anchord.ai/signup](https://app.anchord.ai/signup)
2. Navigate to **Settings > API Keys**
3. Create a new API key — the plaintext value is shown once

Keep your API key secret. It grants full read access to your tenant's data.

## How authentication works

The MCP server includes your API key as a `Bearer` token in the
`Authorization` header on every request to the Anchord API. The API
validates the key via HMAC-SHA256 hash comparison and resolves the
associated tenant.

```
MCP Client  →  MCP Server  →  Anchord API
                (Bearer)       (HMAC verify → tenant context)
```

## Tenant isolation

Every API response is scoped to the tenant associated with your API key.
You cannot access other tenants' data. Tenant isolation is enforced
server-side — the MCP server does not perform any tenant logic.

## Request tracing

Every request includes a client-generated `X-Request-Id` header (UUID v4).
The Anchord API returns a `request_id` in every response. Both values
appear in error messages for debugging.

API keys are never included in error messages, logs, or MCP tool responses.

## Rate limits

- **API rate limit**: 120 requests/minute per tenant (configurable)
- **Batch limits**: 200 items for resolve/guard batch, 100 records for ingest batch
- **Plan quotas**: Monthly and daily caps based on your plan (Free, Starter, Pro, Enterprise)

When rate limited, the API returns HTTP 429. The MCP tool response will
include the `request_id` for troubleshooting.

## Hosted remote auth

When using the hosted remote MCP server (`https://mcp.anchord.ai/mcp`),
pass your API key as a Bearer token in the HTTP `Authorization` header
instead of an environment variable:

```http
Authorization: Bearer <YOUR_ANCHORD_API_KEY>
```

The hosted server is stateless — each request brings its own auth. No
API keys are stored on the server. See [remote.md](remote.md) for full
connection details.

## Environments

| Environment | API URL | MCP URL | App URL |
|-------------|---------|---------|---------|
| Production | `https://api.anchord.ai` | `https://mcp.anchord.ai/mcp` | `https://app.anchord.ai` |
| Staging | `https://staging.api.anchord.ai` | `https://mcp.staging.anchord.ai/mcp` | `https://staging.app.anchord.ai` |

Staging data may be reset at any time. Use production for real workloads.
