---
status: phase-1-complete
phase: 1
updated: 2026-09-16
---

# Implementation Plan: rob.cmposer.cc — Production Static Deployment (S3 + CloudFront + CloudFormation)

## Goal
Deploy the robstradomus game to `https://rob.cmposer.cc` as the single production environment, using a private S3 bucket + CloudFront distribution + CloudFormation stack, a static CNAME at Namecheap (no DDNS), and an ACM cert — with `make publish` as the one-command iteration loop.

## Context & Decisions
| Decision | Rationale | Source |
|----------|-----------|--------|
| **Option A**: S3 + CloudFront + CloudFormation; static CNAME at Namecheap; **no DDNS** | robstradomus is 100% static (vanilla JS/Canvas, localStorage saves, zero backend). git.cmposer.cc's DDNS exists only to track a changing EC2 public IP — CloudFront gives a permanent CNAME target, and a DDNS A record would conflict with the CNAME | `ref:gross-aquamarine-cow`, `ref:constant-moccasin-slug` |
| rob.cmposer.cc **is production** (no separate staging env) | User decision: "staging = production by design" | interview Q5 |
| **ACM cert** (free, auto-renew), requested/validated by deploy.sh **before** stack creation | CloudFront only accepts ACM certs (Let's Encrypt impossible). Cert-first flow avoids CREATE_IN_PROGRESS limbo; manual step = one TXT record at Namecheap, mirroring git.cmposer.cc's scripted-manual-step pattern | `ref:constant-moccasin-slug`, interview Q9/Q13 |
| Regions: **cert us-east-1**, **bucket + CFN stack us-east-2**, CloudFront global | ACM certs for CloudFront must be in us-east-1 (hard constraint); bucket region matches account layout | interview Q11/Q15 |
| Bucket `rob.cmposer.cc`: **private, no versioning, `DeletionPolicy: Retain`, OAC access only** | No public-read/website-hosting endpoint; rollback via git (checkout old commit + publish) instead of S3 versioning | interview Q9/Q16 |
| **Fine-grained cache** (no purge on publish): `index.html` no-cache; hashed `assets/` + `public/` webp/mp3 → 1y immutable | Vite hashes bundles; user confirms only html/css/js change (assets static). Zero invalidation cost | `ref:gross-aquamarine-cow`, interview Q8b |
| **CloudFront automatic compression** (`CompressObjectsAutomatically: true`) | Gzip/brotli at edge for html/css/js ≥1KB; zero pipeline complexity vs pre-compressing in publish.sh | interview Q14a |
| `make publish` → `scripts/publish.sh` committed; gates = typecheck + test | Mirrors git.cmposer.cc's Makefile + deploy.sh discipline (set -euo pipefail, stepped output, verification) | `ref:constant-moccasin-slug`, interview Q4/Q8 |
| `make deploy` → `scripts/deploy.sh` (stack lifecycle, mirror of git.cmposer.cc deploy.sh) | One-time/rare: DNS guard → cert+TXT prompt → create/update stack → print CNAME step → verify | `ref:constant-moccasin-slug`, interview Q6 |
| `make purge` escape hatch (`invalidate /*`) | Covers the day a public/ asset actually changes (1y immutable would otherwise hide it) | interview Q16 |
| No CI, no secrets, no SSM | Manual operator loop with existing AWS CLI creds; Option A needs zero secrets (no DDNS password, ACM manages certs) | `ref:constant-moccasin-slug`, interview Q11 |
| Remove stale `dist/` (gitignored residue of old Rosebud build) | Fresh `vite build` every publish; Vite empties outDir by default | `ref:gross-aquamarine-cow`, interview Q8 |
| Cost: ~$0–1/mo (ACM $0; S3/CF pennies at hobby traffic) vs ~$7/mo EC2 pattern | ACM public certs are free; reference costs documented | `ref:constant-moccasin-slug`, interview Q13 |
| First-run DNS guard: deploy.sh aborts if `rob.cmposer.cc` resolves to an A record | Clean slate confirmed (no DDNS host exists); guard enforces it and prevents CNAME shadowing | interview Q10 |

## Phase 1: Scaffold — repo files [PENDING]
- [x] **1.1 Remove stale `dist/` from working tree** (gitignored; verify with `git status` it stays clean)
- [x] 1.2 Create top-level `Makefile` — targets: `dev`, `build`, `test`, `typecheck`, `preview` (wrap npm scripts), `deploy` (→ scripts/deploy.sh), `publish` (→ scripts/publish.sh), `purge` (invalidate `/*` + wait, distribution ID fetched from stack outputs)
- [x] 1.3 Create `cloudformation/stack.yaml` — Parameters: `DomainName` (rob.cmposer.cc), `BucketName` (rob.cmposer.cc), `CertificateArn`; Resources: private S3 bucket (BlockPublicAccess all, SSE-S3, `DeletionPolicy: Retain`), bucket policy allowing OAC GetObject (with `aws:SourceArn`/`aws:SourceAccount` conditions), CloudFront `OriginAccessControl` (SIGV4), CloudFront distribution (OAC origin, redirect-to-https, `CompressObjectsAutomatically: true`, managed CachingOptimized cache policy honoring origin Cache-Control, alternate domain, ACM cert SNI-only, custom error responses 403/404 → `/index.html` 200, PriceClass_100); Outputs: `DistributionId`, `DistributionDomainName`
- [x] 1.4 Create `scripts/publish.sh` — `set -euo pipefail`, stepped echoes: (1) gates `npm run typecheck && npm test`; (2) `npm run build`; (3) sanity-check `dist/index.html` exists; (4) sync pass 1: `aws s3 sync dist/ s3://rob.cmposer.cc --delete --exclude index.html --cache-control "public, max-age=31536000, immutable"`; (5) sync pass 2: index.html only, `--cache-control "no-cache"` (no `--delete`); (6) no invalidation; (7) verify: `curl -sf` → 200 + `<title>` grep; regions pinned (`--region us-east-2` for S3)
- [x] 1.5 Create `scripts/deploy.sh` — mirrors git.cmposer.cc deploy.sh shape: (1) DNS guard: `dig +short rob.cmposer.cc` — abort with Namecheap cleanup instructions if an A record resolves; (2) ensure ACM cert for rob.cmposer.cc in **us-east-1** (request if absent); (3) poll `describe-certificate`, print TXT record (`_<hash>.rob.cmposer.cc`), pause for operator confirmation (`read -p`), poll until ISSUED; (4) `create-stack`/`update-stack` with parameters (bucket+CFN in **us-east-2**); (5) wait stack complete; (6) print CNAME instruction `rob → <DistributionDomainName>.cloudfront.net`; (7) verification guidance (dig + curl)
- [x] 1.6 Create `cloudformation/namecheap-setup.md` — one-time manual runbook mirroring git.cmposer.cc's `ddns-setup.md`: confirm no existing `rob` records (delete DDNS host if present), add ACM TXT record (values printed by deploy.sh), add CNAME, verify with `host rob.cmposer.cc` + `curl -I https://rob.cmposer.cc/`

## Phase 2: One-time deployment [PENDING]
- [ ] 2.1 Run `make deploy` → DNS guard passes (NXDOMAIN), cert requested, TXT printed
- [ ] 2.2 Add TXT record at Namecheap → confirm in script → cert ISSUED → stack created (bucket + OAC + distribution)
- [ ] 2.3 Add CNAME `rob → <dist>.cloudfront.net` at Namecheap → wait propagation → verify `https://rob.cmposer.cc/` serves with valid cert
- [ ] 2.4 Run `make publish` → game live; verify gzip: `curl -H "Accept-Encoding: gzip" -sI` shows `content-encoding` on css/js

## Phase 3: Iteration loop [PENDING]
- [ ] 3.1 Document the loop: iteration = `make publish`; rollback = `git checkout <commit> && make publish`; asset-change emergency = `make purge`
- [ ] 3.2 Optional later: pre-compression (brotli), CI wiring (GitHub remote exists), Route53 migration — explicitly out of scope for v1

## Release Flow: tag-based versioning + GitHub release ceremony

Version lives only in git tags (`vX.Y.Z`, lightweight); `package.json` `version` (`0.1.0`) is ignored and never synced. Bump line is `main`; dual-remote topology (origin = git.cmposer.cc, github = ChronicCmposer/robstradomus mirror) must stay in sync before bumping.

- `make bump-version LEVEL=major|minor|patch` → `scripts/bump-version.sh` — validates LEVEL; guards: clean tree, branch `main`, HEAD synced with **both** `origin/main` and `github/main`; resolves latest `vX.Y.Z` tag (bootstrap `v0.0.1` if none); creates lightweight tag; pushes to `origin` then `github`, no rollback
- `make release` → `scripts/release.sh` — requires exact `vX.Y.Z` tag at HEAD; builds with `VITE_APP_VERSION=$tag`; archives `dist/` → `robstradomus-$tag.tar.gz`; creates GitHub release on `ChronicCmposer/robstradomus` (`--title`, `--generate-notes`, `--verify-tag`); uploads tarball `--clobber`
- Version injected at build time via `VITE_APP_VERSION` (git describe exact-match, fallback `v0.0.0-devel`) into `index.html` (`%VITE_APP_VERSION%` in landing tagline + settings panel); lives in the npm `build` script so `publish.sh`'s direct `npm run build` also injects
- [x] Bootstrap done (2026-09-16): `v0.0.1` tagged at `main` HEAD and pushed to both remotes; first release `v0.0.1` created on GitHub with the tarball asset

## Notes
- 2026-09-15: Game repo has no deployment artifacts; `dist/` is stale Rosebud build — fresh build mandatory `ref:gross-aquamarine-cow`
- 2026-09-15: git.cmposer.cc uses EC2 + DDNS A record + mTLS local CA — patterns to mirror are the Makefile/deploy.sh discipline and SSM-free operator loop, not the hosting architecture `ref:constant-moccasin-slug`
- 2026-09-15: Live DNS state of rob.cmposer.cc unverifiable from this environment (dig blocked, DoH not reachable); encoded as deploy.sh first-run guard instead
- 2026-09-15: Phase 1 scaffold complete (Makefile, cloudformation/stack.yaml, scripts/publish.sh, scripts/deploy.sh, cloudformation/namecheap-setup.md; stale dist/ removed; typecheck/test/build pass).
- 2026-09-15: **Blocker for Phase 2**: the AWS IAM user (`strimserver`) is AccessDenied on CloudFront and CloudFormation read calls (`cloudfront:ListCachePolicies`, `cloudformation:ValidateTemplate`, `cloudformation:ListStacks`). Only `sts:GetCallerIdentity` worked. Deployment cannot proceed until the operator supplies credentials with the needed CloudFormation/CloudFront/S3/ACM permissions.
- 2026-09-15: The embedded `CachePolicyId` in stack.yaml is `658327ea-f89d-4fab-a63d-7e88639e58f6` (documented Managed-CachingOptimized well-known ID) but could NOT be verified against the API due to the IAM denial — the operator should confirm it in Phase 2 with `aws cloudfront list-cache-policies`.
- 2026-09-15: Operator confirmed via `aws cloudfront list-cache-policies` that `658327ea-f89d-4fab-a63d-7e88639e58f6` is the `Managed-CachingOptimized` policy ID — the value in `cloudformation/stack.yaml` is correct and needs no change.
- 2026-09-16: Release flow recorded here (Phase 3.4 of `plans/robstradomus-release.md`): tag-based versioning + GitHub release ceremony is part of the iteration loop — bump (`make bump-version`), build with `VITE_APP_VERSION`, `make release` (see section above).
- 2026-09-16: `refactor-0` was squash-merged into `main` (`c9dedc6`); local `main` was force-pushed to `github/main` to reconcile the mirror's divergent `d0d5888` PR-merge.
- 2026-09-16: **Blocker**: the GitHub PAT initially returned **403** on release creation (lacked Releases write permission) — resolved; PAT granted Releases write, `v0.0.1` release created successfully.
- 2026-09-16: `v0.0.1` release: https://github.com/ChronicCmposer/robstradomus/releases/tag/v0.0.1