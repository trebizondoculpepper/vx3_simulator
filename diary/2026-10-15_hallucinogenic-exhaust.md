# Development Diary Entry - 2026-10-15

## Context

- **Date**: 2026-10-15 12:00 UTC
- **Branch**: main
- **Commit**: 1f4606d and the commit after it
- **Contributors**: Claude Code (gameplay code) + owner

## Problem Statement

The owner wanted dev4's hallucination effects (ghosting, apparitions, geometric patterns) to become what an improperly operated VX3 does to the people in the lab. The in-world explanation: a ferrocore's temporal and electromagnetic disturbance, run in a fouled atmosphere, goes into its exhaust gas, which is powerfully hallucinogenic. The owner set the tone: this is 1970s bleeding-edge technology in the spirit of Chernobyl, with no interlocks; improper operation is allowed and has consequences. Running with the clamps open should show smoke at the vessel's seal and stain its upper section with soot.

## Our Approach

The drive's atmosphere permit used to hold the heaters off until the vessel was sealed, purged, pressurised and recirculating. It now only lights FREIGABE. A little fouling and a lot are one failure by degree (the owner's ruling), so a core in air no longer burns out; burnout is kept, unreachable, for running with the head raised, which the owner will design later. The exhaust is a pure model (`src/game/exhaust.ts`): fouling from oxygen above a finished purge or xenon short of working pressure, emission by the worst route out (fouling, the open outlet, the unsealed seam), a room concentration that clears over a minute, and an operator dose taken up in about twelve seconds and let go over two and a half minutes. The dose climbs a ladder: ghosting, then apparitions, then patterns.

## Implementation

The world graph gained `vessel.glow`, `vessel.fouling`, `vessel.emission`, `vessel.sealSmoke`, `vessel.soot`, `room.exhaust`, `operator.dose`, and outputs for the gas detector, the seal smoke, the soot, the hallucinations and `room.coherence` (how much of the phase effects survive fouling). HEIZ. GESP. became the ABGAS window everywhere its label appeared. New scenarios: lit before the purge, outlet left open on a running core, and clamps released at full power (now fouling, not burnout); KERN DEFEKT and the flux inductance are recorded as undesigned with their reasons, because the dry-circuit trip still drops the breaker before the buffer can empty. In the lab, `src/rendering/operator-visions.ts` bundles the three dev4 effects and their draw order, the column shows smoke round the seam and soot bands on the chamber's lip, top flange and the head's collars (`src/scene/seal-leak.ts`), and a GASWARNGERÄT beside the wall load meter reads the room's ppm.

## Outcomes

Screenshots of `?view=column&scenario=fouled` showed the soot and seal smoke, and the patterns worked into the room. The first lab test showed XOR over a dark room painting the pattern at full colour and burying the picture, so the pattern is now scaled by the brightness of what is under it and its coverage in the lab is lower. A fouled core also no longer triggers the clean core's "measured π twice" log line.

## Next Steps

The head-up disaster; which tiling style the owner prefers; the owner's apparition image; whether opening the lab door or an extractor should clear the room faster; lore for the exhaust in `doc/lore/`.
