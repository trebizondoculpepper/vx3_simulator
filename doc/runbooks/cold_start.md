# Runbook: cold start of the VX3

From a dark, cold lab to a ferrocore at full power, using only what a player can see and touch.

## How the VX3 is laid out

The VX3 is the whole installation in Room −2.17 and the TECHNIKRAUM next to it:

- **The plant room (TECHNIKRAUM)**, through the door in the lab's south wall: the HAUPTSCHALTER and the mercury arc rectifier, which feeds the machine's direct-current equipment; the xenon recirculator, on the mains; and the caged xenon cylinder bank with its flow regulator.
- **The supply isolator**, on the lab's west wall at shoulder height between the Volt Xoccula advertisement and the computer desk, in grey trunking: the machine's main isolator.
- **The machine** in the bay on the north wall: two cabinets on one olive skid with the ferrocore column between them. **Cabinet A** is the grey-blue cabinet on the left, **cabinet B** the tall olive cabinet on the right. Each unit in a cabinet has a number, counted from the top, on a small tag on the cabinet's left upright beside it (A1 to A11, B1 to B13). The column's vessel stands between them; the beam tube runs from it into cabinet A's open bay, with the outlet handwheel on it.
- **The east board**, the 1974 process board on the east wall: the remote station. Its handles switch the drive, and its top row of eighteen alarm windows shows every warning in the installation.

## How the instructions are grouped

- **Power first, from the source inward.** The plant room's supply, then the isolator on the wall, then each cabinet's own supply. Each cabinet has its power in its base: A11 VERSORGUNG and B13 VERSORGUNG are the bottom units.
- **One place at a time.** Each group of steps is worked at one unit (or one board) where you stand, and says which unit and which cabinet it is on.
- **Where to look.** Most steps need you to check something somewhere else: a gauge in another unit, a lamp, or a window on the east board. These are given as **Watch** lines under the step.
- **Names match the log.** Each control is named as the operator's log names it, `machine unit: control`, so a run can be checked against the log. Room fittings (lights, doors, the cage gate) are not logged.

Knob settings are on the knobs' 0 to 10 scale. Every knob turns down one detent when clicked on its left half and up on its right half.

## The rules the machine follows

- The drive's valve heaters and the ferrocore run only in a purged xenon atmosphere: the vessel's head down and clamped, the oxygen purged out, the xenon at working pressure (1.2 bar or more), and the recirculator running. Until then the drive is interlocked, whatever its switches say.
- Xenon reaches the machine only while the recirculator runs.
- The cabinets' equipment runs on direct current from the mercury arc rectifier: with the HAUPTSCHALTER open, the cabinets are dead. The east board and the lights are on the mains.
- The core's temperature is not set by hand: the warm heaters bring it to a glow (about 1,300 K), and the drive's spindle and field take it on to full power (3,200 K and above).
- Heating the core in an open or unpurged chamber burns it out. Running a hot core with its xenon starved ends in a flux inductance catastrophe.

## 1. Lights

At the lab door, switch on the lab lights (the switch beside the door). Go through the south door into the TECHNIKRAUM and switch on its lights too.

![The lab light switch by the door](cold_start/01-lab-light-switch.png)

## 2. The plant room

Stand at the rectifier's wall in the TECHNIKRAUM.

1. `Plant-room supply: HAUPTSCHALTER`: close the master throw switch.
   - **Watch:** the rectifier strikes and glows; its NETZ and AUSGANG gauges beside the switch rise. On the east board, the NETZ AUS window goes out.

