# Cold start: the game model, its inputs and its gauges

The installation does nothing useful. The game is working out its preposterous cold start. This note records the procedure as the game model implements it, which model values should drive gauges, which operator inputs are essential, and which failure states exist for later animation. The model is `src/game/cold-start.ts`; `src/game/cold-start.test.ts` walks the whole procedure to the fully operational state and proves each failure state can be reached.

## The model

`cold-start.ts` composes the existing pure models and adds no physics of its own:

- the containment vessel (`column-prep.ts`): the head the rams lower, the clamps, the purge valve to the pump, the chamber gas as partial pressures, the xenon bottle, and the core's temperature;
- the xenon supply: the catalogue's `xenon-supply`, `xenon-flow-gauge` and `xenon-pressure-indicator` components, run by `rig-model.ts` exactly as the plant room's bank runs them;
- the plant: the mercury arc rectifier's HAUPTSCHALTER and the recirculator's KREISLAUF switch;
- the ferrocore drive (`rig.ts`): mains, valve heaters, phase spindle, Helmholtz-Blatz field, trim, strain and the breaker;
- the anomalies (`ferrocore-anomaly.ts`): colour channels breathing, π wandering, space bending and the dilation crystal's sparks.

Three rules join them:

1. The xenon flow gauge reads the gas actually moving: the purge stream (5 SLPM) while the purge valve is open, and the recirculator's loop (6 SLPM) once the vessel is sealed, the purge shut and the chamber charged. The drive's existing check, `xenonReady` (at least 2 SLPM), therefore needs the recirculator once the purge is shut.
2. The core's temperature is set by the model, never by the operator: ambient, plus 1,300 K as the valve heaters warm, plus 2,700 K with the ferrocores' activity. Warm heaters give an orange glow (about 1,600 K); full activity gives full power (3,200 K and above), where the core goes blue, pulses and spins.
3. A ruined core trips the drive's breaker.

## The procedure

On a perfect run it takes about a minute: head down at 6 s, oxygen at zero at 42 s, xenon at working pressure at 45 s, heaters warm at 51 s, fully operational at 57 s. These are prototype timings and can be stretched for pacing.

| Step | Operator input | Model transition | What confirms it |
|---|---|---|---|
| 1 | Lower the head, then close the clamps | `lift` 1 → 0 over 6 s; `clamped`; the vessel is sealed | Head position lamps; clamp lamp; sealed lamp |
| 2 | Open the purge valve | `outletOpen` | Purge valve position; gas starts venting from the purge port once the xenon flows |
| 3 | Open the xenon regulator | Delivery pressure rises to about 2 bar; the vessel's inlet feeds; the purge stream flows | Delivery pressure gauge; flow gauge about 5 SLPM |
| 4 | Close the HAUPTSCHALTER, then the KREISLAUF switch | The plant is powered; the recirculator runs but moves nothing while the purge is open | Recirculator BETRIEB lamp |
| 5 | Wait | Air is flushed out; the oxygen falls from 20.9 % to below 0.1 % in about 36 s | The lambda probe's meter swings into its green band and the O2 = 0 lamp lights; gas vents from the purge port |
| 6 | Shut the purge valve | The xenon builds to working pressure (1.2 bar, regulating at 1.8); the recirculator's loop starts | Chamber pressure gauge; flow gauge about 6 SLPM; XE RÜCKL clears |
| 7a | Mains on | The valve heaters warm over 6 s; the core reaches about 1,600 K and glows orange | Heater relay; core temperature readout; orange windows |
| 7b | Spindle and field up, trim the field to lock | The spindle and field come up; the field locks; activity rises; the core passes 3,200 K | Spindle and field meters; lock event; core temperature readout |
| Done | Keep trimming | Fully operational: `ferrocoresOperational`, sealed, oxygen zero, purge shut, core at full power, anomalies strong | An operational lamp; blue, pulsing, spinning core in the windows; the room's effects |

## Essential inputs

These are the inputs the procedure cannot be completed without. Everything else on the panels can stay decorative.

| Input | Model call | Already in the scene? | Suggested part |
|---|---|---|---|
| Head down / up | `driveHead(state, 0 \| 1)` | Concept rig only | HEBEN / SENKEN push buttons with LED windows |
| Clamps | `clampVessel(state, on)` | Concept rig only | SPANNEN latching button with a red LED |
| Purge valve | `setPurgeValve(state, open)` | Concept rig only (the beam-tube handwheel) | Handwheel valve |
| Xenon regulator | `setXenonRegulator(state, 0..1)` | Yes: the regulator knob on the bank | Existing knob |
| Plant power | `setRectifier(state, on)` | Yes: HAUPTSCHALTER beside the rectifier | Existing switch |
| Recirculator | `setRecirculator(state, on)` | Yes: KREISLAUF switch | Existing switch |
| Mains | `rig.controls.mains` | Yes: the rack's supply toggles | Existing toggles |
| Spindle speed | `rig.controls.spindle` | Yes: rack knob | Existing knob |
| Field strength | `rig.controls.field` | Yes: rack knob | Existing knob |
| BLATZ TRIM | `rig.controls.trim` | Yes: rack knob | Existing knob |
| Fault acknowledge | `acknowledgeVesselFault(state)` | Concept rig only | QUITT button |

