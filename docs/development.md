# Development

Guide for building, testing, and contributing to `@anchord/mcp-server`.

## Prerequisites

- **Node.js >= 20** (uses native `fetch`)
- **npm** (comes with Node.js)
- **An Anchord API key** for integration testing (optional for unit tests)

## Install dependencies

```bash
npm install
```

## Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

Output goes to `dist/`.

## Run locally

### Development mode (no build step)

```bash
ANCHORD_API_KEY=your-key npm run dev
```

### Production mode (compiled)

```bash
npm run build
ANCHORD_API_KEY=your-key npm start
```

The server communicates over stdio (stdin/stdout).

## Type checking

```bash
npm run typecheck
```

Runs `tsc --noEmit` to check types without emitting files.

## Tests

```bash
npm test
```

Tests use Node.js built-in test runner with `tsx` for TypeScript support.
External API calls are mocked via `globalThis.fetch` stubs — no API key
or network access needed.

### What the tests cover

- `ApiClient` error handling (structured errors, request_id resolution)
- URL path correctness (colon routes like `/resolve/company:batch`)
- Request header propagation (`Authorization`, `X-Request-Id`)
- API key not leaked in error messages

## Project structure

```
src/
  index.ts         Entry point — creates McpServer, connects stdio transport
  tools.ts         Tool definitions — Zod schemas + handlers
  api-client.ts    HTTP client for the Anchord API
  __tests__/
    api-client.test.ts   Unit tests for ApiClient
```

## Architecture

```
MCP Client (Cursor / Claude Desktop / etc.)
    │  stdio (JSON-RPC)
    ▼
┌──────────────┐
│  MCP Server  │  Node.js + TypeScript
│  (this repo) │  Zod schemas · no business logic
└──────┬───────┘
       │  HTTPS + Bearer auth
       ▼
┌──────────────┐
│  Anchord API │  Hosted SaaS
│              │  All scoring, validation, persistence
└──────────────┘
```

## Adding a new tool

1. Add the tool handler in `src/tools.ts` following the existing pattern
2. Define the Zod schema for input validation
3. Delegate to `api.post()` or `api.get()` on the `ApiClient`
4. Update `docs/tools.md` with the new tool's parameters and behavior
5. Run `npm test` and `npm run typecheck`
