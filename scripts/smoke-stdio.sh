#!/usr/bin/env bash
set -euo pipefail

# Smoke test: verify the MCP server starts and responds to a JSON-RPC
# initialize request over stdio.
#
# Usage:
#   ./scripts/smoke-stdio.sh
#
# Requires: ANCHORD_API_KEY set (or uses a dummy key for handshake-only test)

echo "=== MCP stdio smoke test ==="

# Build if needed
if [ ! -f "dist/index.js" ]; then
  echo "Building..."
  npm run build --silent
fi

# Use a dummy key if none set — the initialize handshake doesn't hit the API
export ANCHORD_API_KEY="${ANCHORD_API_KEY:-smoke-test-dummy-key}"
export ANCHORD_API_BASE_URL="${ANCHORD_API_BASE_URL:-https://api.anchord.ai}"

# JSON-RPC initialize request
INIT_REQUEST='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0.0"}}}'

echo "Sending initialize request..."

# Send request and capture response (timeout after 10 seconds)
RESPONSE=$(echo "$INIT_REQUEST" | timeout 10 node dist/index.js 2>/dev/null | head -1) || {
  echo "FAIL: Server did not respond within 10 seconds"
  exit 1
}

# Check response contains expected fields
if echo "$RESPONSE" | node -e "
  const r = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  if (r.result && r.result.serverInfo && r.result.serverInfo.name === 'anchord') {
    process.exit(0);
  }
  process.exit(1);
" 2>/dev/null; then
  echo "PASSED: Server responded with correct serverInfo"
  echo "  Server: anchord v$(echo "$RESPONSE" | node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(r.result.serverInfo.version)" 2>/dev/null || echo 'unknown')"
else
  echo "FAIL: Unexpected response"
  echo "  Response: $RESPONSE"
  exit 1
fi
