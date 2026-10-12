# Development Diary Entry - 2026-10-12

## Context

- **Date**: 2026-10-12 21:03 UTC
- **Branch**: main
- **Commit**: see the commit that adds this entry
- **Contributors**: Claude Code (creative and gameplay) + owner

## Problem Statement

The owner asked for a long run of connected changes: a perplexing, interlinked component catalogue; distance-based sound; a working east control board; a faceplate grid so instruments never overprint titles; xenon as a hazard rather than an interlock; sound that stops at closed doors; every machine part designated an input or an indicator; and no two switches or knobs sharing a value.

## Our Approach

Keep the logic in pure, tested modules under `src/game/` and keep `start-scene.ts` to wiring. Check scene work in headless Chrome over the DevTools protocol, using the development `vx3Walker` hook to place the walker and aim at controls.

## Implementation

- `doc/design/component-wiring.md` gives every catalogue device inputs, outputs, a look and a sound; 77 cross-links were added to `component-catalogue.json` with tests that every device is tied to at least two others and that a fully switched-on rig settles.
- `src/audio/spatial-mix.ts` applies inverse-square attenuation, recomputed only after the listener moves, with grid culling; `src/game/sound-rooms.ts` silences sources behind shut doors.
- `src/game/control-board.ts` drives the east board: 18 handles working the rack, an alarm sequence with QUITT, lamp test, bargraph grid, meters and readouts.
- `src/game/rack-layout.ts` lays every rack faceplate on a 12-column grid with smaller titles and a footer band, validated for every module.
- Xenon no longer prevents start: `xenonHazard` makes the bench Cub flash a Mode 7 warning above the spindle limit and builds strain through `stepRig`.
- `src/game/machine-parts.ts` designates parts as inputs or indicators; the scene uses `input()`, `indicator()` and `fixture()` and audits itself in development builds.
- The paired rack panels now have their own switches (GOVERNOR ENGAGE, PLASMA, DETECTOR BLATZ and the chromocore bank), each monitor's BLATZ switch gates its own trace, and the xenon contents needle falls with use.
- The lab is a recreation of a real facility at the University of Leipzig, not a historical reconstruction; the corridor sign saying so was removed.

## Outcomes

All checks pass. The east board, rack grid, xenon warning and part audit were confirmed in the browser. Audio attenuation was verified by tests only, as headless Chrome has no audible output.

## Next Steps

Wire the component catalogue model into the visible rack; give the BAND selectors, GND? and RATIO an obvious machine effect; publish a graph of all controls; consider the lighting improvements discussed (lower ambient, hemisphere light, bloom).
