#!/usr/bin/env bash
# publish.sh — Build and publish rob.cmposer.cc to S3 (iteration loop, no CI).
#
# Two-pass sync for fine-grained caching:
#   pass 1: hashed/static assets (everything except index.html) -> 1y immutable
#   pass 2: index.html only -> no-cache (bundle references update immediately)
# No CloudFront invalidation needed: only html/css/js change between publishes.
set -euo pipefail

BUCKET="rob.cmposer.cc"
REGION="us-east-2"
SITE_URL="https://rob.cmposer.cc"

echo "=== [1/7] Gates: typecheck + tests ==="
npm run typecheck
npm test

echo "=== [2/7] Build ==="
npm run build

echo "=== [3/7] Sanity-check dist/index.html ==="
if [ ! -f "dist/index.html" ]; then
  echo "ERROR: dist/index.html missing after build — aborting publish." >&2
  exit 1
fi
echo "dist/index.html present."

echo "=== [4/7] Sync hashed/static assets (1y immutable, --delete) ==="
aws s3 sync dist/ "s3://${BUCKET}" \
  --region "${REGION}" \
  --delete \
  --exclude index.html \
  --cache-control "public, max-age=31536000, immutable"

echo "=== [5/7] Sync index.html (no-cache, no --delete) ==="
aws s3 sync dist/ "s3://${BUCKET}" \
  --region "${REGION}" \
  --exclude "*" \
  --include index.html \
  --cache-control "no-cache"

echo "=== [6/7] No CloudFront invalidation ==="
echo "Fine-grained caching: hashed assets are immutable and index.html is no-cache, so no purge is needed on publish."

echo "=== [7/7] Verify ==="
if curl -sf "${SITE_URL}/" | grep -q "<title>"; then
  echo "OK: ${SITE_URL} serves index.html with a <title>."
else
  echo "ERROR: ${SITE_URL} did not return a page containing <title>." >&2
  exit 1
fi