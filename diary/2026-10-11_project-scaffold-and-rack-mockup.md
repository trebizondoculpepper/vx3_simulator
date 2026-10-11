# Development Diary Entry - 2026-10-11

## Context

- **Date**: 2026-10-11 21:17 UTC
- **Branch**: main
- **Commit**: initial
- **Contributors**: Claude Code (devops) + owner

## Problem Statement

Start a new browser game, VX3 Simulator, based on the r/VXJunkies in-joke, reusing the structure and technology of `idea_grabber`.

## Our Approach

Copy the idea_grabber stack (Vite, TypeScript, Three.js PS1 rendering, Vitest, ESLint, Prettier, Docker and Fly.io) and iterate on the design as an interactive mockup before building the 3D scene. The design moved from a small bench, to a wide desk panned sideways, to a 19-inch rack scrolled vertically with rack-mount hardware and a dismissible logbook UI layer.

## Implementation

Scaffolded the project, wrote a tested rig simulation (`src/game/rig.ts`) and desk-control mapping, canvas texture helpers for labels, dials, scopes and Nixies, and a placeholder cabinet scene. Stored the mockup source in `doc/design/`, a lore research prompt in `doc/prompts/`, and a creative handover prompt in `doc/resume/`. Added a CI workflow; the Fly deploy workflow is manual until the Fly app and token exist.

## Outcomes

Typecheck, lint, format check, 8 tests and the production build pass. The owner is handing creative control to another LLM; this agent's role becomes devops. An earlier Three.js desk demo was abandoned when the design changed to a rack.

## Next Steps

Run the lore research prompt. Creative lead builds the rack from the handover prompt. Devops: create the Fly app and `FLY_API_TOKEN` secret, then enable deploy on push.
