# Remote (Hosted) MCP Server

> **Status: Planned.** The remote MCP server is not yet available.
> This page describes the planned architecture for reference.

## Overview

A hosted version of the Anchord MCP server will be available as a
publicly accessible Streamable HTTP endpoint, enabling AI agents and MCP
clients to connect without installing anything locally.

## How it will work

Instead of running the MCP server locally over stdio, agents will connect
to a hosted endpoint via HTTP:

```
Agent  →  HTTPS POST  →  Hosted MCP Server  →  Anchord API
          (API key header)
```

Authentication will use the same `ANCHORD_API_KEY` passed as a
request header. No OAuth flow required.

## Current alternative

Today, the MCP server runs locally over stdio. See the
[README](../README.md) for installation and configuration.

## Updates

This page will be updated when the remote MCP server launches. Follow
the [changelog](../CHANGELOG.md) for release announcements.
