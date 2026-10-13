# Development Diary Entry - 2026-10-13

## Context

The owner is auditioning controls in the dev room and requested a printed name/type for every control worked, a mechanical keyboard thock for keycaps, and correction of the isolator's yellow plate and overlapping position legends.

## Implementation

The dev room displays the eight latest control uses and also prints them to the browser console. Control-test and model-drive inputs have readable names; the log uses the rig's named controls and tagged control types. Stand-in buttons and sliders are included. Entries appear even when a control is locked or at an end stop. Keycaps have their own credited mechanical keyboard recording instead of sharing the panel-button click. The isolator plate, ring and handle are centred on the enclosure; the ring is smaller and its I/O legends sit outside the circular surround and handle sweep.

Validation: typecheck, lint, formatting, all 213 tests and the production build passed. A fresh browser preview shows the control-use log and the centred isolator with uncovered position marks; screenshots are saved in `doc/design/screenshots/2026-10-13/`. The numbered test keycaps are tagged `key` and route to `key-thock.wav`. Existing user tabs were not reloaded.
