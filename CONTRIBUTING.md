# Contributing to @anchord/mcp-server

Thank you for your interest in contributing to the Anchord MCP server.

## What lives here vs. in the Anchord API

This MCP server is a **thin proxy** over the hosted Anchord API. All business
logic — identity resolution, scoring, guard evaluation, tenant isolation —
lives in the Anchord API, not in this package.

Contributions to this repo are welcome for:

- **Documentation** improvements and corrections
- **Example configs** for additional MCP clients
- **Bug fixes** in the MCP transport/schema layer
- **New tool wrappers** for Anchord API endpoints not yet exposed

For changes to identity resolution logic, matching algorithms, or API behavior,
please contact us at support@anchord.ai.

## Development setup

See [docs/development.md](docs/development.md) for build, test, and local
development instructions.

## Submitting changes

1. Fork the repository
2. Create a feature branch (`git checkout -b my-change`)
3. Make your changes
4. Run `npm test` and `npm run typecheck` to verify
5. Submit a pull request with a clear description

## Code style

- TypeScript strict mode
- No business logic in this package — tools are thin schema + forward
- Use Zod for input validation
- Follow existing naming conventions (tool names match API endpoints)

## Reporting issues

Open an issue on GitHub. Include:

- MCP client name and version (Cursor, Claude Desktop, etc.)
- Node.js version
- Error message and `request_id` if available
- Steps to reproduce

## Security

If you discover a security vulnerability, please email security@anchord.ai
instead of opening a public issue.
