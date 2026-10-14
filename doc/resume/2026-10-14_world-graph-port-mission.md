# Mission brief: port the world graph and components into the lab

Briefed on 14 October 2026, from the owner's session building the graph world model and the component model in the developer rooms. The plan is to get dev0 working first, then port its fixes into the main game. Dev0 now works; this mission is the port. Nothing below changes the lab yet.

## Where things stand

- **The world graph** (`src/game/world/graph.ts`, `world.ts`) is the lab's machine rebuilt as a directed graph of cached functions on `@preact/signals-core`. Inputs, states, derived values and outputs (every lamp, needle and readout) are declared vertices; processes advance the states each tick, reusing the existing physics (`stepRig`, `stepColumnPrep`, `stepOverheat`, `stepFireIncident` and the rest). A derived value is recomputed only when one of its inputs changes, and passes a change on only when its own result differs. One tick of the whole lab costs about 12 µs. Its eighteen alarm conditions match the board's existing `warningConditions` at every step of a full run (tested).
- **Analysis** (`graph.analyse()`, `analysis.test.ts`) lists the lab's loose ends: dead controls (BLATZ, XTAL A, XTAL B, XTAL C change nothing in the machine), drive parameters no control in the lab sets (governor, response, plasma excitation and null, amplifier gain, CHROMOCORE AUX), and values the room never shows (nothing in the room says the plant is fully operational).
- **Designed failures** (`scenarios.ts`, `scenarios.test.ts`): every alarm window and every bad end has a scenario with a stated cause and scripted operator steps, and a test fails if any has none. Failures are designed, never found by searching.
- **Components** (`components.ts`): LED pushbutton, momentary pushbutton, two-position switch, detented selector and key-locked selector, with tests. Each has inputs (Power, Latch), one source of truth for its state (a bound world value or its own), guarded operator actions, silent sets from the model, `dispose`, and its own sounds: transition sounds (`press`, `on`, `off`, `detent`, `end-stop`, `refused`) and state sounds held while its state calls for them (`src/audio/part-loops.ts`). `src/rendering/part-sound-hub.ts` hands a panel's sounds to its room.
- **Dev0** (`/?room=dev0`, `src/rendering/dev-room.ts`): the column is driven by the world graph and only shows it; the KALTSTART desk (`src/rendering/dev-cold-start-board.ts`) is all components, its rows the cold start in order. It uses the lab's sound engine, but plays only what is in the room.
- **Dev2** (`/?room=dev2`, `src/rendering/parts-room.ts`): the CONTROL TEST parts board, all components, demonstrating supply (the rocker), interlock (the key switch), the key-locked selector and state sounds.

## Rules the port must keep

1. **Two models.** The world model says what is true (the plant is powered). The component model is each part's own behaviour: inputs, state, looks and sounds. A part behaves properly whether or not it is bound to the world.
2. **Sounds come from objects, never from the world model.** The lab's sound engine today takes world flags (`setPlantPower`, `setRecirculator`, `setSprinklers`) and plays the rectifier, recirculator and sprinkler sounds whether or not those objects are near; dev0 exposed this when switching on the plant supply played the rectifier hum in a room with no rectifier. Each of those becomes a state sound on its object, played where the object is.
3. **Failures are designed.** Each has a cause an operator could deduce and a scenario in `scenarios.ts`. Adding a warning or failure means adding its scenario.
4. **One source of truth.** Only an operator's action writes to the world; the world moving a part is silent and is not logged as an action.

## The port, in steps

1. **Wire the graph in.** Replace the hand-written machine wiring in the frame loop of `src/rendering/start-scene.ts` (the breaker drop, line feed, permit, vessel, drive, wall meters, overheating, fire and board steps) with `world.tick`, and drive the scene's displays from the graph's outputs. The world graph already mirrors that wiring; check its equivalence test still holds as the lab changes.
2. **One model of the cold start.** `src/game/cold-start.ts` (used only by tests) and the lab have drifted apart: in `cold-start.ts` the vessel inlet opens by itself with regulator pressure; in the lab it is the XE EIN button. Retire `cold-start.ts` in favour of the graph, or make it the graph.
3. **Port the column's panels** (`src/scene/ferrocore-column-rig.ts`) to components: each control a component bound to the world, its mesh factory only a view. The column's own supply switches, valves, clamps, dials, band selector, ZÜND, AUS and STRAHL STOP.
4. **Port the east board** (`src/scene/east-control-panel.ts`, `src/game/control-board.ts`): its handles as components (NETZ, NOT-AUS, QUITT, L-TEST, SPÜLEN and RÜCKS. as momentary or spring-return; the toggles as switches), and its alarm windows, grid, meters and readouts as graph outputs. This fits the board redesign proposed earlier (one bay per circuit: ENERGIE, STEUERUNG, XENON); decide whether to do both at once.
5. **Port the plant room and the rest:** HAUPTSCHALTER, the recirculator's KREISLAUF switch, the cylinder regulator, the fire call point and panel reset, each a component.
6. **Sounds from objects in the lab.** Give the rectifier, the recirculator and the sprinklers state sounds driven by their world values, and retire the engine's world flags. Make component sounds positional in the lab (the engine already has `setSources` and `distanceGain`).
7. **Keep the docs true.** Update `doc/design/control-graph.md`, or generate its diagrams from `graph.mermaid()`. Keep `README.md` (in-universe) and `doc/plan.md` aligned with what ships.

## Design questions for the owner

- **Flux inductance** has no designed route in the lab: the atmosphere permit drops the heaters before a hot core can drain the buffer dry, so it cannot happen (`undesigned` in `scenarios.ts`). Drop it, or design a way for it to happen.
- **The dead handles** BLATZ and XTAL A, B and C: wire them to something, or take them off the board.
- **FELD is not needed** to reach full operation: spindle activity alone takes the core to full power. Intended?
- **An overdriven machine left running always ends in a short, never a fire**: the fire alarm and sprinklers come before the fire has burned for 45 s, and water on the live drive wrecks the lab first. Burning down needs the sprinklers already spent.
- **The fire call point pressed with NETZ closed** wrecks the lab within seconds, even with a cold machine.
- **Nothing shows "fully operational"** in the room.

## Coordination

The other agent works in the same files this port touches (`start-scene.ts`, the column, the east board, the sound engine), and has its own audit of the cold start (`doc/resume/2026-10-13_gen2-cold-start-audit.md`). Agree who does which step before starting, and port one area at a time, each with its tests and a run of the designed scenarios.

## Done when

The lab runs on the world graph; every control in the lab is a component; every sound comes from an object in the room; the designed scenarios pass against the lab's own wiring; and `analyse()` reports no loose ends that the owner has not chosen to keep.
