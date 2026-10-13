# Development Diary Entry - 2026-10-13

## Context

- **Date**: 2026-10-13 00:45 UTC
- **Branch**: main
- **Commit**: aee8b34 (work uncommitted at time of writing)
- **Contributors**: Claude Code + User

## Problem Statement

Once the lab and the plant room both started with their lights off, the user reported that the doors looked black from the corridor and seemed impassable. They also reported that the plant room's south wall flickered when turning, and that the plant room's signs and gauges stayed bright with its light switch off, although they are not light sources.

## Our Approach

The doors still opened and could be walked through, both locally and on the live site; the problem was lighting. The scene's fill lights follow the lab's switch, and the corridor makes up the difference with emissive light on its own surfaces. The doors belong to their rooms, so they went dark with them. The user asked that the doors use the corridor's lighting when the viewer is in the corridor.

## Implementation

- `lab-room.ts`: a steel lining now covers the doorway's reveal and the 7 cm margin the corridor's cladding leaves round the opening. The door leaves and the lining take the corridor's compensating glow (0.55 × darkness, as in `corridor.ts`), but only while `update`'s new `fromCorridor` flag is set.
- `plant-room.ts`: the door gets its own copies of its shared-by-colour paints, so that brightening it leaves the room alone. A head lining joins the jambs, and they share the door's compensation through a new `labDark` argument to `update`. A `lightLevel` getter reports the room's own lighting.
- `start-scene.ts`: `inCorridor()` checks the walker's position against the lab's south wall face.
- `ps1-material.ts`:
  - A new `plantLight` uniform.
  - `dimPrintedWith()` makes every printed surface (an unlit material with a texture) under the given roots dim with a chosen room's light. Plain-coloured glows such as lamps and the arc keep their light.
  - The plant room, rectifier, recirculator and xenon bank use it, except for meshes on the corridor side of the wall. Signs on the plant room door follow whichever side the viewer is on.
- `corridor.ts`: the corridor's north wall over the plant room was a full-thickness block whose back face lay exactly on the plant room's south wall face, which caused z-fighting. It is now 4 cm thinner on that side.

- Room culling (follow-up request): from inside the lab nothing in the plant room is drawn, and the reverse. From the corridor both are drawn, since both doorways face it. The rule is a pure function, `visibleRooms()` in `src/game/room-visibility.ts`, with tests. It uses the same `roomAt` floor-plan test as the audio. In `start-scene.ts` the lab pieces that sat straight in the scene (rack, machine glow, discharge light, heat plumes and flames) moved under the `lab` group with `attach`, keeping their world positions. The plant room is its group plus the rectifier, recirculator and xenon bank. Visibility is set each frame after collision has been gathered, because the walker's footprints come from visible meshes on the first frame. Three.js already skips meshes outside the camera's view, but it has no idea of walls, so this is a coarse room-by-room layer on top.

- Plant room lights (follow-up report: the switch only made the room slightly less dim). The plant room's tubes were plain painted boxes, and its single 6 m point light was weak next to the lab's. The lab's real brightness comes from the scene's ambient and directional fill, which followed only the lab switch. Now the tubes share a glow material that lights with the switch, and each fitting carries its own lamp, as in the lab. Since rooms out of sight are no longer drawn, the fill lights follow the room the viewer stands in (`fillLevel()` in `start-scene.ts`): the plant room's switch in there, the lab's everywhere else. The corridor's compensation follows the same level. Screenshots confirm the dark room, then the lit room with glowing tubes after switching on.

- Trip clues (follow-up request): when strain trips the breaker, the teleprinter now prints a fault report before the deadpan consequence line. `rig.ts` records how much of the strain came from the field off equilibrium and how much from outside hazards (`strainFrom`, bled proportionally). The incident event carries a `TripReport` snapshot, taken before the reset, of the trim error, NULL offset, drift, GND?, RATIO and BAND against field. `src/game/trip-report.ts` (`tripClues`) turns it into hints rather than instructions. It names a dry xenon circuit with its flow when that dominated, and for a wandering field says which way BLATZ TRIM was out and whether NULL, an open GND? under heavy drift, or RATIO played a part. It also flags a BAND far from the field, which slowed recovery. Tests cover both the attribution in `rig.test.ts` and the wording. A forced trip in the browser printed the report as expected.

- Bench apparatus (from the user's photos of home-built contraptions). `src/scene/bench-contraptions.ts` puts three baffling machines on the west bench, between the vice and the cassette player: a resonator board (lit valve, ribbed black cone, globe gauge, dish, whip antenna, looping pink leads), a copper solenoid on a box of dials with a green meter and two bulbs, and an open coil cabinet (two ribbed coil stacks, a silver box under a big bulb, a circuit board, a sprawl of wire). The bulbs have modelled filaments: a coiled glowing wire on two supports inside a clear globe, and the valve has a glowing hairpin heater. Each machine has a mains lead from the back of its base to a plug in its own trunking socket. Every lead is sampled and lifted wherever it would dip into a base or the worktop; a browser check of all 1,235 lead samples found none below the surface. Clicking a machine switches it on or off and writes a log note. Running, the resonator's valve warms, its dish sweeps and its gauge hunts. The solenoid's bulbs take turns, a ring of light climbs the coil and the meter swings. The cabinet's big bulb surges, rings climb each coil stack, the caps spin and the board's lights blink. Reduced motion holds everything steady. `bench-contraptions.test.ts` checks that the machines keep apart, stay clear of the vice and the cassette player, and each have their own socket. Concept plates for further Frankenstein-lab apparatus (a climbing-arc ladder, a filament bell jar, a knife-switch board, discharge globes, a resonance coil and a Leyden battery) were published as an artifact for the user.

## Outcomes

- Headless screenshots confirm that from the corridor both doors, their linings and the plant door's hazard sign are lit. From inside a dark room they are dark, and the plant room's signs and gauges dim with its switch.
- All checks pass (142 tests).
- The z-fighting fix was made from the geometry and not confirmed visually, because the dark plant room hides the flicker in screenshots.

## Next Steps

- Standing in a doorway counts as the corridor, so the fill switches at the threshold. If that ever shows as a jump, the fill could ease between rooms.
