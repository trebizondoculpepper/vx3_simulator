# Development Diary Entry - 2026-10-14

## Context

- **Date**: 2026-10-14 21:50 UTC
- **Branch**: main
- **Commit**: (this commit); the bulk of the work landed in 2a6e3dc, which the other agent committed from the shared checkout
- **Contributors**: Claude Code (gameplay and tooling agent) + owner

## Problem Statement

The owner asked whether the machine's simulation could be a directed graph of cached functions, then for one to be built on signals, with checks for unbound vertices, proof that the cold start and every failure can be reached, and a judgement on whether caching helps the displays. From there the session grew: the developer room rewired to run on the new model with a KALTSTART desk; failures recast as designed scenarios rather than searched for; a component model for every switch, with its own power, latch, state and sounds; the rooms renamed and reorganised; a faster, exponential oxygen purge; a design for lighting rooms independently; and, finally, the PS1 rendering replaced by a conventional, physically based style, starting with a brushed aluminium vessel.

## Our Approach

Keep the existing physics and add structure around it. The world graph (`src/game/world/`) reuses `stepRig`, `stepColumnPrep` and the rest as processes, and makes every link between values a declared edge, so the graph can be analysed and drawn. The owner then set three rules that shaped everything after: failures are designed, with a deducible cause and scripted steps; the world model says what is true while components own their state, looks and sounds; and sounds come from objects, never from the world model. The rendering change was made as a switchable style (`?render=ps1` restores the old look), with small, guarded edits in files the other agent was changing at the same time.

## Implementation

- `src/game/world/graph.ts`, `world.ts`: the lab as a graph on `@preact/signals-core` (added at the owner's direction; recorded in `doc/requests/2026-10-14_preact-signals-core.md`). Its eighteen alarm conditions match `warningConditions` at every step of a full run. `analyse()` finds dead controls (BLATZ, XTAL A–C), parameters no control sets, and values nothing shows.
- `scenarios.ts`: every alarm and bad end has a designed scenario; a test fails if one has none. Flux inductance has no route in the lab (the permit prevents it) and is listed as a design question.
- `components.ts`: LED pushbutton, momentary, switch, selector and key-locked selector, with transition sounds and held state sounds (`src/audio/part-loops.ts`, `src/rendering/part-sound-hub.ts`).
- Dev0 (`?room=dev0`, was `dev`): the column driven by the graph from a sloping KALTSTART desk, all components, with the lab's sound engine playing only what is in the room. Dev2 (`?room=dev2`): the CONTROL TEST parts board, all components, showing supply, interlock and state sounds.
- `column-prep.ts`: the purge reaches 0.5 % oxygen (now the purge-complete threshold) in about 20 s, decaying exponentially; the lambda probe is recalibrated to it.
- Docs: `doc/resume/2026-10-14_world-graph-port-mission.md` (porting all this into the lab) and `doc/design/room-lighting.md` (one light state per room, by declaration).
- `src/rendering/render-style.ts`: full resolution with antialiasing, smooth physically based materials, environment lighting, neutral tone mapping, soft shadows, smooth text; `src/rendering/metal-finish.ts`: a procedural brushed aluminium finish, now on the column's vessel, rims and flanges.

## Outcomes

- What worked: the graph mirrors the lab exactly; the designed scenarios run the whole suite in under a second; dev0's desk drives a full cold start and the burnout; the realistic style makes legends, scales and readouts legible.
- A Go-Explore reachability search worked but was the wrong idea: the owner wants failures designed and deducible, so it was removed, and that rule is recorded for future sessions.
- Dev0 played the mercury arc rectifier's hum in a room with no rectifier: the sound engine takes world flags. That led to the rule that sounds come from objects.
- The lab is still dim in the realistic style: its brightness now depends on the other agent's room lighting, which lights each room's surfaces by its own level. To be settled with them.

## Next Steps

Port the graph and the components into the lab (the mission brief); settle the lab's brightness with the room lighting; give other surfaces proper finishes (painted steel, enamel, bakelite) as the vessel now has.
