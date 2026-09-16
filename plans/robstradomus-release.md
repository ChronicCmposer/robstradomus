---
status: complete
phase: 1
updated: 2026-09-16
---

# Implementation Plan: `make bump-version` + `make release` for robstradomus

## Goal
Add tag-based versioning and a GitHub release ceremony to robstradomus via `make bump-version LEVEL=major|minor|patch` and `make release`, modeled on the strimserver and gitd reference projects.

## Context & Decisions
| Decision | Rationale | Source |
|----------|-----------|--------|
| Version lives only in git tags (`vX.Y.Z`, lightweight); `package.json` version (`0.1.0`) is ignored and never synced | Strimserver's tag-only model; user confirmed first tag `v0.0.1` | `ref:labour-moccasin-bandicoot` |
| `make bump-version LEVEL=major|minor|patch` — LEVEL required, validated | Strimserver interface verbatim (user Q6) | `ref:labour-moccasin-bandicoot` |
| Bump line is `main`; guards: clean tree, on `main`, HEAD synced with **both** `origin/main` and `github/main` | Strimserver guard triad adapted to the dual-remote topology (origin = git.cmposer.cc, github = ChronicCmposer/robstradomus mirror); `release/*` line check dropped (no release branches) | `ref:labour-moccasin-bandicoot` |
| Bump pushes the tag to `origin` **and** `github`; no rollback, fail loudly | `gh release create` auto-creates a missing tag at the GitHub default branch's latest commit, which could anchor a release at the wrong commit — the tag must exist on `github` first; lightweight-tag simplicity (user Q13/Q14) | `ref:labour-moccasin-bandicoot` |
| `make release` requires an exact `vX.Y.Z` tag at HEAD; fails otherwise | gitd strictness (user Q12) — prevents releasing a `v0.0.0-devel` build | `ref:controlled-beige-silkworm` |
| Release = per-version GitHub release: `gh release create <tag> --title <tag> --generate-notes --verify-tag` + `gh release upload <tag> robstradomus-<tag>.tar.gz --clobber`, `--repo ChronicCmposer/robstradomus` | Strimserver release shape (user Q11); `--verify-tag` guards against gh's silent auto-tag | `ref:labour-moccasin-bandicoot` |
| Version injected at build time via `VITE_APP_VERSION` env var (git describe exact-match, fallback `v0.0.0-devel`) in the npm `build` script; consumed via Vite HTML env replacement (`%VITE_APP_VERSION%`) in index.html | gitd's stamping philosophy ported to Vite (user Q10a); `publish.sh` calls `npm run build` directly, so injection must live in the npm script to reach the S3-deployed site | `ref:controlled-beige-silkworm` |
| Version displayed next to the landing subtitle and in the Settings panel | gitd's visible-version pattern (user Q15) | `ref:controlled-beige-silkworm` |
| Bootstrap: first tag `v0.0.1` created manually (pointing at `main` HEAD — the pre-refactor, live-site snapshot), pushed to both remotes; full `make release` run as end-to-end verification | Strimserver bootstrap convention (user Q8/Q18a) | `ref:labour-moccasin-bandicoot` |

