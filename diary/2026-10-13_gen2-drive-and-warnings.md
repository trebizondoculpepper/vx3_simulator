# Development Diary Entry - 2026-10-13

## Context

- **Date**: 2026-10-13 22:30 UTC
- **Branch**: main
- **Commit**: 4c7665f (uncommitted work on top)
- **Contributors**: creative lead agent + owner

## Problem Statement

An audit found that most of the lab still read the retired first rig's model, which nothing could switch on any more, so overheat and fire, the Cub's pages, the machine's sounds, the xenon hazard and the board's drive handles were all dead, and several warnings had no indicator. The owner chose to keep the old game model and adapt it to the second-generation machine, with new rules: the heaters and ferrocore only run in a purged xenon atmosphere at sufficient pressure with the recirculator on; and the warnings belong on the east board's top row of lights.

## Our Approach

The drive model (`rig.ts`) became the column's ferrocore drive, as the other agent's `cold-start.ts` had already sketched: the drive heats the core (`driveTemperature`), and an atmosphere permit gates it. Every warning became one of eighteen named alarm windows on the board.

## Implementation

- `rig.ts`: a `permit` control; without it the heaters, spindle and field run down.
- `gen2-wiring.ts`: `atmospherePermit` (sealed, purged, working pressure, recirculator on), `lineFlow` (xenon reaches the machine only through the recirculator), `feedFromLine`.
- `control-board.ts`: `annunciators` (eighteen windows, three bays: drive, vessel, plant and room) and `warningConditions`, through the existing flash-until-QUITT sequence; the grid, meters and readouts read the drive again.
- `ferrocore-column-rig.ts`: a `drive` hook-up. DREHZAHL, FELD, TRIMM (the old FOKUS, ABL. X, ABL. Y), UNTERSETZUNG on the KERN panel, HT and LT under HV FIL, ZÜND, the SCHWEBUNG band selector, AUS and STRAHL STOP trips, XE-REGLER − and + to the plant regulator, the cabinet rocker in the supply; STÖRUNG flashes on a core warming in air.
- `start-scene.ts`: NETZ closes the drive's breaker (needs the plant master and the column's switches); the drive heats the core; a vessel catastrophe trips the breaker with sound; telltales, overheat, fire, anomalies, the Cub and sounds follow the drive.
- Cub: a HEIZUNG GESPERRT page, and the drive-off page now points at the east board's NETZ.

## Outcomes

A cold start through the real controls in the lab works: NETZ on shows HEIZ. GESP., KOPF OFFEN, XE FLUSS and UMWÄLZUNG; once the vessel is lowered, clamped, purged and pressurised with the recirculator on, the heaters warm, the core glows at about 1330 K, and the drive takes it on. Typecheck, lint, format, 207 tests and the build pass.

## Next Steps

The column's labels are still placeholders (the audit brief). The remaining decorative controls on the column (PRÜF, KAL, TEST, channel buttons, the supply panel's A/B/C) are spare.
