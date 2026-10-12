# BBC Micro model and diagnostic screens

The computer is original scene geometry based on the owner's reference photographs and the [Science Museum Model B record](https://collection.sciencemuseumgroup.org.uk/objects/co64142/bbc-model-b-microcomputer), which lists 410 mm width, 345 mm depth and 75 mm height. The case has a bevelled side profile and sloping dark keyboard well; the keycaps, red function row, brown cursor cluster, lock indicators, BBC strip and owl, vents, sockets and rocker are modelled individually. A separate cream-and-black 5¼-inch disk drive has a slot, guides, locking paddle, feet, vents, rear lead and an output-only activity lamp. The abstract calibration block with three oval knobs has been removed.

The [boot audio record](../../../src/audio/assets/README.md) identifies the exact two-second recording. Clicking the BBC clears its screen and reboots its software; it leaves all machinery settings intact. Blank, ROM, BASIC and disk-loading phases precede the diagnostic pages. Resetting again replaces both the current boot and any playing boot sound.

The [screen gallery](../../../public/screens/bbc/index.html) contains ten pre-rendered 320×240 SVG frames with original German text. The Cub loads these assets, overlays live readings and keeps the advice visible while a small attention marker flashes. The frame content is maintained in [bbc-pages.json](../../../src/game/bbc-pages.json); regenerate assets with `node scripts/render-bbc-pages.mjs`.

| Frame         | Trigger and clue                                                            |
| ------------- | --------------------------------------------------------------------------- |
| master-off    | Switch on HAUPTSCHALTER in the plant room. The computer has its own supply. |
| rack-off      | Close the rack breaker, then let the valves warm.                           |
| xenon-low     | Open the cage and increase flow to at least 2 SLPM.                         |
| speed-high    | Reduce SPEED; check xenon and the governor limit.                           |
| heaters       | Wait for warm valves. Keep field excitation low.                            |
| drive-off     | Switch SPIN on at the drive.                                                |
| governor      | Raise the governor LIMIT above zero.                                        |
| drive-ready   | Increase drive SPEED gradually and observe the six-core drum.               |
| starting      | Wait while the spindle accelerates.                                         |
| cores-turning | Acknowledge actual powered rotation with sufficient xenon.                  |

The successful rotation screen is a clue milestone for the proposed first win. It does not invent a reward system or require field excitation merely to make the drum rotate. Tests exercise real heater/spindle progression, hazards, page selection, reset timing, layout bounds and asset/content consistency.
