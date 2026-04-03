#!/usr/bin/env bash
set -euo pipefail

# Smoke test: build and run the Docker image, verify it starts cleanly.
#
# Usage:
#   ANCHORD_API_KEY=your-key ./scripts/smoke-docker.sh
#
# Without a real key, the container will exit with an error about missing
# ANCHORD_API_KEY — which still validates the image builds and runs.

IMAGE_NAME="anchord-mcp-smoke"

echo "=== Docker smoke test ==="

# Build
echo "Building Docker image..."
docker build -t "$IMAGE_NAME" . --quiet

echo "  OK: Image built successfully"

# Check image size
SIZE=$(docker image inspect "$IMAGE_NAME" --format='{{.Size}}' | awk '{printf "%.0f", $1/1024/1024}')
echo "  Image size: ${SIZE}MB"

# Run with dummy key to verify startup
echo "Testing container startup..."
if [ -z "${ANCHORD_API_KEY:-}" ]; then
  # Without a real key, expect the process to exit with an error about missing key
  OUTPUT=$(docker run --rm -e ANCHORD_API_KEY="" "$IMAGE_NAME" 2>&1 || true)
  if echo "$OUTPUT" | grep -q "ANCHORD_API_KEY"; then
    echo "  OK: Container starts and validates env vars correctly"
  else
    echo "FAIL: Unexpected output: $OUTPUT"
    exit 1
  fi
else
  # With a real key, send initialize and verify response
  INIT_REQUEST='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0.0"}}}'

  RESPONSE=$(echo "$INIT_REQUEST" | timeout 10 docker run --rm -i \
    -e "ANCHORD_API_KEY=$ANCHORD_API_KEY" \
    -e "ANCHORD_API_BASE_URL=${ANCHORD_API_BASE_URL:-https://api.anchord.ai}" \
    "$IMAGE_NAME" 2>/dev/null | head -1) || {
    echo "FAIL: Container did not respond within 10 seconds"
    exit 1
  }

  if echo "$RESPONSE" | grep -q '"anchord"'; then
    echo "  OK: Container responds to MCP initialize"
  else
    echo "FAIL: Unexpected response: $RESPONSE"
    exit 1
  fi
fi

# Cleanup
docker rmi "$IMAGE_NAME" --force >/dev/null 2>&1 || true

echo ""
echo "PASSED: Docker smoke test complete"