The rack's other existing controls (governor, RATIO, NULL, GND?, BAND and so on) still shape the drive through `rig.ts`, but none is needed to reach full operation.

## Gauges and indicators

Each row is a model value worth showing, with the indicator that suits it.

| Model value | Reading | Already shown? | Suggested indicator |
|---|---|---|---|
| `vessel.lift` | Head position, 0–1 | Concept rig (OBEN / UNTEN LEDs) | LEDs, blinking while moving |
| `vessel.clamped`, `isSealed` | Clamped; sealed | Concept rig (SPANNEN LED, DICHT lamp) | LED and lamp |
| `vessel.outletOpen` | Purge valve open | Concept rig (AUSLASS LED) | LED, and the handwheel's position |
| Purge stream | Gas leaving through the purge port | Concept rig: the purge port, a nozzle under the far end of the beam tube deep in the grey rack's bay | Xenon jets from the nozzle, sinks and spreads across the bay's shelf while the purge is open on a sealed, pressurised chamber |
| `oxygenPercent`, `oxygenSensorVolts` | Oxygen, 0–20.9 %; the lambda probe's voltage | Concept rig: a narrowband lambda probe, like a motorcycle exhaust's, screwed into the chamber wall; its panel meter on the column station reads 0–1 V with a green band above 0.7 V, and an O2 = 0 lamp | Existing on the concept rig. The probe reads about 0.1 V with oxygen about and swings to about 0.85 V once it is gone, switching through 0.45 V near 0.3 %; it is the operator's proxy for a finished purge |
| `deliveryBar` | Delivery pressure, bar | Yes: delivery pressure indicator on the bank | Existing |
| `flowSlpm` | Flow, SLPM | Yes: flow gauge and float on the bank | Existing; the XE RÜCKL tile warns when the loop is stopped |
| `chamberPressure` | Chamber pressure, bar | Concept rig (round gauge, beam-tube gauge) | Round gauge, 0–2 bar, red above 1.8 |
| `vessel.supply` | Bottle contents | Bank contents needle (separate quantity, see below) | Seven-segment percentage |
| `recirculatorWorking` | Recirculator running | Yes: BETRIEB lamp | Existing |
| `recirculating` | Loop moving gas | No | Flow gauge is enough; optionally a lamp |
| `rig.heater` | Valves warm | Yes: the relay sound and log line | A WARM lamp |
| `vessel.temperature` | Core temperature, K | Concept rig (top strip readout) | Four-digit readout in kelvin |
| `coreStage` | Cold, glowing, full, failed | Concept rig (core colour and windows) | The windows themselves |
| `rig.spindle`, `rig.field` | Spindle speed, field strength | Yes: rack meters and the 1986 display | Existing |
| `rig.instability`, `rig.strain` | Field wander, strain | Yes: rack and board | Existing |
| `isStarved` | Core short of xenon | Concept rig (DRUCK lamp) | Flashing amber lamp |
| `fullyOperational` | Fully operational | No | A BETRIEBSBEREIT lamp, and the anomalies |
| `effects()` | Channels, π, warp, sparks | Yes: the room | Existing |

## Failure states

Each failure is an event the scene can animate and give consequences later.

| Failure | How it is reached | Model event | What the model does now |
|---|---|---|---|
| Fouled core (hallucinogenic exhaust) | The ferrocore is lit before the vessel is purged or charged, with the clamps off, or with the outlet open: a little fouling and a lot are the same failure, by degree | none; `room.exhaust`, `operator.dose` and `operator.hallucinations` in the world (`src/game/exhaust.ts`) | The core runs on; the exhaust fills the room and the operator hallucinates. Burnout is kept, unreachable, for running with the head raised, still to be designed |
| Flux inductance catastrophe | The purge valve is left open on a running core: the chamber never reaches working pressure, the bottle drains through it, and when it is empty the starved core collapses | `vessel: catastrophe, flux-inductance` | As above; QUITT also puts on a fresh bottle |
| Breaker trip, field strain | The field is brought up and not trimmed to lock | `rig: incident` with `fieldShare` high | Existing: the breaker trips, the trip report prints clues |
| Breaker trip, dry circuit | The spindle runs past 0.3 with less than 2 SLPM moving, for example with the recirculator stopped after the purge is shut | `rig: incident` with `hazardShare` high | Existing: as above, with the dry-xenon clue |

The existing overheat, smoke and fire models (`overheat.ts`, `fire-incident.ts`) are not part of this composition yet; they still run from the scene.

## Open points

- The vessel model's bottle (`vessel.supply`, drained by purging) is separate from the bank's contents in the plant room (`xenon-cylinders.ts`, 3,000 litres at 5 SLPM). They should become one quantity when the model is wired into the scene, or the bottle should be renamed the vessel's reservoir.
- The recirculator's 6 SLPM is a game invention, chosen so that a working loop satisfies the drive's existing 2 SLPM threshold.
- The concept rig's column station still drives `column-prep.ts` directly; it should read and write `cold-start.ts` instead when the rig moves into the lab.
- The VX3 has no interlocks, by design (1970s bleeding-edge technology in the spirit of Chernobyl): improper operation is allowed and has consequences. Running with the head raised is to become its own, larger disaster; it is not designed yet.
