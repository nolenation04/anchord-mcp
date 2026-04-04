#!/usr/bin/env node
/**
 * Anchord MCP Server
 *
 * A Model Context Protocol server that exposes the AnchorID REST API
 * as MCP tools. Runs over stdio so it can be used with Cursor, Claude Desktop,
 * or any MCP-compatible client.
 *
 * Required environment variables:
 *   ANCHORD_API_KEY       – Bearer token for the REST API
 *
 * Optional:
 *   ANCHORD_API_BASE_URL  – defaults to https://api.anchord.ai
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";

const server = new McpServer({
  name: "anchord",
  version: "1.0.0",
});

registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
