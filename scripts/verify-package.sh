#!/usr/bin/env bash
set -euo pipefail

# Verify package integrity for @anchord/mcp-server.
# Run from the package root (distribution/anchord-mcp/).

ERRORS=0

echo "=== Package verification ==="

# 1. Check required files exist
for f in package.json tsconfig.json src/index.ts src/tools.ts src/api-client.ts LICENSE README.md; do
  if [ ! -e "$f" ]; then
    echo "FAIL: Missing required file: $f"
    ERRORS=$((ERRORS + 1))
  else
    echo "  OK: $f"
  fi
done

# 2. Check package.json has required fields
for field in name version description bin license mcpName repository homepage; do
  if ! node -e "const p = require('./package.json'); if (!p['$field']) process.exit(1);" 2>/dev/null; then
    echo "FAIL: package.json missing field: $field"
    ERRORS=$((ERRORS + 1))
  else
    echo "  OK: package.json.$field"
  fi
done

# 3. Check shebang on entry point
if ! head -1 src/index.ts | grep -q '#!/usr/bin/env node'; then
  echo "FAIL: src/index.ts missing shebang (#!/usr/bin/env node)"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: shebang present"
fi

# 4. Build and check output
echo ""
echo "=== Build check ==="
npm run build --silent 2>/dev/null
if [ ! -f "dist/index.js" ]; then
  echo "FAIL: dist/index.js not found after build"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: dist/index.js exists"
fi

# 5. Type check
echo ""
echo "=== Type check ==="
if npm run typecheck --silent 2>/dev/null; then
  echo "  OK: typecheck passed"
else
  echo "FAIL: typecheck failed"
  ERRORS=$((ERRORS + 1))
fi

# 6. Tests
echo ""
echo "=== Tests ==="
if npm test --silent 2>/dev/null; then
  echo "  OK: tests passed"
else
  echo "FAIL: tests failed"
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "FAILED: $ERRORS error(s) found"
  exit 1
else
  echo "PASSED: all checks OK"
fi
