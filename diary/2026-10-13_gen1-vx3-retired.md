# Development Diary Entry - 2026-10-13

## Context

- **Date**: 2026-10-13 17:30 UTC
- **Branch**: main
- **Commit**: a2b519d (uncommitted work on top)
- **Contributors**: creative lead agent + owner

## Problem Statement

The owner asked for the original VX3 (the 42U rack, the side cabinet and the ferrocore drum) to be copied into a new room, dev3, with a sign saying it is the first-generation VX3, retired after dangerous faults in the turbo-encabulator; for screenshots of the lab to be taken; and for the old machine then to be removed from the lab, leaving its space blank.

## Our Approach

Rather than hide the machine in the lab or duplicate the 3,400-line lab hub, its construction was moved out of `start-scene.ts`, verbatim, into its own module, `src/scene/gen1-vx3.ts`, behind a narrow hookup: the rig and rack controls, input and indicator designation, sound cues, the log, and the mains, toggle, reset and purge handlers. The lab no longer calls it; the new room does.

## Implementation

- `src/scene/gen1-vx3.ts`: `createGen1Vx3(hookup)` builds the rack, its ten modules and inspection bay, the drum and its conduit, the side cabinet and its conduit, the wall socket and mains lead, and the machine's own glow, in the lab's coordinates. It returns the group, its per-frame update (lamps, needles, screens, valves, drum spin) and its sound sources. `GEN1_TOTAL_HEIGHT` stays the lab's floor datum; `GEN1_RACK_Z` and `GEN1_SIDE_CABINET` mark the empty bay, where the overheat smoke and discharge still appear.
- `src/rendering/gen1-room.ts`: room dev3, a plain gallery round the machine with a brass rail and a sign on a stand. At first it ran its own rig and sound engine; the owner then said it need not work, only be kept as an archive, so it is unwired: the rig is never stepped, it makes no sound and nothing is clickable. `window.vx3Dev3` places the viewer for checks.
- `start-scene.ts`: the machine and its sound sources are gone. The rig model still runs behind the east board, wall meter, crystal and fire mission; the machine's own sounds have no source in the lab, so they are silent.
- Screenshots of the lab with the first rig are in `doc/art/gen1-vx3/`.

## Outcomes

The lab loads with the bay empty and no designation problems; dev3 shows the machine, switched off and unwired. Typecheck, lint, format, tests and build pass.

## Next Steps

Install the successor (the ferrocore column from the developer room) in the empty bay and reconnect the east board, the tell-tales, the overheat smoke and the machine sounds to it. Until then the run cannot be completed in the lab.
