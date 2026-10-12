# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# VX3 Simulator: agent guide

A PS1-style browser bench toy simulating a historical "full" VX3 rig from r/VXJunkies, built as a scrolling 19-inch equipment rack. Stack: Vite, TypeScript, Three.js, Vitest, ESLint, Prettier; hosted on Fly.io.

## Roles

- **Creative lead** (design, writing, gameplay code): start from the newest prompt in `doc/resume/`.
- **Devops** (dependencies, build tooling, CI, Docker, Fly.io): owns `package.json` dependencies, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `.prettierrc.json`, `Dockerfile`, `fly.toml`, `deploy/` and `.github/workflows/`. Other agents request changes in `doc/requests/`.

## Rules

- Stay on `main`. Do not create branches or worktrees.
- Before committing, run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` and `npm run build`. CI (`.github/workflows/ci.yml`) runs the same five; a green CI on `main` auto-deploys to Fly.io (`fly.yml`).
- Markdown is one paragraph per line, never hard-wrapped.
- Record significant sessions in `diary/` (template in `diary/README.md`).
- Never commit `agent-mailbox.toml` or `agent-inbox.toml`.
- `README.md` is written in-universe (a workstation record, not developer docs). Keep its voice, and keep it and `doc/plan.md` aligned with shipped behaviour.

## Commands

- `npm run dev`: Vite dev server on `http://127.0.0.1:5173/` (strict port).
- `npx vitest run src/game/rig.test.ts`: run one test file; add `-t "<name>"` for one test. `npm run test:watch` for watch mode.
- `npm run format`: apply Prettier.
- `npm run build` already runs the typecheck before `vite build`.

## Architecture

- `src/main.ts` calls `startScene(canvas)` in `src/rendering/start-scene.ts`, which is the hub: it builds the Three.js scene, camera modes (orbit/isometric, first-person walking with touch sticks), input, the operator log UI and the per-frame loop that steps the rig and feeds audio and tell-tales. Most integration work lands here.
- `src/game/` is pure logic with no DOM or Three.js, and is where the unit tests live (`*.test.ts` beside the source). `rig.ts` is the live simulation (`createRig`/`stepRig`, emitting `RigEvent`s; `YALGETH_LIMIT = 0.88`). `rack-controls.ts` holds the toggle and knob ids, `rack-catalogue.ts` the modules and makers placed in the rack, `safety-telltales.ts` the wall load/kWh meter and dilation crystal, `walk-collision.ts` first-person collision, and `consequences.ts` the deadpan incident log lines.
- `src/game/rig-model.ts` (a data-driven component and influence model loaded from `doc/lore/component-catalogue.json`) and `src/game/panel-grid.ts` (a 12-column panel layout with fixed control footprints and `validatePanel`) are tested but not yet wired into the scene; they underpin the "deeper, staged power model" in `doc/plan.md`.
- `src/scene/` has one `create*` factory per lab fitting or room (lab room, corridor, ceiling services, teleprinter, Cub monitor and so on), each returning objects that `start-scene.ts` places.
- Everything fitted to a machine is designated an **input** (worked by the operator; clickable) or an **indicator** (driven by machine state; never clickable) via `src/game/machine-parts.ts`. In `start-scene.ts`, use `input()` and `indicator()` for machine parts and `fixture()` for clickable room fittings (doors, drawers, taps); never call `bind()` directly. Development builds audit the scene on load and log any violation; `vx3Walker.parts()` lists every machine's inputs and indicators. When you change what an input drives, update `doc/design/control-graph.md` (GitHub renders its Mermaid diagrams) so it stays the record of every link.
- `src/rendering/ps1-material.ts`: meshes use `createPs1Material` (vertex snapping via the shared `ps1Uniforms`; `unlit` for printed surfaces that dim with `roomLight`, `glow` for self-lit screens and tubes).
- `src/audio/`: `sound-parameters.ts` maps rig state and controls to plain numbers (tested); `sound-engine.ts` drives Web Audio and ZzFX from them. Apparatus sounds are synthesised; the only recording is the BBC Micro boot chime in `src/audio/assets/` (provenance in its README), so ask the owner before adding another.
- Lore lives in `doc/lore/`: `summary.md` separates borrowed community terms from invented local parts, and modules in the catalogue are marked `provenance: 'invented'`. Keep that distinction when adding apparatus.
