#!/usr/bin/env bash
# Cuts a tagged release and publishes the webxdc app (calendario.xdc) as its asset:
# bumps the version, commits, tags, pushes, builds the .xdc, and creates the GitHub release.
#
# There is one version for all the variants of the repository (the one in package.json) and
# one tag, vX.Y.Z. Other variants attach their own files to the same release.
#
# Usage: npm run publish:webxdc -- <version>   (e.g. npm run publish:webxdc -- 0.1.0)
#        bash scripts/publish-webxdc.sh <version> [--yes]
#
# --yes / -y  skip the confirmation prompt before pushing/publishing.

set -euo pipefail

BRANCH="master"
ASSET_NAME="calendario.xdc"

usage() {
  echo "Usage: $0 <version> [--yes]" >&2
  echo "  e.g. $0 0.1.0" >&2
  exit 1
}

VERSION=""
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=1 ;;
    -h|--help) usage ;;
    *)
      if [ -n "$VERSION" ]; then usage; fi
      VERSION="$arg"
      ;;
  esac
done
[ -n "$VERSION" ] || usage

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: version must look like X.Y.Z (got '$VERSION')" >&2
  exit 1
fi
TAG="v$VERSION"

# package.json and the .xdc are in capibara-calendar-ui, the parent of this script's folder.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

command -v gh >/dev/null 2>&1 || { echo "error: 'gh' CLI is required (https://cli.github.com)" >&2; exit 1; }
command -v unzip >/dev/null 2>&1 || { echo "error: 'unzip' is required" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "error: 'gh' is not authenticated — run 'gh auth login'" >&2; exit 1; }

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "error: on branch '$CURRENT_BRANCH', expected '$BRANCH'" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "error: working tree is not clean — commit or stash your changes first" >&2
  exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "error: tag '$TAG' already exists locally" >&2
  exit 1
fi

if git ls-remote --tags origin "refs/tags/$TAG" | grep -q "$TAG"; then
  echo "error: tag '$TAG' already exists on origin" >&2
  exit 1
fi

echo "About to release $TAG:"
echo "  - bump package.json/package-lock.json to $VERSION"
echo "  - commit, tag, and push to origin/$BRANCH"
echo "  - build $ASSET_NAME and publish it as a GitHub release"
if [ "$ASSUME_YES" -ne 1 ]; then
  read -r -p "Continue? [y/N] " REPLY
  case "$REPLY" in
    [yY]|[yY][eE][sS]) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

# Build first, so that a broken build stops before anything is committed or pushed:
# if it fails, the version bump is undone.
trap 'git checkout -- package.json package-lock.json' EXIT
npm version "$VERSION" --no-git-tag-version
npm run webxdc:pack

# The stores (xdcget) need these three files in the .xdc.
for required in index.html manifest.toml icon.png; do
  unzip -Z1 "$ASSET_NAME" | grep -qx "$required" || {
    echo "error: $ASSET_NAME has no $required" >&2
    exit 1
  }
done

git add package.json package-lock.json
trap - EXIT
git commit --no-verify -m "chore: bump version to $VERSION for tagged release"
git tag "$TAG"

git push --no-verify origin "$BRANCH"
git push --no-verify origin "$TAG"

gh release create "$TAG" "$ASSET_NAME" --title "$TAG" --notes ""
rm -f "$ASSET_NAME"

echo "Released $TAG: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/$TAG"
