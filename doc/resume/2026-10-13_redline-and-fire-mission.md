# Mission plan: redlines, smoke and the sprinklers

A future mission from the owner, written for discussion before anything is built. Nothing here is built yet. Read AGENTS.md first, and keep `doc/design/control-graph.md` up to date as you wire it.

## The idea

Some machines can be driven past their safe limit. Their gauges carry a redline. Running past it makes the device smoke; smoke that goes on too long sets off the fire alarm, and the alarm starts the sprinklers. A red button in the lab starts fire mode at once, and a reset in the corridor stops the sprinklers. Ruining the lab with a fire is one of the game's failure conditions: the first real way to lose.

## What already exists

- **Redlines on every dial.** `createDialTexture` in `src/scene/screens.ts` paints a red band over the top sixth of every dial, from 83% to 100% of the scale. It is decorative today.
- **Sprinklers and detectors.** `src/scene/ceiling-services.ts` already draws wet sprinkler mains with pendant heads (red glass bulbs) and optical smoke detectors, in both the lab (`lab-room.ts`) and the corridor (`corridor.ts`). Nothing drives them yet.
- **Smoke.** The ashtray in `src/scene/ashtray.ts` has a pixel-smoke particle system that can be lifted into a reusable emitter.
- **Incidents and alarms.** `stepRig` in `src/game/rig.ts` already trips the mains when strain reaches 1. The east board's alarm windows in `src/game/control-board.ts` show how a latched, acknowledged alarm sequence works.
- **Rooms and doors.** `src/game/sound-rooms.ts` already stops sound at shut doors, so the alarm bell and the water can be heard properly from the corridor.

## Proposed design

### 1. Redlines that mean something

Not every dial should carry a redline. A full heater is normal, for instance, so the heater dial needs no red band. The proposal is three redlined quantities, each tied to the device that suffers:

| Gauge           | Redline   | Device that smokes                         | How you get there                                            |
| --------------- | --------- | ------------------------------------------ | ------------------------------------------------------------ |
| SPINDLE         | 85% speed | the Encabulator drive                      | governor disengaged or LIMIT turned up, with SPEED near full |
| FIELD           | 85% field | the Helmholtz-Blatz coil pair              | FIELD and EXCITE both near full                              |
| Wall load meter | 6.5 kW    | the betaform amplifier in the side cabinet | everything switched in, gain at maximum                      |

Each redline lives in data, and its dial draws its red band from that value, so the paint and the rule always agree. The other dials lose their red band, or keep it only where a limit is real.

### 2. Overheating and smoke

- **The model.** A new pure module, `src/game/overheat.ts`. While a redlined quantity sits past its redline, its device's heat climbs, and it climbs faster the further past the line it runs. Below the line, heat drains away.
- **Smoke.** Past a heat threshold the device smokes, thin grey at first and thickening with heat, from the generalised ashtray emitter. The log notes it in the usual deadpan voice: "Encabulator smoking. Smells like a warm toaster. Carrying on."
- **Room smoke.** Smoke from every device adds to a room smoke level, which vents away slowly. That level is what the detectors see.

### 3. Alarm and sprinklers

- **Detection.** When the lab's smoke level stays above the detector threshold for long enough (proposal: 20 seconds), the alarm goes off.
- **The alarm.** A synthesised fire bell, a red flashing beacon in the lab and corridor, and the detectors' lamps lit. The east board's STÖRUNG window latches.
- **The sprinklers.** A few seconds after the alarm, the lab's sprinkler heads burst their bulbs and spray: falling water particles, a hiss, and puddles spreading on the lino.
- **Effects of the water.** The sprinklers soak the lab. If the apparatus is still live, the water shorts it out (see below). The lab lights flicker, and the paper log in the teleprinter goes soggy.
- **Puddles, within reason.** A few flat puddles spread on the lino under the heads, then dry up and shrink away over a couple of minutes. This is a VX simulator, not a puddle simulator: no fluid simulation, splashing or footprints, just a handful of shrinking decals.

### 4. The red button and the corridor reset

- **The red button.** A German manual call point in the lab, by the door: a red box reading **FEUERALARM · Scheibe einschlagen · Knopf drücken**. Using it starts fire mode immediately: alarm, then sprinklers, with no smoke needed.
- **The reset.** A small fire panel in the corridor, by the lab door: **BRANDMELDERZENTRALE**, with a key switch or button labelled **RÜCKSTELLEN**. Using it stops the sprinklers, silences the bell and resets the detectors. It does nothing while the lab is still smoking hard, so the cause has to be dealt with first.
- **Designation.** Both are inputs in `src/game/machine-parts.ts`. The beacon, the detector lamps and the sprinkler heads are indicators.

### 5. Ruining the lab: the failure conditions

There are two ways to ruin the lab. Both end the run.

- **A sustained fire.** A device that keeps overheating after the alarm catches fire. If a fire burns for 45 seconds in total, the lab is ruined. The sprinklers do not put out a fire on a device that is still powered. The ashtray's cigarette never counts as a fire, however long it burns.
- **A short circuit.** Sprinkler water on live apparatus shorts it out. After a 5-second grace period of water with the mains closed, the lab is ruined. This applies however the sprinklers started, including a false alarm from the red button, so pressing the button with the rig running is a real mistake. The short shows: blue-white flashes of electrical discharge crackle along the exposed wiring (the loom in the rack's open inspection bay and the cable runs) and around the rack, with a matching crackle of sound.
- **When the lab is ruined.** The rack's lamps die, the room lights go out with the beacon still turning, and the teleprinter prints a final deadpan incident report. A message across the screen reads **VX LAB IS RUINED**, then fades so the operator can walk around the wreckage: the sprinklers still running, the discharge still crackling, the smoke hanging. The controls no longer do anything. After a while (proposal: 20 seconds), a **RESET** button appears in the on-screen UI and starts a fresh run.
- **Recovery is always possible before either point.** Open the mains, let the smoke clear, then reset the sprinklers in the corridor.

## Integration checklist

- **Pure logic and tests in `src/game/`:** redline data, the overheat model, room smoke, the alarm sequence (smoke → alarm → sprinklers → fire → ruin), and the reset rules.
- **Scene modules:** the smoke emitter (generalised from the ashtray), the call point, the corridor fire panel, the beacon, water from the existing sprinkler heads, and puddles.
- **Sound:** fire bell, water hiss and the crackle of a real fire. Placed spatially, with the corridor and the plant room hearing them through doors.
- **Designations, the control graph, README, lore register and plan,** all kept in step.
- **A `?view=` inspection view** for the call point and the corridor panel.

## Owner's decisions

1. **Redlines:** spindle, field and supply load are a good start.
2. **Ruin by fire:** the lab is ruined by fire that lasts an extended time. The cigarette does not count.
3. **Ruin by water:** sprinkler water on live apparatus shorts it out and ruins the lab, shown by electrical discharge in the exposed wiring and a **VX LAB IS RUINED** message on screen.
4. **Puddles:** yes, drying up over time, but keep them modest. It is a VX simulator, not a puddle simulator.
5. **Timings:** 45 seconds of fire, and a 5-second grace period for water on live apparatus.
6. **After ruin:** the operator can walk around the ruined lab. After a while a RESET button appears in the on-screen UI and starts a fresh run.
