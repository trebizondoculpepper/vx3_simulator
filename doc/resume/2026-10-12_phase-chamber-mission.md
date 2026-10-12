# Mission brief: the phase chamber behind the third door

A future mission from the owner. Nothing here is built yet. Read AGENTS.md first, and keep `doc/design/control-graph.md` up to date as you wire it.

## The idea

There is a third door in the basement corridor, to the right of the VX3 lab door as you face it, on the north wall beyond the lab's east wall. It starts locked. A lamp and plate beside it read **SICHERHEITSVERRIEGELUNG GESCHLOSSEN** ("safety interlock closed"). It opens only while the ferrocores are spinning at the right speed. Behind it is a vaulted chamber holding a great aperture: an homage to the "Eye of Harmony" in the 1996 Doctor Who television film. The operator shovels cadmium pellets, kept in a bin in the plant room, into the aperture, which deepens the machine's phase coherence and makes stranger things happen.

## The naming rule

The aperture is a private joke for people who know the film. Never name it, label it or describe it as the Eye of Harmony, and use nothing from Doctor Who: no names, logos, music, props, typefaces or quotations. Design an original object that only evokes it: something vast, ornate and glowing, set into the floor and opening like an iris. In the fiction it is institutional equipment with a dull German inventory name. Suggested: the room is **RAUM −2.18 · PHASENKAMMER** and the object carries a plate reading **KOHÄRENZBLENDE · APPARAT 7**. The README, lore register, log lines and code comments follow the same rule.

## The door

- **Placement:** on the corridor's north wall, east of the lab door, clear of the tool board, the door plate and the generic staggered doors in `src/scene/corridor.ts`. The chamber sits behind the lab's east wall.
- **Indicator:** a lamp and plate, designated an `indicator` in `src/game/machine-parts.ts`. It reads SICHERHEITSVERRIEGELUNG GESCHLOSSEN on a red lamp, and changes to SICHERHEITSVERRIEGELUNG OFFEN on a green lamp when the condition is met.
- **The right speed:** `ferrocoresOperational(rig, xenonFlowSlpm)` from `src/game/ferrocore-anomaly.ts` must hold, and the phase spindle must sit inside a narrow speed band, for example 72–78% (about 2,600–2,800 rpm on the Nixie counters), for a few seconds without leaving it. Hint at the band somewhere in the world rather than stating it: a BBC diagnostics page, a teleprinter line, a page in the filing cabinet or a tachometer repeater beside the door.
- **Losing the band:** the lamp goes red and the latch re-engages, but the lock only ever stops people getting in. The door always opens from the inside, so nobody can be shut in the chamber.
- **Testing:** keep the unlock rule pure and tested in `src/game/`, in the style of `xenon-supply.ts` and `bench-monitor.ts`.

## Cadmium and the shovel

- **The bin:** a lidded steel bin in the plant room, stencilled CADMIUM · NEUTRONENABSORBER · GIFTIG, with a coal shovel leaning on it, and a glove-and-mask notice nearby in the style of the xenon poster.
- **Shovelling:** using the bin loads the shovel, which shows a visible heap of grey pellets while it is carried. Using the aperture tips the load in. One load at a time.
- **Logging:** each step writes a deadpan line to the log, which the teleprinter prints.
- **Mishaps:** walking through a door with a full shovel, or tipping it anywhere but the aperture, spills it. Spilled pellets stay on the floor.
- **Fixtures:** the bin and shovel are room fixtures, not machine parts, so they use `fixture()`.

## What the cadmium does

Real cadmium is a neutron absorber, so feeding it to anything to make it more active is wrong in exactly the right way. The house technobabble: cadmium soaks up the stray hyperfine modes, so the ferrocore phase locks deeper and the field settles into a higher coherence.

- **New state:** add a phase coherence value, 0 to 1. Each load raises it, and it decays slowly while the spindle runs. RESET clears it to nothing, like everything else on the rig. Whether it survives the mains being opened is still undecided; until the owner says otherwise, it persists.
- **Effects:** coherence reduces drift and strengthens the ferrocore anomaly effects: colour breathing, π drift, spatial warp and crystal sparks. The aperture opens wider and glows brighter as coherence rises. Consider an indicator for it on the east board or a BBC page.
- **Limits:** Yalgeth's 0.88 Delta limit is community lore and must not move. Coherence lets Delta creep ever closer to it, but never onto it.
- **Overfeeding:** past a threshold, too much coherence causes a new kind of incident, written in the deadpan register of `src/game/consequences.ts`.

## The Yalgeth display

Add a display that shows how close the rig is to Yalgeth's limit. Delta must approach 0.88 asymptotically and never reach it. Today `deltaScore` in `src/game/rig.ts` clips with `Math.min`, so a full, perfectly trimmed field scores exactly 0.88. Change it to an asymptotic curve, for example `0.88 × (1 − e^(−k·q))`, where `q` grows with field quality and coherence. Test that no input, however extreme, returns 0.88 or more.

The display is a dedicated instrument, labelled in German like the rest of the basement, for example **YALGETH-ANZEIGE**. It might be a large needle meter with a red line at 0.88 and a Nixie or LED readout. As Delta closes in, the readout gains decimal places (0.879, 0.8799, 0.87999), so the last digits keep climbing without the number ever arriving. The status bar's `δ … / 0.880` readout and the bench monitor should follow the same rule.

## Payoffs

Coherence unlocks a ladder of payoffs, each more stupid than the last. Each one fires once per run as coherence crosses its threshold, gets a deadpan log line (printed by the teleprinter), and does something visible. Suggested ladder, to be refined with the owner:

1. **20%:** every clock in the building agrees, for the first time since 1974. The wall clock briefly shows the correct time.
2. **35%:** the teleprinter prints tomorrow's log. It is accurate.
3. **50%:** the corridor gains one extra door on each visit. Nobody can find the room numbers on the plans.
4. **65%:** the BBC Micro boots into a game nobody installed, and the high score table already has the operator's initials on it.
5. **80%:** the cigarette in the ashtray starts burning backwards.
6. **90%:** the operator's reflection in the Cub's screen waves first.
7. **97%:** the Yalgeth display grows another 9.
8. **Full coherence:** the lab door now opens onto the lab. From both sides.

## Integration checklist

- **Code:** pure logic and tests in `src/game/` for the unlock rule, the coherence model and the shovel state. Scene modules in `src/scene/` for the door, the chamber, the bin and the shovel.
- **Designation:** every part designated through `input()`, `indicator()` or `fixture()`, so the development audit stays clean.
- **Sound:** a new room in `src/game/sound-rooms.ts` so its sound stops at its door, with spatial sources for the aperture's hum.
- **Collision:** use tubes or `userData.noCollision` for anything the walker should step over.
- **Inspection:** a `?view=` inspection view for the chamber, and the walker dev hook kept working.
- **Graph:** update the control graph: the door indicator, the coherence state, the aperture and the cadmium path.
- **Docs:** README, lore register and plan, keeping the naming rule throughout.

## Owner's decisions

1. **Escape:** the lock only keeps people out. The door always opens from the inside.
2. **Persistence:** RESET clears coherence. Anything beyond that is undecided; it persists for now.
3. **The aperture:** set into the floor, opening like an iris.
4. **Rewards:** a series of payoffs, each more stupid than the last (see above).
5. **The Yalgeth display:** wanted, with Delta approaching but never reaching 0.88.
