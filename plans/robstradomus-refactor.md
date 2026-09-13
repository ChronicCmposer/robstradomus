---
status: in-progress
phase: 2
updated: 2026-09-13
---

# Implementation Plan

## Goal
Refactor the Rosebud-exported Robstradomus idle game (~20.7k lines) into a typed, tested, modular codebase (Vite + TypeScript + vitest, zero third-party runtime deps) that plays the same but is fully owned, understood, and bug-fixed.

## Context & Decisions
| Decision | Rationale | Source |
|----------|-----------|--------|
| Full restructure, staged execution | Game must remain runnable after every stage; monolithic files (game.js 6.5k lines, main.js 3.6k lines) need end-state architecture | `ref:striking-rose-pig` |
| Vite + native ES modules, no framework | Game already uses ES modules with zero build; user needs dev server; vanilla stays consistent with existing event-bus architecture | `ref:striking-rose-pig` |
| TypeScript, incremental (file-by-file) | 20.7k untyped lines; compiler is the safety net for structural change; Vite/vitest make TS nearly free | `ref:striking-rose-pig` |
| vitest for unit tests | Native fit with Vite + TS; engine becomes DOM-free so pure logic is testable in Node | `ref:striking-rose-pig` |
| Engine-only test boundary | Render path (draw() 586 lines, 101 ctx.* calls) is canvas-bound; pixel-pushing tests die fast — renderer extracted cleanly, verified manually | `ref:striking-rose-pig` |
| Event-driven UI modules; Game class DOM-free | game.js makes 43 getElementById calls; a typed event bus already exists (robstradomus-* CustomEvents) — route ALL UI updates through it | `ref:striking-rose-pig` |
| Eliminate all Rosebud runtime | 4 CDN scripts not required for gameplay (single fire-and-forget telemetry call); strips telemetry + blocking loads; splash/__rosebud/ defaults/metadata all die | `ref:whole-bronze-otter` |
| Split constants.js into data modules; balance frozen | Pure data, zero behavior risk; balance numbers change only when a bug is proven | `ref:striking-rose-pig` |
| Fresh save schema (v1), delete migration chain | User accepted save incompatibility; 568-line restoreProgress() version chain (v1..20 hardcodes) replaced with clean validate/sanitize | `ref:striking-rose-pig` |
| Extract ~7,245 lines inline CSS to styles/ | 85% of index.html is CSS; makes it toolable/diffable; Vite imports CSS natively | `ref:striking-rose-pig` |
| Deploy target: local dev only | Vite default; set `base: './'` for drop-anywhere static portability later | `ref:striking-rose-pig` |
| Keep art/sound_direction.md; rewrite AGENTS.md | Design docs are assets; AGENTS.md must describe the new architecture; export-metadata.json deleted with Rosebud elimination | `ref:striking-rose-pig` |
| Opportunistic bug fixing with logged list | Each bug found → fixed in the stage that touches its code + regression test | `ref:striking-rose-pig` |
| Pin Node.js 24.21.0 (active LTS) + TypeScript 7.0.2 (latest stable) | Concrete, reproducible toolchain; Node 24 LTS is the active support line, TS 7.0 is the Go-native rewrite | `ref:striking-rose-pig` |
| Pin Vite 8.2.2 (current stable) | Vite 8 unifies on the Rust/Rolldown bundler (10–30x faster builds, plugin-compatible); current line gets active fixes | `ref:striking-rose-pig` |