![The HAUPTSCHALTER and the rectifier's gauges](cold_start/02-hauptschalter.png)

2. `Xenon recirculator: KREISLAUF switch`: switch the recirculator on, at its housing.
   - **Watch:** its BETRIEB lamp lights. On the east board, the UMWÄLZUNG window stays dark.

![The recirculator's KREISLAUF switch](cold_start/03-recirculator.png)

3. Open the xenon cage gate, then `Xenon supply: Flow regulator`: turn the regulator on the cylinder bank up until the rotameter reads at least 2 SLPM.
   - **Watch:** the rotameter's float. On the east board, XE FLUSS stays dark once the drive is on.

![The xenon cage and the flow regulator](cold_start/04-xenon-regulator.png)

## 3. The machine's supply

Each of these starts switched off.

1. `VX3 HAUPTTRENNER: supply isolator`, on the lab's west wall: turn it on. The handle swings upright to point at I, and its window reads ON.

![The supply isolator on the west wall](cold_start/05-isolator.png)

2. `VX3 A11 VERSORGUNG: NETZ button`, in the base of cabinet A: press the red NETZ button. It lights.

![A11 VERSORGUNG in the base of cabinet A](cold_start/06-a11-netz.png)

3. `VX3 B13 VERSORGUNG: cabinet supply rocker`, in the base of cabinet B: switch the rocker on.
   - **Watch:** B13's NETZSPANNUNG voltmeter reads. Cabinet B's readouts and lamps come alive.

![B13 VERSORGUNG in the base of cabinet B](cold_start/07-b13-rocker.png)

## 4. Seal the vessel

Stand at B11 SÄULE, cabinet B's column station, low in the cabinet: crouch (C) to work it comfortably. It carries the KAMMERDRUCK gauge, the LAMBDA-SONDE meter and the DICHT, DRUCK and STÖRUNG lamps.

1. `VX3 B11 SÄULE: SENKEN button`: the rams lower the head and the core into the vessel, about six seconds.
   - **Watch:** the UNTEN lamp on B11 blinks while the head moves and burns steady when it is down; the seam between the flanges puffs as they meet.
2. `VX3 B11 SÄULE: SPANNEN button`: the four clamps close.
   - **Watch:** SPANNEN's lamp and DICHT on B11 light. On the east board, KOPF OFFEN stays dark.
3. `VX3 B11 SÄULE: XE EIN button`: open the xenon inlet. Its blue lamp lights.

![B11 SÄULE with the head down, clamped and the inlet open](cold_start/08-b11-saeule-sealed.png)

## 5. Purge and pressurise

1. `VX3 STRAHLROHR: outlet valve`: turn the handwheel on the beam tube, between the vessel and cabinet A's open bay, to open the outlet to the pump. (`East board: SPÜLEN handle` does the same from the board.)
   - **Watch:** AUSLASS on B11 lights.

![The outlet handwheel on the beam tube](cold_start/09-outlet-valve.png)

2. Wait about half a minute while the xenon flows in and the air is pumped out.
   - **Watch:** on B11, the LAMBDA-SONDE needle climbs into the green band and the O2 = 0 lamp lights.

![B11 SÄULE with the purge complete](cold_start/10-b11-purged.png)

3. `VX3 STRAHLROHR: outlet valve` again: shut the outlet.
   - **Watch:** the KAMMERDRUCK gauge on B11 climbs past 1.2 bar towards the regulator's 1.8 bar in about ten seconds.

## 6. Start the drive

Stand at the east board.

1. `East board: NETZ handle`, the first handle of the KREISLAUF bay: close the drive's breaker. It refuses, with a line in the log, if the HAUPTSCHALTER is open or the machine is switched off at the isolator, A11 or B13.
   - **Watch:** the top row of alarm windows. If anything above was missed, HEIZ. GESP. lights with the window for what is missing (KOPF OFFEN, O2 KESSEL, XE DRUCK, XE FLUSS, UMWÄLZUNG). Otherwise the valve heaters warm by themselves in about six seconds: the HEIZUNG meter rises, the log says when they are at temperature, and the core glows orange (about 1,300 K on B12 KERN's IST K readout).

![The east board, NETZ on](cold_start/11-east-board.png)

## 7. Bring the ferrocore up

Stand at B6 ANTRIEB, cabinet B's drive unit at shoulder height, with the big round gauge.

1. `VX3 B6 ANTRIEB: DREHZAHL knob`: spindle speed up to about 7. Keep it under 8.5, the SPINDEL red line.
2. `VX3 B6 ANTRIEB: FELD knob`: the Helmholtz-Blatz field up to about 7, under 8.5, the FELD red line. The field needs a turning spindle.

![B6 ANTRIEB: DREHZAHL, FELD and TRIMM on the left, HV FIL in the middle](cold_start/12-b6-antrieb.png)

3. `VX3 B6 ANTRIEB: TRIMM knob`: trim the field.
   - **Watch:** the east board's IST and SOLL pointers (KREISLAUF bay): bring IST (the trim) up to SOLL (where the field balances). At DREHZAHL 7 and FELD 7 that is about 6.5. The trim point wanders as the field drifts, so keep tending it. A good trim locks the field (the log says "H-B field locked") and keeps INSTAB down.

![The east board's IST and SOLL pointers](cold_start/13-east-board-trim.png)

4. As the drive's activity rises, the core goes from orange through white-hot to blue, pulses and spins: full power. The room reacts: colours breathe, π wanders, the walls bend, and the time-dilation crystal over the teleprinter glows and sheds particles.

![The VX3 at full power](cold_start/14-full-power.png)

## Other controls

- `VX3 B6 ANTRIEB: HT heater switch` and `VX3 B6 ANTRIEB: LT heater switch` (under HV FIL) switch the valve heaters in; both start on. `VX3 B6 ANTRIEB: ZÜND button` brings both in at once.
- `VX3 B12 KERN: UNTERSETZUNG knob` changes the spindle's gearing and moves the trim point: retrim after changing it.
- `VX3 B9 SCHWEBUNG: SCHWEBUNG key`, then `VX3 B9 SCHWEBUNG: SCHWEBUNG band selector` (key-locked, "nur mit Freigabe"), sets the insulation band, which clears strain fastest when it matches the field.
- `VX3 A7 XE-REGLER: XE-REGLER + key` and `XE-REGLER − key` step the plant room's xenon regulator from the machine.
- The east board's other handles (HT, LT, SPIN, H-B, BLATZ, DÄMPF., ERDE?, AUX, XTAL) work the drive's switches; SPIN and H-B must be up for the spindle and field to respond.

## Shut down

1. `East board: NETZ handle`: open the drive's breaker. The heaters and drive run down and the core cools.
2. In a hurry: `East board: NOT-AUS handle`, `VX3 A9 STRAHL: STRAHL STOP button`, `VX3 B3 VERDAMPFER 1: VERDAMPFER 1 AUS button` or `VX3 B4 VERDAMPFER 2: VERDAMPFER 2 AUS button`. Each trips the breaker.
3. Once the core is cold, `VX3 B11 SÄULE: XE EIN button` to shut the inlet. Leave the vessel sealed, or release `VX3 B11 SÄULE: SPANNEN button` and raise the head with `VX3 B11 SÄULE: HEBEN button`.

## Faults and recovery

| What happened                               | What you see                                                                               | What to do                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Core heating in an open or unpurged vessel  | East board KERN LUFT; B11's STÖRUNG lamp flashing; a log warning                           | Trip the drive at once (NETZ or NOT-AUS) and finish sealing and purging                                                          |
| Burnout (the core heated in air)            | East board KERN DEFEKT; B11's STÖRUNG lamp; the drive trips with a bang                    | `VX3 B11 SÄULE: QUITT button` or `East board: RÜCKS. handle` fits a fresh core and tops up the xenon; start again from section 4 |
| Xenon starved (flux inductance catastrophe) | East board XE DRUCK, then KERN DEFEKT; B11's DRUCK lamp                                    | As burnout; check the recirculator and the regulator first                                                                       |
| Strain builds until the drive trips         | East board DEHNUNG, INSTAB, STÖRUNG; a fault printout with clues                           | Retrim, bring DREHZAHL or FELD down, use the insulation band; acknowledge with `East board: QUITT handle`                        |
| Over the red lines                          | East board SPINDEL ROT, FELD ROT, LAST; the machine smokes (RAUCH); the fire alarm (BRAND) | Bring DREHZAHL and FELD down; the fire alarm is reset at the corridor panel                                                      |
| The cabinets are dead                       | No lamps or readouts in cabinets A and B; powered buttons log "no supply"                  | Close the HAUPTSCHALTER; check the isolator, A11 and B13                                                                         |

`East board: QUITT handle` acknowledges the flashing windows: an acknowledged window burns steady until its cause clears, and one that cleared before anyone acknowledged it keeps flashing until QUITT. `East board: L-TEST handle` lights every lamp.

## The east board's alarm windows

| Bay            | Window      | Lit when                                                        |
| -------------- | ----------- | --------------------------------------------------------------- |
| KREISLAUF      | NETZ AUS    | The HAUPTSCHALTER is open                                       |
|                | HEIZ. GESP. | NETZ is on but the heaters are interlocked                      |
|                | SPINDEL ROT | Spindle over its red line                                       |
|                | FELD ROT    | Field over its red line                                         |
|                | LAST        | Load over 6.5 kW                                                |
|                | STÖRUNG     | Drive incident, or instability with the drive on                |
| KANALÜBERSICHT | KOPF OFFEN  | NETZ on and the head not down and clamped                       |
|                | O2 KESSEL   | NETZ on, vessel sealed, oxygen not yet purged                   |
|                | XE DRUCK    | NETZ on, vessel sealed, xenon under working pressure or starved |
|                | XE VORRAT   | The vessel's xenon buffer under a quarter                       |
|                | KERN LUFT   | Core warming in an open or unpurged vessel                      |
|                | KERN DEFEKT | Core failed                                                     |
| MESSWERTE      | XE FLUSS    | NETZ on and under 2 SLPM reaching the machine                   |
|                | UMWÄLZUNG   | NETZ on and the recirculator not running                        |
|                | DEHNUNG     | Strain over half                                                |
|                | INSTAB      | Instability over the warning level                              |
|                | RAUCH       | The machine is smoking                                          |
|                | BRAND       | The fire alarm is sounding                                      |

## The units of cabinets A and B

| Unit       | Name                | What it is for in a cold start                                  |
| ---------- | ------------------- | --------------------------------------------------------------- |
| A1         | KANÄLE              | —                                                               |
| A2         | FC-STEUERUNG        | —                                                               |
| A3         | ENDSTUFE            | —                                                               |
| A4         | SPULEN              | —                                                               |
| A5         | HV KATODE           | —                                                               |
| A6, A7     | VARISTOR, XE-REGLER | XE-REGLER − and + step the plant room's regulator               |
| A8         | STRAHLSTROM         | —                                                               |
| A9         | STRAHL              | STRAHL STOP trips the drive                                     |
| (open bay) |                     | The beam tube enters here                                       |
| A10        | TIEGELHEIZUNG       | —                                                               |
| A11        | VERSORGUNG          | Cabinet A's supply: NETZ button                                 |
| B1         | KENNUNG             | —                                                               |
| B2         | MESSWERTE           | The core's temperature, the chamber pressure and the xenon left |
| B3, B4     | VERDAMPFER 1, 2     | AUS trips the drive                                             |
| B5         | ANZEIGE             | —                                                               |
| B6         | ANTRIEB             | DREHZAHL, FELD, TRIMM; heaters (HV FIL, ZÜND)                   |
| B7         | KAPAZITÄT           | —                                                               |
| B8         | OFFSET              | —                                                               |
| B9         | SCHWEBUNG           | The insulation band (key-locked)                                |
| B10        | RESERVE             | —                                                               |
| B11        | SÄULE               | The vessel: head, clamps, inlet, pressure, purge, faults        |
| B12        | KERN                | The core's temperature; UNTERSETZUNG                            |
| B13        | VERSORGUNG          | Cabinet B's supply: the rocker                                  |

## Checking a run

In a development build, `vx3Walker.press('VX3 B11 SÄULE: SENKEN button')` works any control by its log name, `vx3Walker.log()` returns the newest log lines, and `vx3Walker.board().lit` lists the alarm windows not at rest.
