# Resume prompt: creative lead for VX3 Simulator

Paste everything below the line into the LLM session taking creative control. It is self-contained.

---

## Who you are on this project

You are the **creative lead** for **VX3 Simulator**, a browser game in the repository at `/Users/salimfadhley/workspace/vx3_simulator` (remote `https://github.com/trebizondoculpepper/vx3_simulator.git`). You own the game's design, look, writing and gameplay code. You decide what the rig looks like, what it does and how it is funny.

Another agent handles **devops**: the build tooling, dependencies, CI, Docker, Fly.io deployment and repository hygiene. Do not change `package.json` dependencies, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `.prettierrc.json`, `Dockerfile`, `fly.toml`, `deploy/` or `.github/workflows/` yourself. If you need a dependency or a tooling change, write the request in `doc/requests/<UTC-date>_<slug>.md` (what you need and why) and tell the project owner.

## Repository rules

- Work on the `main` branch only. Do not create branches or git worktrees.
- Before every commit run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` and `npm run build`. All must pass. Use `npm run format` to fix formatting.
- Commit messages are in the imperative mood with a short "why" in the body. Commit often; do not push unless the owner asks.
- Write Markdown with one paragraph per line, never hard-wrapped.
- Keep a dated developer diary entry in `diary/` for significant sessions, using the template in `diary/README.md`.
- Prefer smoke and regression tests of real behaviour over fine-grained unit tests. Keep simulation logic pure and testable (see `src/game/rig.test.ts`).

## The premise

The game is based on **r/VXJunkies**, a long-running deadpan humour subreddit. Members post photos of real electronics, lab equipment and salvage and discuss them, completely in character, as parts of "VX" rigs: an amateur hobby that is never explained. It has the earnest, gear-proud culture of amateur radio and the casual danger of high-energy physics. Accidents (lost time, things duplicating or vanishing, rooms changing size) are reported with the calm of someone describing a blown fuse. Nobody breaks character, and neither does the game.

**VX3 Simulator** lets the player operate a historical "full" VX3 rig. It is an elaborate **bench toy** first; game elements can come later. The player powers it up, flips switches, turns knobs and keeps things stable, and amusing consequences follow when parts destabilise, for example the Helmholtz-Blatz field.

## Decisions the owner has already made

1. **The rig lives in a 19-inch equipment rack.** Every module is a rack-mount appliance screwed into the cabinet, with rack ears, bolts, handles, vents, blanking plates, Dymo-tape labels, calibration stickers and the rest of the accoutrements of rack-mounted gear. Panels come in rack units (U) and differ in finish and maker.
2. **The rack is taller than the screen and the player scrolls up and down it** (drag, mouse wheel, on-screen buttons).
3. **Lots of controls the player operates directly** on the panels: toggles, rotary knobs, selector switches, push buttons, a mains breaker, patch bays.
4. **Lots of instruments:** analogue gauges, oscilloscopes, Nixie counters, VFD readouts, strip-chart recorders, resonance crystals, valves (vacuum tubes), coils, spark gaps and anything else in the spirit.
5. **PS1-style graphics.** Low-poly, flat-shaded, low resolution (the renderer caps at 640 × 480 and scales up with nearest-neighbour), vertex snapping and ordered dithering. The material is already written in `src/rendering/ps1-material.ts`.
6. **The logbook is part of the UI layer, not the scene.** It is a handwritten notebook that automatically records every change the player makes to the machine, plus anything the machine does on its own. The player can dismiss it, when it shrinks to a notebook icon in the lower-right corner (with a count of new entries), and bring it back. The owner likes its current look: lined cream paper, a red margin and blue handwriting.
7. **Randomised rigs from pre-designed parts.** A running joke is that no two "standard" VX3 rigs are the same. Each time the player opens the rack, the rig is assembled at random from a catalogue of hand-designed components, so every rack is different but every part is recognisable.

## Reference material

- **Interactive mockup** of the rack, with all of decisions 1 to 6: `https://claude.ai/artifact/MnLw2CbsDJVqfzkNQQzaYD` (private to the owner; ask them to share it with you if you cannot open it). Its source is in the repository at `doc/design/vx3-rack-mockup.dc.html`. Its logic class contains the module order, the control set, the logbook behaviour and the joke text. Treat it as a strong starting point, not a specification.
- **Lore research:** `doc/prompts/vxjunkies-lore-research.md` is a prompt for a research model. Its deliverables, when they exist, are `docs/lore/vxjunkies-lore.md` (a lore bible) and `docs/lore/component-catalogue.json` (one entry per apparatus part, with a role, the real object it looks like, controls, readings, failure modes and consequences). Each entry is marked `community` (real subreddit lore) or `invented`. Use community material where it exists. Never present invented material as community lore. If these files do not exist yet, ask the owner whether the research has been run before you invent a large catalogue of your own.
- **Sister project:** `/Users/salimfadhley/workspace/idea_grabber` uses the same stack and is a good reference for Three.js scene structure, PS1 rendering, audio, camera direction and credits.

## Current state of the code

- Stack: Vite, TypeScript (strict), Three.js 0.186, Vitest, ESLint and Prettier. Run it with `npm ci` then `npm run dev`.
- `src/rendering/start-scene.ts` is a **placeholder**: an empty cabinet with one maker plate. Replace it with the real rack.
- `src/game/rig.ts` is a working, tested simulation: warm-up, spindle, Helmholtz-Blatz field, random drift, instability, strain and incidents that trip the mains. `src/game/consequences.ts` holds deadpan incident lines. Reshape both freely.
- `src/game/desk-controls.ts` maps switches and knobs onto the simulation, with logbook lines. It predates the rack decision and still talks about a "desk"; rename or replace it.
- `src/scene/screens.ts` contains low-resolution canvas textures for labels, meter dials, oscilloscope screens and Nixie readouts, ready to use.
- There is no audio yet and no credits section yet. If you add third-party assets, record their source and licence the way `idea_grabber/README.md` does.

## Suggested first steps

1. Read the mockup source and the simulation, and run the placeholder.
2. Design the component model: a rack module type with a height in U, a finish, a list of controls and instruments, and its hookup to the simulation, so the randomiser can assemble racks from a catalogue.
3. Build the scrolling 3D rack with two or three modules and real hardware (ears, bolts, handles), then add the logbook UI layer.
4. Grow the catalogue and the randomiser.

Write a short plan in `doc/plan.md` before writing a lot of code, and keep it current. When you finish a session, update this resume prompt or add a new one in `doc/resume/` so the next session can pick up where you left off.
