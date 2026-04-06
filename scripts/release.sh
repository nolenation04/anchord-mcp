#!/usr/bin/env bash
set -euo pipefail

# Release @anchord/mcp-server to npm + GitHub.
# Run from the package root (the public anchord-mcp repo).
#
# Prerequisites:
#   - npm login (run once in Codespaces)
#   - gh auth login (usually pre-configured in Codespaces)
#
# What this does:
#   1. Reads version from package.json
#   2. Checks the tag doesn't already exist
#   3. Generates/updates package-lock.json
#   4. Installs deps, builds, runs tests
#   5. Commits lockfile if changed
#   6. Tags, pushes, creates GitHub release
#   7. Publishes to npm

VERSION=$(node -e "console.log(require('./package.json').version)")
TAG="v${VERSION}"
PACKAGE_NAME=$(node -e "console.log(require('./package.json').name)")

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Release ${PACKAGE_NAME}@${VERSION}"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Pre-flight checks ───────────────────────────────────────────

if ! command -v node &>/dev/null; then
  echo "ERROR: node is not installed"
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo "ERROR: npm is not installed"
  exit 1
fi

if ! npm whoami &>/dev/null; then
  echo "ERROR: not logged in to npm. Run: npm login"
  exit 1
fi

NPM_USER=$(npm whoami)
echo "  npm user:    ${NPM_USER}"
echo "  package:     ${PACKAGE_NAME}"
echo "  version:     ${VERSION}"
echo "  tag:         ${TAG}"
echo ""

if git tag -l "$TAG" | grep -q "$TAG"; then
  echo "ERROR: tag ${TAG} already exists. Bump the version in package.json first."
  exit 1
fi

NPM_LATEST=$(npm view "${PACKAGE_NAME}" version 2>/dev/null || echo "unpublished")
if [ "$NPM_LATEST" = "$VERSION" ]; then
  echo "ERROR: ${PACKAGE_NAME}@${VERSION} is already published on npm."
  echo "       Bump the version in package.json first."
  exit 1
fi
echo "  npm latest:  ${NPM_LATEST}"
echo ""

# ── Confirm ─────────────────────────────────────────────────────

read -rp "Publish ${PACKAGE_NAME}@${VERSION} to npm and create GitHub release? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[yY]$ ]]; then
  echo "Aborted."
  exit 0
fi
echo ""

# ── Build & test ────────────────────────────────────────────────

echo "=== Generating package-lock.json ==="
npm install --package-lock-only
echo ""

echo "=== Installing dependencies ==="
npm ci
echo ""

echo "=== Building ==="
npm run build
echo ""

echo "=== Running tests ==="
npm test
echo ""

# ── Commit lockfile if changed ──────────────────────────────────

if ! git diff --quiet package-lock.json 2>/dev/null || [ ! -f package-lock.json ]; then
  echo "=== Committing package-lock.json ==="
  git add package-lock.json
  git commit -m "Update package-lock.json for ${TAG}"
fi

# ── Tag & push ──────────────────────────────────────────────────

echo "=== Tagging ${TAG} ==="
git tag -a "$TAG" -m "Release ${TAG}"

echo "=== Pushing to origin ==="
git push origin HEAD
git push origin "$TAG"

# ── GitHub release ──────────────────────────────────────────────

echo "=== Creating GitHub release ==="
if command -v gh &>/dev/null; then
  CHANGELOG_ENTRY=$(sed -n "/^## \[${VERSION}\]/,/^## \[/p" CHANGELOG.md 2>/dev/null | head -n -1 || echo "Release ${TAG}")
  if [ -z "$CHANGELOG_ENTRY" ]; then
    CHANGELOG_ENTRY="Release ${TAG}"
  fi
  gh release create "$TAG" --title "$TAG" --notes "$CHANGELOG_ENTRY"
else
  echo "  SKIP: gh CLI not available. Create release manually at:"
  echo "  https://github.com/nolenation04/anchord-mcp/releases/new?tag=${TAG}"
fi

# ── Publish to npm ──────────────────────────────────────────────

echo ""
echo "=== Publishing to npm ==="
npm publish --access public

# ── Done ────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Released ${PACKAGE_NAME}@${VERSION}"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  npm:    https://www.npmjs.com/package/${PACKAGE_NAME}"
echo "  GitHub: https://github.com/nolenation04/anchord-mcp/releases/tag/${TAG}"
echo ""
