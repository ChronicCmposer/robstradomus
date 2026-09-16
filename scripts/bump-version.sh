#!/usr/bin/env bash
# bump-version.sh — Create and push the next vX.Y.Z lightweight tag on main.
#
# Guards: clean tree, branch main, HEAD synced with BOTH origin/main and
# github/main. Creates a lightweight tag, then pushes it to origin and github
# (no rollback if a push fails — the tag stays local and remote).
set -euo pipefail

LEVEL="${1:-}"

echo "=== [1/7] Validate bump level ==="
if [ "${LEVEL}" != "major" ] && [ "${LEVEL}" != "minor" ] && [ "${LEVEL}" != "patch" ]; then
  echo "ERROR: usage: make bump-version LEVEL=major|minor|patch" >&2
  exit 1
fi
echo "Bump level: ${LEVEL}."

echo "=== [2/7] Guard: clean working tree ==="
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree is dirty — commit or stash changes before bumping." >&2
  exit 1
fi
echo "Working tree clean."

echo "=== [3/7] Guard: on main ==="
current_branch="$(git branch --show-current)"
if [ "${current_branch}" != "main" ]; then
  echo "ERROR: current branch is '${current_branch}', expected 'main'." >&2
  exit 1
fi
echo "On main."

echo "=== [4/7] Guard: HEAD synced with origin/main and github/main ==="
if ! git fetch origin main; then
  echo "ERROR: 'git fetch origin main' failed." >&2
  exit 1
fi
if ! git fetch github main; then
  echo "ERROR: 'git fetch github main' failed." >&2
  exit 1
fi
head_sha="$(git rev-parse HEAD)"
origin_sha="$(git rev-parse origin/main)"
github_sha="$(git rev-parse github/main)"
if [ "${head_sha}" != "${origin_sha}" ]; then
  echo "ERROR: HEAD (${head_sha}) is not synced with origin/main (${origin_sha})." >&2
  exit 1
fi
if [ "${head_sha}" != "${github_sha}" ]; then
  echo "ERROR: HEAD (${head_sha}) is not synced with github/main (${github_sha})." >&2
  exit 1
fi
echo "HEAD synced with both remotes."

echo "=== [5/7] Resolve latest tag ==="
latest_tag="$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -1)"
if [ -z "${latest_tag}" ]; then
  echo "ERROR: no vX.Y.Z tag found — bootstrap the first tag manually:" >&2
  echo "  git tag v0.0.1 && git push origin v0.0.1 && git push github v0.0.1" >&2
  exit 1
fi
echo "Latest tag: ${latest_tag}."

echo "=== [6/7] Validate and increment tag ==="
if [[ ! "${latest_tag}" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "ERROR: tag '${latest_tag}' does not match ^vX.Y.Z$." >&2
  exit 1
fi
major=$((10#${BASH_REMATCH[1]}))
minor=$((10#${BASH_REMATCH[2]}))
patch=$((10#${BASH_REMATCH[3]}))
case "${LEVEL}" in
  major)
    major=$((major + 1))
    minor=0
    patch=0
    ;;
  minor)
    minor=$((minor + 1))
    patch=0
    ;;
  patch)
    patch=$((patch + 1))
    ;;
esac
new_tag="v${major}.${minor}.${patch}"
echo "New tag: ${new_tag}."

echo "=== [7/7] Create and push tag ==="
git tag "${new_tag}"
echo "Created lightweight tag ${new_tag}."
if ! git push origin "${new_tag}"; then
  echo "ERROR: failed to push tag ${new_tag} to remote 'origin'." >&2
  exit 1
fi
if ! git push github "${new_tag}"; then
  echo "ERROR: failed to push tag ${new_tag} to remote 'github'." >&2
  exit 1
fi
echo "Pushed ${new_tag} to origin and github."
echo "Done: ${new_tag}"