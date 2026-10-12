# Development Diary Entry - 2026-10-12

## Context

- **Date**: 2026-10-12 08:20 UTC
- **Branch**: main
- **Commit**: 037a41b (work uncommitted at time of writing)
- **Contributors**: Claude Code + User

## Problem Statement

The user asked for PC-shooter controls (mouse look, WASD, Shift), a working door to the lab, and a long, dimly lit corridor outside it, where the game now starts, facing north at the door. The conceit is a reconstruction of the VX3 facility on level −2 of the Helmholtz building at the University of Leipzig. Two more requests arrived during the session: a busy basement ceiling of ducts, pipes, trunking and cable trays in both spaces, and a tool board on the lab's south wall next to the door with a wrench, screwdrivers, pliers and an emergency machete.

## Our Approach

Each new feature lives in its own module, with small hooks in `src/rendering/start-scene.ts`, because the creative lead edits that file too. Collision is a pure floor-plan function that can be tested on its own. The walkable footprints are not hand-authored: they are collected at the first frame from every visible mesh that crosses the band between knee and head height. Future furniture therefore blocks the walker automatically. The door is excluded and handled as its own moving blocker, and hoses (`TubeGeometry`) are excluded so the walker can step over them.

## Implementation

- `src/game/walk-collision.ts` and its tests: `slide()` moves the walker one axis at a time, so it slides along walls. It splits long steps so a fast walker cannot tunnel through a thin wall, and a walker caught inside an obstacle can always step back out.
- `src/scene/lab-room.ts`: the double door is now two hinged leaves that swing into the room, with pull handles on the corridor side. The module exposes `door.toggle()`, `door.blocking` and the door's footprint. Ceiling services were added to the roof group.
- `src/scene/corridor.ts`: an 80 m corridor 2.4 m wide and 3 m high. It has lino, a dark dado, closed doors to other rooms, "EBENE −2" stencils and the Universität Leipzig / Helmholtz-Bau signs. Its single-tube fittings sway; only the four nearest the lab cast light, one tube is dead and one stutters (no faster than three flashes per second, and frozen under reduced motion). In the perspective view, fog fades both ends to darkness.
- `src/scene/ceiling-services.ts`: reusable runs of rectangular and round ducts, painted pipes with clamps and valves, cable trays with cable, trunking and conduit, all on drop rods and sharing materials by colour.
- `src/scene/tool-rack.ts`: a pegboard shadow board with painted outlines, a wrench, five screwdrivers, pliers and a machete under an "EMERGENCY ONLY · SEVER MAINS FEED" sign. Clicking a tool writes a note in the logbook.
- `start-scene.ts`:
  - Mouse look runs under pointer lock. WASD and the arrow keys walk, Shift runs, C crouches, and click or E uses whatever is under the crosshair; the crosshair highlights usable things. The door only works within 2.8 m.
  - If the browser refuses pointer lock, dragging looks around instead, and touch screens drag to look and tap to use. The on-screen arrow buttons step the walker.
  - The isometric view keeps its old orbit.
  - Development builds expose `window.vx3Walker` so browser checks can position the camera.

- Follow-up requests: `src/scene/west-workbench.ts` adds a 3.6 m hardwood-topped bench along the west wall, starting clear of the xenon bank. It has drawers, a vice, a shelf of boxes and socket trunking. In the south-west corner it has a hollow glazed sink with a swan-neck tap that runs when clicked. Because the sink took that corner, the tool board moved to the east side of the door, and it gained a hand trowel (tool name `trowel`) for the future cadmium-chip bin and chute.

- Touch controls (the user chose twin sticks, visible only for touch): `src/ui/touch-sticks.ts` adds the two sticks. The left one walks at its deflection and runs when pushed to the rim; the right one turns the head faster the further it is pushed. Each stick captures its own finger, so a tap anywhere else uses the apparatus; dragging outside the sticks does not look around. The overlay carries `data-input` (touch or mouse, starting from `(pointer: coarse)` and then following the last pointer used) and `data-view`. CSS shows the sticks only in touch first person, hides the step buttons there, and keeps the logbook and its tab clear of the right stick. The `stickVector` dead-zone mapping has its own tests. A phone-sized headless run with real CDP touch events confirmed walking, the door stopping the walker, tapping the door open, and running and turning with both thumbs at once.

