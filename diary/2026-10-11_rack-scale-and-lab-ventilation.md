# Development Diary Entry - 2026-10-11

## Context

- **Date**: 2026-10-11 23:50 UTC
- **Branch**: main
- **Commit**: pending
- **Contributors**: creative lead (Codex)

## Problem Statement

The lab door appeared undersized beside the cabinet. The rack lacked a coherent physical scale, and the user asked for an exposed wiring bay, a working ventilator grille with cloth telltales, more named modules, a wider isometric view, and a larger room with a human-height perspective camera. Later visual checks exposed shallow cabinets, hidden panel branding, a low printer, and the wrong arrangement inside the companion cabinet.

## Our Approach

Treat the panel face as 19 inches wide and each mounting unit as 1.75 inches high. A 42U cabinet with enclosure margins then stands close to 2 m. Fill it with catalogue modules in functional order and retain one open inspection bay. Size the room to 4.5 m by 5 m by 2.7 m, the equipment door to 1.2 m by 2.1 m, and the starting eye level to 1.8034 m. Use [APC's 42U 600 × 825 × 1991 mm enclosure](https://www.apc.com/shop/tradeups/us/en/products/APC-NetShelter-AV-Server-Rack-Enclosure-42U-10-32-Threaded-Rails-Black-1991H-x-600W-x-825D-mm/P-AR3810), [Bisley's 3-drawer filing cabinet dimensions](https://www.bisley.com/site/assets/files/125788/bisley_-_office_filing_specification-1.pdf), and [Sylvania's 1200 mm T8 fluorescent specification](https://dynamicassets.sylvania-lighting.com/pdf/fr-be/Datasheet/0001511) as size references.

## Implementation

Expanded the ordered main rack assembly to ten named components. Added a four-unit open field-bus bay with a wire loom and power-responsive pulsing taps. Built a deeper main enclosure behind its branded panels and made the companion cabinet a 19-inch open frame holding three deep, bolted instrument blocks at the top. Moved the enlarged ferrocore drum into its open lower bay and replaced crowded companion labels with clear manufacturer and model header strips. Enlarged the room and door, added a high east-wall extraction grille with two animated fabric strips, and made the suspended lamps 1.2 m long. Widened the isometric camera and hid the ceiling roof in that view so it cannot obscure the equipment. Placed the perspective camera at 5 feet 11 inches with a 52-degree vertical field of view. Moved the emergency phone to the east wall at shoulder height and the teleprinter to waist height, leaving its output pile on the floor. A full-scene size review also resized the phone, xenon bank, workbench, ashtray, map and safety instruments, pinboard, posters, and filing cabinet, then cleared the crystal sight line by moving the bench CRT.

## Outcomes

The browser scene was inspected in perspective and isometric views, including the restored manufacturer branding, east-wall fixtures, open lower companion rack, and resized left-wall laboratory equipment. Typecheck, lint, formatting, 28 tests, and the production build passed during implementation; the final gate is rerun before commit.

## Next Steps

The separate xenon regulator work is present in the shared worktree and will be included with the final commit as requested.
