#!/usr/bin/env bash
# release.sh — Create a per-version GitHub release for the tagged build.
#
# Requires an exact vX.Y.Z tag at HEAD. Builds with VITE_APP_VERSION=$tag,
# archives dist/, and uploads robstradomus-$tag.tar.gz to
# ChronicCmposer/robstradomus (creating the release if missing).
set -euo pipefail

echo "=== [1/6] Resolve vX.Y.Z tag at HEAD ==="
tag="$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --points-at HEAD --sort=-v:refname | head -1)"
if [ -z "${tag}" ]; then
  echo "ERROR: no vX.Y.Z tag points exactly at HEAD — run 'make bump-version LEVEL=major|minor|patch' first." >&2
  exit 1
fi
echo "Releasing ${tag}."

echo "=== [2/6] Build with VITE_APP_VERSION=${tag} ==="
VITE_APP_VERSION="${tag}" npm run build

echo "=== [3/6] Sanity-check dist/index.html ==="
if [ ! -f "dist/index.html" ]; then
  echo "ERROR: dist/index.html missing after build — aborting release." >&2
  exit 1
fi
if ! grep -qF -- "${tag}" dist/index.html; then
  echo "ERROR: dist/index.html does not embed version '${tag}'." >&2
  exit 1
fi
echo "dist/index.html present and embeds ${tag}."

echo "=== [4/6] Archive dist into robstradomus-${tag}.tar.gz ==="
tar -czf "robstradomus-${tag}.tar.gz" -C dist .
echo "Created robstradomus-${tag}.tar.gz."

echo "=== [5/6] Ensure GitHub release ${tag} exists ==="
if gh release view "${tag}" --repo ChronicCmposer/robstradomus >/dev/null 2>&1; then
  echo "Release ${tag} already exists."
else
  echo "Release ${tag} missing; creating it..."
  gh release create "${tag}" --title "${tag}" --generate-notes --verify-tag --repo ChronicCmposer/robstradomus
  echo "Created release ${tag}."
fi

echo "=== [6/6] Upload tarball ==="
gh release upload "${tag}" "robstradomus-${tag}.tar.gz" --clobber --repo ChronicCmposer/robstradomus
echo "Uploaded robstradomus-${tag}.tar.gz to release ${tag}."
echo "Done: https://github.com/ChronicCmposer/robstradomus/releases/tag/${tag}"