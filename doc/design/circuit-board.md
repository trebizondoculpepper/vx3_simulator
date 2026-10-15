# The circuit board: one bay per circuit

Design note, 14 October 2026. The east board redesigned so an operator can read the installation by its systems. Built and installed in the developer room, dev0, on its west wall (`src/scene/circuit-board.ts`); not yet in the lab, where it would replace the east board.

## Why

The east board grew by accretion: three bays named for their history (KREISLAUF 1974, KANALÜBERSICHT, MESSWERTE 1986) rather than their purpose, a printed pipe diagram that matched no circuit, eighteen alarm windows in no particular order, three readings shown three times, and eighteen handles of which four did nothing and five only nudged the load meter. The owner asked for a board that is mostly informational, organised by circuit, with a simplified 1970s schematic of each and controls only for what is critical, every one labelled.

## The bays

Each bay keeps the old board's profile: a tall vertical face, a sloping ledge below it tilted back 60° and projecting towards the operator, and a lower cabinet with a louvred access hatch on a recessed plinth. The face reads top to bottom: its title; its own alarm windows; a lit mimic schematic, a lamp at each stage lit while that stage is live; its instruments; and a recorder row. The ledge carries its controls, each with an engraved plate, and BEREIT (no alarm in the circuit) and STÖRUNG (something wrong in it) lamps.

The recorder row brings back the old board's CRT and pen plotter. STEUERUNG has the green phosphor CRT showing the ferrocore's projection as it heats (FC · RAUMPROJEKTION) and the pen plotter tracing its ω; ENERGIE and XENON each have a plotter too, recording the load and the chamber pressure. The paper feeds down, the newest quarter-second at the top.

| Bay | Schematic | Alarms | Instruments | Controls |
| --- | --- | --- | --- | --- |
| ENERGIE: supply and drive | Mains, HAUPTSCHALTER, rectifier, the column's isolator, A11 NETZ and B13 rocker, the drive's contactor, heaters and drive | NETZ AUS, LAST, RAUCH, BRAND | Load kW, energy kWh | NETZ, NOT-AUS, QUITT, L-TEST |
| STEUERUNG: permit and ferrocore | Sealed, O2 = 0, xenon pressure, recirculation, FREIGABE (the atmosphere the procedure asks for; it holds nothing back), heaters warm, spindle, field locked, core at full power, VOLLBETRIEB | ABGAS, SPINDEL ROT, FELD ROT, STÖRUNG, DEHNUNG, INSTAB | Spindle, field, instability, trim IST and SOLL | ERDE, DÄMPF., RÜCKS. |
| XENON: gas | Cylinders, regulator, recirculator, the column's buffer, inlet, vessel, outlet, pump | XE FLUSS, UMWÄLZUNG, XE DRUCK, XE VORRAT, KOPF OFFEN, O2 KESSEL, KERN LUFT, KERN DEFEKT | Chamber pressure, lambda probe, line flow, buffer % | SPÜLEN |

The eighteen alarm windows are the board's existing ones, regrouped by circuit; they still flash until QUITT and burn steady while their cause lasts, and L-TEST flashes every lamp on the board together for ten seconds. VOLLBETRIEB, the big blue lamp at the end of the STEUERUNG schematic, is the first thing in the room that shows the plant fully operational.

## What it leaves out

The rectifier's HAUPTSCHALTER, the xenon regulator and the recirculator's KREISLAUF switch are in the plant room, so they are not on this board; in dev0 they are worked from the KALTSTART desk. The dead handles (BLATZ, XTAL A, B and C) and those that only nudged the load (HT, LT, AUX 1, AUX 2) are gone; SPIN and H-B, which had to stay up, are gone too.

## How it is built

Everything on it reads the world model (`src/game/world/world.ts`) and every control is a component (`src/game/world/components.ts`): NETZ and SPÜLEN are LED pushbuttons bound to the drive's breaker and the outlet, NOT-AUS, QUITT, L-TEST and RÜCKS. momentary buttons, ERDE and DÄMPF. switches. Their sounds are their own, played by the room. The panels have the realistic style's worn paint.

## Porting to the lab

It replaces `src/scene/east-control-panel.ts` and the board's handle wiring in `start-scene.ts`; `doc/runbooks/cold_start.md` (which refers to bays, handle positions and the board's pictures) and `doc/design/control-graph.md` need rewriting with it. See the port brief, `doc/resume/2026-10-14_world-graph-port-mission.md`, step 4.
