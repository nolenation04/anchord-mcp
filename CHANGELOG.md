# Changelog

All notable changes to `@anchord/mcp-server` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-03

### Added

- Initial public release of the Anchord MCP server.
- 11 MCP tools covering the full AnchorID API surface:
  - `resolve_company`, `resolve_company_batch` — company identity resolution
  - `resolve_person`, `resolve_person_batch` — person identity resolution
  - `get_entity`, `get_entity_export` — AnchorID lookup and golden record export
  - `link_source_record`, `unlink_source_record` — entity link management
  - `guard_write`, `guard_write_batch` — pre-write safety checks
  - `ingest_record` — source record ingestion
- Structured error handling with `request_id` propagation.
- Cursor and Claude Desktop integration examples.
- Docker support for containerized stdio usage.
- Official MCP Registry and Smithery metadata.
