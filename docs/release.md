# Release & Sync Guide

This document covers how `distribution/anchord-mcp/` in the private
Anchord repo is synced to the public `anchord-mcp` GitHub repo, how
npm releases are cut, and how to submit to MCP directories.

## Architecture

The private repo (`experiment1`) contains:

- `mcp-server/` — canonical TypeScript source (development happens here)
- `distribution/anchord-mcp/` — public-repo-ready distribution surface

`distribution/anchord-mcp/src/` is a directory junction pointing to
`mcp-server/src/`. Edits to the source are reflected immediately. The
distribution folder adds: README, LICENSE, docs, examples, Dockerfile,
registry metadata, and scripts that only exist in the public surface.

## What is safe to expose

| Path | Safe? | Notes |
|------|-------|-------|
| `src/` | Yes | Thin proxy code, no secrets or business logic |
| `docs/` | Yes | Public documentation |
| `examples/` | Yes | Config templates (no real API keys) |
| `scripts/` | Yes | Build/smoke verification |
| `Dockerfile` | Yes | MCP server container only |
| `package.json` | Yes | Public npm metadata |
| `server.json` | Yes | MCP Registry metadata |
| `smithery.yaml` | Yes | Smithery config |

**Never expose:** `context/`, `.cursor/`, `api/`, `infra/`, `docker/`,
`.github/workflows/`, `apps/`, or any file containing real credentials.

## Syncing to the public repo

### Using the sync script

```powershell
.\scripts\sync-mcp-distribution.ps1 -TargetDir "C:\path\to\anchord-mcp"
```

The script:
1. Resolves the `src/` junction into real file copies
2. Copies all distribution surface files
3. Verifies dependency versions match between private and public `package.json`

### Manual sync

```bash
# From the anchord-mcp public repo checkout:
cp -r /path/to/experiment1/mcp-server/src/ ./src/
cp /path/to/experiment1/mcp-server/tsconfig.json ./tsconfig.json
# All other files already live in distribution/anchord-mcp/
```

## Cutting a release

1. Update version in `distribution/anchord-mcp/package.json`
2. Update version in `server.json`
3. Add entry to `CHANGELOG.md`
4. Sync to public repo (see above)
5. In the public repo:

```bash
npm run build
npm test
npm run typecheck
npm publish --access public
```

6. Publish to MCP Registry:

```bash
mcp-publisher publish
```

7. Tag the release: `git tag v1.0.0 && git push --tags`

## npm package name

The package is published as `@anchord/mcp-server`. This requires an npm
organization named `anchord`.

**Pre-publish checklist:**
- [ ] Verify `anchord` npm org exists (or create it)
- [ ] Verify `@anchord/mcp-server` is available
- [ ] If org unavailable, fallback to unscoped `anchord-mcp`
- [ ] Update `mcpName` in `package.json` and `server.json` if name changes

## Registry submission commands

### Official MCP Registry

```bash
# Install publisher
brew install mcp-publisher   # macOS
# or download from https://github.com/modelcontextprotocol/registry/releases

# Authenticate
mcp-publisher login github

# Publish
mcp-publisher publish
```

### Smithery

```bash
# Via CLI
smithery mcp publish "https://github.com/nolenation04/anchord-mcp" -n @anchord/mcp-server

# Or via web: https://smithery.ai/new
# Select "Repo" type, enter the GitHub URL
```

### Glama

Submit at [glama.ai/mcp/servers](https://glama.ai/mcp/servers) — enter
the npm package name or GitHub URL.

### mcp.so

Submit at [mcp.so](https://mcp.so) — enter the npm package name.

### Awesome MCP Servers

Open a PR at
[punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)
adding an entry under the appropriate category.

## GitHub repo setup checklist

When creating the public `anchord-mcp` repository:

- [ ] Repository description: "MCP server for Anchord — identity resolution and pre-write safety checks for AI agents"
- [ ] Topics: `mcp`, `mcp-server`, `model-context-protocol`, `identity-resolution`, `crm`, `ai-agents`, `salesforce`, `hubspot`
- [ ] Homepage: `https://www.anchord.ai`
- [ ] License: MIT (already in repo)
- [ ] Branch protection on `main`
- [ ] Enable GitHub Actions for CI (`npm test`, `npm run typecheck`, `npm run build`)

## Suggested categories for directories

- Identity resolution
- CRM / data quality
- AI agent tooling
- Pre-write safety / guard
- Read-only integrations

## Avoiding divergence

- **Source of truth**: `mcp-server/src/` in the private repo
- **Never edit `src/` directly in the public repo** — changes flow private → public only
- **Distribution-only files** (README, docs, examples, Dockerfile) can be edited in either repo, but prefer the private repo for consistency
- Run `scripts/verify-package.sh` before each release to check dependency version parity