- Light switch (after commit 5df3123): a rocker on a Bakelite plate, just west of the door frame on the lab side. A double door is hinged on both jambs, so neither side is hinge-free; the west side was chosen because the tool board is on the east. It has a small amber finder neon that lights while the lights are off, and like the door it works only within reach.
  - Switching off takes the lab's tubes, their point lights and the scene's fill lights (ambient and both directionals) to near zero. Printed unlit surfaces (labels, posters, dials) now dim with a shared `roomLight` uniform in `ps1-material.ts`. Materials created with the new `glow` flag keep their brightness: screens, nixies, the bay's glow nodes, the EXIT sign, the tubes, and the corridor's signs and tubes.
  - Indicator lamps are lit materials, so they are registered with `glows()` and given an emissive equal to their colour squared. Lit lamps glow and unlit ones stay nearly black. While the mains is on, a teal point light in front of the rack supplies the machine's glow.
  - Switching on, each tube strikes independently: a random delay, then two to four starter blinks of at least 0.52 s per cycle, then steady. Each tube's lamp and the room fill ease between states, so the tubes blink crisply while the room brightens in stutters rather than flashes. Reduced motion lights them at once.
  - Because the fill lights are global, the corridor compensates with emissive light in proportion to the lab's darkness. It looks nearly the same either way.

- Busier ceilings (after the light switch): `ceiling-services.ts` gained:
  - **Pipe fittings.** Inline gate valves with red handwheels alternate with ball valves with yellow levers, and both have flanges and bolts. Every 3.6 m there is a white identification band and a flow arrow on the pipe's underside. Every second band has a DIN-style medium label (DRUCKLUFT · 6 BAR, KÜHLWASSER, HEIZUNG, XENON · 4 BAR toward the rack). The labels alternate in direction, so one reads upright from either side.
  - **Pipe branches.** Each one tees down, drops below the other services and turns across. It either ends in a ball valve and blank flange, or passes into the wall through a sleeve plate.
  - **Ventilation.** Silver foil-clad ducts, both round and rectangular, with strap bands and band hangers. Spigots carry volume dampers down to slatted supply grilles.
  - **Sprinklers.** A wet sprinkler main has pendant heads on drops, each with a brass frame, a red glass bulb and a deflector.
  - **Detectors.** Optical smoke and rate-of-rise heat detectors whose red LEDs wink for 0.15 s every six seconds, each on its own phase. The LEDs are glow materials, so they show in the dark lab.
  - **Lab layout.** The round duct became a silver clad duct with two grilles. A compressed-air drop and a cooling-water drop come down over the workbench. There are two sprinkler ranges with heads between the light rows, and one line each of heat and smoke detectors.
  - **Corridor layout.** The rectangular duct is now clad, with six grilles. The air main feeds the lab through the wall just west of its door, and there are two cooling-water drops. A sprinkler range has its heads halfway between the fittings, and smoke detectors run every 7.5 m. The corridor's labels glow so the lab's switch does not dim them.

- Door plate (from the user's "Door sign" email): the small placeholder plaque east of the lab door became the room's original plate. It is drawn on one canvas in `corridor.ts` as cream enamel in a brass frame at eye level, reading KARL-MARX-UNIVERSITÄT LEIPZIG / Sektion Physik / VERSUCHSLABOR -02 17 / Experimentelle Vektor- und Feldtechnik / Zutritt nur für befugtes Personal, with the warning in red. Thin strokes vanish in the PS1 dither, so every line is bold and the rules are 3 px.

## Outcomes

- All 37 tests pass, and typecheck, lint, format and build are clean.
- A headless Chromium walkthrough (Playwright with SwiftShader) confirmed:
  - the spawn view of the door;
  - opening the door by clicking it;
  - walking in until stopped at the rack face;
  - the busy lab ceiling, the tool board and the isometric view.
- The user's Chrome window reported `visibilityState: hidden`, so `requestAnimationFrame` never ran and screenshots there were stale. Headless Chromium avoids this, and pointer lock is refused there, which also exercised the drag fallback.

## Next Steps

- Interaction reach applies only to the door; rack controls can still be used from across the room.
- The corridor's other doors are scenery and could later lead somewhere.
- Ceiling services do not yet avoid every light fitting in the lab; the deep runs use the gaps between fittings, but the shallow pipes pass above the fittings' hanging rods.
