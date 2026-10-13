# Development Diary Entry - 2026-10-13

## Context

- **Date**: 2026-10-13 18:30 UTC
- **Branch**: main
- **Commit**: a2b519d (uncommitted work on top)
- **Contributors**: creative lead agent + owner

## Problem Statement

With the first-generation VX3 retired to dev3, the owner asked for the second generation, the ferrocore column from the developer room, to be put in the lab and wired into the console, the xenon circuit, the control circuit and the indicator panel; for the lab safety notice board to move to the wall left of the computer desk; and for a prompt asking the other agent to check that a cold start is possible, with every needed control present and wired, every control and indicator properly labelled, and every part of the right kind.

## Our Approach

The lab's systems were all built round the first rig's model. Rather than run two models side by side, the column's model became the lab's machine, and each system was pointed at it through small pure functions in `src/game/gen2-wiring.ts`, tested on their own. The east board keeps its 1974 and 1986 legends; its channels are given the column's nearest quantities.

## Implementation

- The column stands in the bay, its back to the north wall, beside the desk, built in metres and scaled to the lab. Its clickable controls are lab inputs (`VX3 gen2`), with the lab's own sound cue for each kind of control.
- Control circuit: `gen2Powered` needs the plant master, the east board's NETZ contactor and the column's own NETZ and isolator. NETZ is refused without the plant master and drops when it opens.
- Xenon circuit: `feedFromLine` refills the column's buffer from the plant room's line at 2 SLPM or more.
- Console: NETZ, NOT-AUS, SPÜLEN (the outlet), RÜCKS. (fresh core, full buffer) and QUITT work the column. The board reads it through `BoardInputs.gen2`: annunciators, alarms, grid, meters, IST and SOLL pointers, readouts.
- Indicators: `stepTelltaleOutputs` lets the wall meter and crystal take the column's load (`gen2PowerKw`) and activity (`gen2Activity`), which also drives the room's anomaly effects.
- The safety notice board moved to the north-west corner, left of the desk.
- `doc/resume/2026-10-13_gen2-cold-start-audit.md` is the prompt for the other agent.

## Outcomes

A scripted cold start through the model (plant master, xenon regulator, board NETZ, head down, clamp, purge, pressurise, heat) reaches full power in the lab with no failure, and the board, meter and room respond. But nothing on the column sets the core's activation temperature or brightness, so a player cannot yet finish a cold start; the audit brief names this first. Typecheck, lint, format, tests and build pass.

## Next Steps

The audit: a set point and brightness control, real labels, designated indicators, and wiring the column's decorative controls that a cold start needs. Then the column's sounds in the lab, the Cub's pages, new duties for the board's remaining handles, and the overheat and fire mission on the column.
