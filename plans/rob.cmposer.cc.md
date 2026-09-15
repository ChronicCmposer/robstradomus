---
status: not-started
phase: 1
updated: 2026-09-15
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
- [ ] **1.1 Remove stale `dist/` from working tree** (gitignored; verify with `git status` it stays clean) ← CURRENT
- [ ] 1.2 Create top-level `Makefile` — targets: `dev`, `build`, `test`, `typecheck`, `preview` (wrap npm scripts), `deploy` (→ scripts/deploy.sh), `publish` (→ scripts/publish.sh), `purge` (invalidate `/*` + wait, distribution ID fetched from stack outputs)
- [ ] 1.3 Create `cloudformation/stack.yaml` — Parameters: `DomainName` (rob.cmposer.cc), `BucketName` (rob.cmposer.cc), `CertificateArn`; Resources: private S3 bucket (BlockPublicAccess all, SSE-S3, `DeletionPolicy: Retain`), bucket policy allowing OAC GetObject (with `aws:SourceArn`/`aws:SourceAccount` conditions), CloudFront `OriginAccessControl` (SIGV4), CloudFront distribution (OAC origin, redirect-to-https, `CompressObjectsAutomatically: true`, managed CachingOptimized cache policy honoring origin Cache-Control, alternate domain, ACM cert SNI-only, custom error responses 403/404 → `/index.html` 200, PriceClass_100); Outputs: `DistributionId`, `DistributionDomainName`
- [ ] 1.4 Create `scripts/publish.sh` — `set -euo pipefail`, stepped echoes: (1) gates `npm run typecheck && npm test`; (2) `npm run build`; (3) sanity-check `dist/index.html` exists; (4) sync pass 1: `aws s3 sync dist/ s3://rob.cmposer.cc --delete --exclude index.html --cache-control "public, max-age=31536000, immutable"`; (5) sync pass 2: index.html only, `--cache-control "no-cache"` (no `--delete`); (6) no invalidation; (7) verify: `curl -sf` → 200 + `<title>` grep; regions pinned (`--region us-east-2` for S3)
- [ ] 1.5 Create `scripts/deploy.sh` — mirrors git.cmposer.cc deploy.sh shape: (1) DNS guard: `dig +short rob.cmposer.cc` — abort with Namecheap cleanup instructions if an A record resolves; (2) ensure ACM cert for rob.cmposer.cc in **us-east-1** (request if absent); (3) poll `describe-certificate`, print TXT record (`_<hash>.rob.cmposer.cc`), pause for operator confirmation (`read -p`), poll until ISSUED; (4) `create-stack`/`update-stack` with parameters (bucket+CFN in **us-east-2**); (5) wait stack complete; (6) print CNAME instruction `rob → <DistributionDomainName>.cloudfront.net`; (7) verification guidance (dig + curl)
- [ ] 1.6 Create `cloudformation/namecheap-setup.md` — one-time manual runbook mirroring git.cmposer.cc's `ddns-setup.md`: confirm no existing `rob` records (delete DDNS host if present), add ACM TXT record (values printed by deploy.sh), add CNAME, verify with `host rob.cmposer.cc` + `curl -I https://rob.cmposer.cc/`

## Phase 2: One-time deployment [PENDING]
- [ ] 2.1 Run `make deploy` → DNS guard passes (NXDOMAIN), cert requested, TXT printed
- [ ] 2.2 Add TXT record at Namecheap → confirm in script → cert ISSUED → stack created (bucket + OAC + distribution)
- [ ] 2.3 Add CNAME `rob → <dist>.cloudfront.net` at Namecheap → wait propagation → verify `https://rob.cmposer.cc/` serves with valid cert
- [ ] 2.4 Run `make publish` → game live; verify gzip: `curl -H "Accept-Encoding: gzip" -sI` shows `content-encoding` on css/js

## Phase 3: Iteration loop [PENDING]
- [ ] 3.1 Document the loop: iteration = `make publish`; rollback = `git checkout <commit> && make publish`; asset-change emergency = `make purge`
- [ ] 3.2 Optional later: pre-compression (brotli), CI wiring (GitHub remote exists), Route53 migration — explicitly out of scope for v1

## Notes
- 2026-09-15: Game repo has no deployment artifacts; `dist/` is stale Rosebud build — fresh build mandatory `ref:gross-aquamarine-cow`
- 2026-09-15: git.cmposer.cc uses EC2 + DDNS A record + mTLS local CA — patterns to mirror are the Makefile/deploy.sh discipline and SSM-free operator loop, not the hosting architecture `ref:constant-moccasin-slug`
- 2026-09-15: Live DNS state of rob.cmposer.cc unverifiable from this environment (dig blocked, DoH not reachable); encoded as deploy.sh first-run guard instead