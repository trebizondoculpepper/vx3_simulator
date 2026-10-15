# Development Diary Entry - 2026-10-15

## Context

- **Date**: 2026-10-15 01:45 UTC
- **Branch**: main
- **Commit**: 829d336 (before this session's commit)
- **Contributors**: creative lead agent + owner

## Problem Statement

The owner asked for every gauge, meter and display to mean something, then made it a project rule: no fabricated readings. Cabinets A and B were the gap: thirteen instruments ran on a made-up drift (`wander()`), and several lamps were simply lit or blinking whenever a cabinet had power. Alongside that: decorative cupboard interiors for the east board, a downloadable state report for debugging, distortion that fades with distance from the rotor, and cabinet sound that makes the machine seem to come to life.

## Our Approach

- Give the column rig a `read(id)` hook into the world model and bind every cabinet instrument to a vertex, relabelling where the old legend described something else. Repeating a quantity the east board already shows is allowed.
- Remove the drift entirely: the developer room's unhooked copy reads a cold world of its own, so it shows zeros rather than invented values.
- Keep the state report a pure function in `src/game/` so it can be tested, and wire the download in the lab.
- Scale every screen-wide distortion by one exposure factor from the camera's distance to the rotor.
- Gate each cabinet's sound by that cabinet's own power in the model, not by the drive's breaker.

## Implementation

- `src/scene/ferrocore-column-rig.ts`: the `read` option; `led`, `lamp` and `bars` take a model condition or value; A1's channel modules named by circuit with fault LEDs from the alarm windows; A2's LCD shows SOLL, IST and DELTA; B6's gauge is now DREHZAHL IST with the spindle's red line; B8 shows energy in Wh and the devices' stored heat. The full mapping is in `doc/design/control-graph.md` under "Cabinet instruments".
- `AGENTS.md`: the rule "No fabricated readings".
- `src/scene/control-cabinet-interior.ts`: the ENERGIE and STEUERUNG cupboards as 1970s mounting plates (fuses, contactors, transformer, selenium rectifier, card cage, timers, plug-in relays, pin board, ducts, terminals, earth bar, glands, a laced loom), merged per finish.
- `src/game/state-report.ts` and the lab's Save State button: a Markdown report of the summary, alarm windows, controls, every model value by system, the room, the log and the printout. `vx3Walker.stateReport()` returns it in development.
- `src/game/effect-settings.ts`: `fieldExposure`, full within 1.5 m, inverse square beyond, zero at 10 m, applied to precision, divergence, warp, π and the phaser.
- `src/audio/sound-engine.ts`: two cabinet sources at the cabinets' feet, each with a faint transformer hum, a cooling fan of its own tone that spins up and runs down, and a power-on beep (A: two high pips; B: a falling chirp). The fluorescent tubes are a quarter as loud.

## Outcomes

- All five checks pass (310 tests).
- At full power the cabinets read real values: crucible 610 °C, evaporators 240 and 260 °C at 600 W, field inductance 35.2 MH, energy in Wh.
- The effects are full at the safety notices (1.4 m), about 40 % at the column view (2.3 m) and under 1 % in the museum.
- Sound levels were set by the owner's ear; they could not be checked headless.

## Next Steps

- The museum's working exhibits still have needles that hunt and lamps that blink on timers; decide whether the rule covers them.
- Latching buttons on the cabinets (FREI, AUTO, A) show their own state rather than a model value.
- The room-air noise has no object behind it; the ventilation duct is a candidate.
