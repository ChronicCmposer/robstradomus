# robstradomus — operator-driven deployment Makefile for rob.cmposer.cc.
#
#   make dev        run the Vite dev server
#   make build      production build into dist/
#   make test       run the test suite
#   make typecheck  run tsc --noEmit
#   make preview    preview the production build locally
#   make publish    build + sync to S3 (the iteration loop)
#   make deploy     one-time stack lifecycle (ACM cert + CloudFormation)
#   make purge      invalidate /* on CloudFront (asset-change escape hatch)
#
# Regions: ACM cert us-east-1, bucket + CloudFormation us-east-2, CloudFront global.

.PHONY: dev build test typecheck preview publish deploy purge help

dev:
	@npm run dev

build:
	@npm run build

test:
	@npm run test

typecheck:
	@npm run typecheck

preview:
	@npm run preview

publish:
	@bash scripts/publish.sh

deploy:
	@bash scripts/deploy.sh

purge:
	@set -euo pipefail; \
	stack_region=us-east-2; \
	stack_name=rob-cmposer-cc; \
	distribution_id="$$(aws cloudformation describe-stacks \
		--region "$$stack_region" \
		--stack-name "$$stack_name" \
		--query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
		--output text)"; \
	if [ -z "$$distribution_id" ] || [ "$$distribution_id" = "None" ]; then \
		echo "ERROR: no DistributionId in stack '$$stack_name' ($$stack_region) — run 'make deploy' first." >&2; \
		exit 1; \
	fi; \
	invalidation_id="$$(aws cloudfront create-invalidation \
		--distribution-id "$$distribution_id" \
		--paths "/*" \
		--query "Invalidation.Id" \
		--output text)"; \
	echo "Invalidation $$invalidation_id created for distribution $$distribution_id; waiting for completion..."; \
	aws cloudfront wait invalidation-completed \
		--distribution-id "$$distribution_id" \
		--id "$$invalidation_id"; \
	echo "Purge complete."

help:
	@echo "Targets: dev build test typecheck preview publish deploy purge"