## Phase 1: Tooling Scaffold [COMPLETE]
- [x] **1.1 Init package.json (npm), install vite@8.2.2, typescript@7.0.2, vitest**
- [x] 1.2 Create vite.config.ts (base './'), tsconfig.json (strict for new code), vitest config; add `.nvmrc` with `24.21.0` and an `engines` field `"node": ">=24.21.0"` in package.json
- [x] 1.3 Serve existing game through Vite dev server (index.html entry; assets via public/ or base './') — verify gameplay unchanged
- [x] 1.4 Extract ~7,245 lines inline CSS from index.html into src/styles/*.css, imported via main entry — index.html slims to ~700 lines

## Phase 2: Rosebud Elimination [PENDING]
- [ ] 2.1 Remove 4 CDN scripts (ChatManager/ImageGenerator/ProgressLogger/OGP) from index.html → `ref:whole-bronze-otter`
- [ ] 2.2 Remove splash markup + inline splash script, `__rosebud/`, rosebud-game-defaults.js/.css, export-metadata.json
- [ ] 2.3 Delete `window.ProgressLogger.logProgress('game_initialized')` call in main.js
- [ ] 2.4 Verify: dev server boots, game plays, Network tab shows zero external requests

## Phase 3: Data Layer Split [PENDING]
- [ ] 3.1 constants.js (1,774 lines) → src/data/*.ts: assets.ts, items.ts, recipes.ts, maps.ts, waves.ts, monsters.ts, balance.ts — pure moves, balance numbers frozen
- [ ] 3.2 Update imports in game.js / entity.js / main.js
- [ ] 3.3 Verify: tsc clean, game plays identically

## Phase 4: Entities + Stat De-duplication [PENDING]
- [ ] 4.1 entity.js (672 lines) → src/entities/: entity.ts, wizard.ts, monster.ts
- [ ] 4.2 Collapse 6× repeated stat aggregation in getEffectiveStats() into stat-key-driven loop
- [ ] 4.3 Extract 101 ctx.* calls out of entities into rendering/ (entities become DOM-free data+behavior)
- [ ] 4.4 Write stats.test.ts (vitest) for aggregation across all 6 stat sources

## Phase 5: Engine Extraction (Game class → DOM-free) [PENDING]
- [ ] 5.1 src/engine/events.ts: typed event bus (replaces ad-hoc CustomEvent strings)
- [ ] 5.2 src/engine/combat.ts: update() (219 lines), wizardAttack() (218 lines), monster AI
- [ ] 5.3 src/engine/loot.ts: rollLootDrop() (120 lines), drop tables, crafting
- [ ] 5.4 src/engine/progression.ts: XP/levels, zone unlocks, map mastery, consolidate the 5 near-identical multiplier getters
- [ ] 5.5 src/engine/save.ts: fresh schema v1, clean validate/sanitize replacing 568-line restoreProgress() migration chain
- [ ] 5.6 Strip Game class of 43 getElementById calls + 4 update*UI() functions (~600 lines) — UI updates now emitted as events
- [ ] 5.7 Write engine tests: combat.test.ts, loot.test.ts, save.test.ts, progression.test.ts (Node env, no DOM)

## Phase 6: Rendering Module [PENDING]
- [ ] 6.1 src/rendering/renderer.ts: single canvas wrapper — the only place ctx is created
- [ ] 6.2 Split draw() (586 lines) into per-VFX-kind renderers (projectile/impact/breath/meteor/boss) + per-entity renderers
- [ ] 6.3 Extract draw()'s raw pixel/color magic numbers into named constants
- [ ] 6.4 Manual visual verification checklist (sprites, VFX, map tiles, boss glow)

## Phase 7: UI Decomposition [PENDING]
- [ ] 7.1 src/main.ts: bootstrap + event-bus wiring only
- [ ] 7.2 Split 3,581-line main.js closure (~100 nested functions) into src/ui/: hud.ts, tooltips.ts, save-slots.ts, tutorial.ts, panels/ (character, inventory, achievements, materials, discovery)
- [ ] 7.3 Consolidate 5 near-identical tooltip markup builders into one parametric builder
- [ ] 7.4 Full manual QA pass (Start Farming → combat ticks → upgrades → map switch → save/load → panels)

## Phase 8: Bug Fixes + Hardening [PENDING]
- [ ] 8.1 Review logged bug list accumulated during Phases 2–7
- [ ] 8.2 Fix each bug in place + regression test (per Q7 policy)
- [ ] 8.3 Strict-mode TS pass; eliminate all type escapes
- [ ] 8.4 Verify npm run build + npm run preview (production build works)

## Phase 9: Docs & Finalization [PENDING]
- [ ] 9.1 Rewrite AGENTS.md to describe new architecture; keep art_direction.md + sound_direction.md
- [ ] 9.2 Delete all superseded .js/.html remnants once references are gone
- [ ] 9.3 Final verification: dev server, build, tests green; commit

## Notes
- 2026-09-13: Grilling session concluded — all 14 design decisions settled with user (Q1–Q14). Stack: ES modules + Vite + TS + vitest. Rosebud fully eliminated. Save schema fresh v1. Balance frozen. `ref:striking-rose-pig`, `ref:whole-bronze-otter`
- 2026-09-13: Node 18+/npm/npx available at /usr/bin/; no package.json exists yet `ref:whole-bronze-otter`
- 2026-09-13: git.cmposer.cc remote (origin) healthy; repo on main; global gitconfig defaultObjectFormat sha256 removed to avoid sha256/sha1 mismatches
- 2026-09-13: Toolchain version pins — Node.js **24.21.0** (active LTS, "Krypton") and TypeScript **7.0.2** (latest stable, Go-native rewrite) confirmed via web research `ref:striking-rose-pig`
- 2026-09-13: Toolchain version pin — Vite **8.2.2** (current stable; single Rolldown bundler) `ref:striking-rose-pig`
- 2026-09-13: Add an `.nvmrc` file at the project root containing `24.21.0` (matches the pinned Node LTS; nvm is now installed and defaulted to v24.21.0)