## Phase 1: Versioning & release scripts [PENDING]
- [x] **1.1 Create `scripts/bump-version.sh`** — port of strimserver's script: validate `LEVEL` (major|minor|patch); guards: clean tree, branch `main`, HEAD == `origin/main` == `github/main` (after `git fetch origin main` + `git fetch github main`); latest tag via `git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -1` (deterministic when multiple tags share a commit); error with bootstrap instructions (`git tag v0.0.1 && git push origin v0.0.1 && git push github v0.0.1`) if none; validate `^v([0-9]+)\.([0-9]+)\.([0-9]+)$`; increment per LEVEL; create **lightweight** tag (`git tag vX.Y.Z`); push to `origin` then `github`, exit 1 with a clear message if either push fails (no rollback) → `ref:labour-moccasin-bandicoot`
- [x] **1.2 Create `scripts/release.sh`** — resolve tag: highest `vX.Y.Z` tag pointing exactly at HEAD (`git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --points-at HEAD --sort=-v:refname | head -1`), fail with guidance if none; `VITE_APP_VERSION=$tag npm run build`; sanity-check `dist/index.html`; `tar -czf robstradomus-$tag.tar.gz -C dist .` at repo root; `gh release view $tag --repo ChronicCmposer/robstradomus` → create if missing (`gh release create $tag --title $tag --generate-notes --verify-tag --repo ChronicCmposer/robstradomus`); `gh release upload $tag robstradomus-$tag.tar.gz --clobber --repo ChronicCmposer/robstradomus` → `ref:labour-moccasin-bandicoot` `ref:controlled-beige-silkworm`
- [x] **1.3 Add `bump-version` and `release` targets to `Makefile`** — `@bash scripts/bump-version.sh $(LEVEL)` and `@bash scripts/release.sh`; add both to `.PHONY`; update the header comment (versioning section) and the `help` target line
- [x] **1.4 Update `package.json`** — change `"build"` to `VITE_APP_VERSION=$(git describe --tags --exact-match 2>/dev/null || echo v0.0.0-devel) vite build`; leave `"version": "0.1.0"` untouched (ignored by design) → `ref:controlled-beige-silkworm`
- [x] **1.5 Append `robstradomus-v*.tar.gz` to `.gitignore`** — keeps `bump-version`'s clean-tree guard happy after a release leaves a tarball in the repo root

## Phase 2: Build-time version injection [PENDING]
- [x] **2.1 Landing subtitle** — in `index.html` line 577, append the version to the tagline: `Idle Wizard Battler · %VITE_APP_VERSION%` (Vite HTML env replacement; `%` placeholders are substituted at build time; no JS needed)
- [x] **2.2 Settings panel** — in `index.html` `#settings-panel` (near the `.settings-note` at line 481), add a small version line, e.g. `<p class="settings-note">Version %VITE_APP_VERSION%</p>` (style to match the panel's existing visual language)
- [x] **2.3 Verify injection** — `make build` embeds `v0.0.0-devel` in `dist/index.html` on an untagged HEAD; `make typecheck` and `make test` still pass; `make publish`-path build (npm run build directly) also injects

## Phase 3: Bootstrap & end-to-end verification [PENDING]
- [x] **3.1 Preconditions** — checkout `main`; `git fetch origin` + `git fetch github`; confirm `main` is synced with both remotes (push `main` to `github` first if the mirror is missing/stale — manual operator step)
- [x] **3.2 Bootstrap tag** — `git tag v0.0.1`, `git push origin v0.0.1`, `git push github v0.0.1` (per strimserver's manual-first-tag convention)
- [x] **3.3 Run `make release`** — verify GitHub release `v0.0.1` exists on `ChronicCmposer/robstradomus` with generated notes and asset `robstradomus-v0.0.1.tar.gz`; verify `v0.0.1` (not the dev fallback) is embedded in the tarball's `index.html`; confirm the bump loop works by dry-running the script's guard logic (no second tag created)
- [x] **3.4 Update `plans/rob.cmposer.cc.md`** — record the release flow in the project's master plan document

## Notes
- 2026-09-16: Full design grilled and confirmed by the user (Rounds 1–5, Q1–Q18): scope = versioning + GitHub release hosting only (S3 `publish` stays separate); tags-only versioning; `main` bump line; bootstrap `v0.0.1`; Vite env injection with `v0.0.0-devel` fallback; per-version releases with `--generate-notes`; exact-tag-at-HEAD strictness; lightweight tags; dual-remote sync/push.
- gh behavior: `gh release create` auto-creates a missing tag at the GitHub default branch's latest commit — hence the dual-remote tag push in bump-version and `--verify-tag` in release (source: gh-release-create(1) manual, cli.github.com/manual/gh_release_create).
- Both references flagged `git describe --abbrev=0` as unpredictable when multiple tags point at the same commit (bump creates no commit, so consecutive bumps can share a commit) — all tag resolution uses `git tag --list --sort=-v:refname` instead → `ref:labour-moccasin-bandicoot`
- `scripts/publish.sh` calls `npm run build` directly (not `make build`), so version injection lives in the npm script, not the Makefile target.
- User decision: `package.json` `"version": "0.1.0"` is ignored and never synced; `make version` convenience target explicitly rejected (Q17).