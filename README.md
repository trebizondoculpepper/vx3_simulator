# VX3 Simulator

A workstation recreation of the VX3 laboratory that is still in service two floors below the Helmholtz-Bau at the University of Leipzig, Room −2.17. Its **full early-1970s VX3 cabinet** and the apparatus around it are original; the ducting, cable trays and safety fittings are modern additions. The object of a run is to bring the heaters to temperature, establish spindle rotation, raise the field and hold a useful Delta without exceeding the rack's tolerance for drift. For educational use only.

The original equipment uses analogue regulation, valves, ferrocores and a Baltovsky chamber monitor. Its numerical counter and oscilloscope are observation instruments, not a computer control register. The later ConVX practice of driving a VX3 from a microcomputer is outside this recreation. No credible calculation of a VX8 on a conventional computer is presently available.

## Commissioning the workstation

Use Node.js 22.13.x, 24.x or 26+ and npm. From this directory:

```sh
npm ci
npm run dev
```

Open the local address printed by the workstation, normally `http://127.0.0.1:5173/`. In the adjacent TECHNIKRAUM, close the master throw switch, open the xenon cage and turn the flow regulator until the rotameter reads at least 2 SLPM. The master supplies machinery independently of the room lights. Then close the rack mains breaker, wait for the valve heaters, advance spindle speed and field excitation, then trim the local Helmholtz-Blatz regulator as the field wanders. Its “Blatz” scale and phase spindle are particular to this installation; they should not be mistaken for general VX nomenclature. A fully stable field still respects Yalgeth's 0.88 Delta limit.

Click the left half of a rotary knob to turn anticlockwise and the right half to turn clockwise; continuous controls stop at their end stops. Knob markers rotate with their bodies about the shafts. Every knob and rotary selector has an independent setting; the plasma EXCITE and NULL controls are separate from coil FIELD and BLATZ TRIM, and each detector and amplifier has its own gain. In movement mode, aim at the appropriate half and click or press E; Escape releases the pointer. C crouches and V lowers the crouch further. Scroll up to move toward the apparatus and down to move away; hold Option/Alt while scrolling to move the camera up or down. A horizontal Magic Mouse swipe pans sideways, and dragging the scene changes the viewing angle. The on-screen pan and zoom controls offer the same movements. The perspective and isometric selectors change the observation angle. The operator's log records adjustments and incidents; it may be put away and reopened. Sound begins after the first operator action and may be muted or adjusted at the top left.

## Represented equipment

The fixed rack includes a varistance-isolated supply, a chromocore and valve bank, an Encabulator drive, a Holtzmann resonance coil, a Fromitz detector and an ion insulation check. A six-station ferrocore drum stands beside it, followed by a smaller cabinet holding a betaform amplifier, isolated-frame flux emitter and nanocore radiator. Volt Xoccula, Neumann Dynamik, Synclex, Wonshou Labs, Bonk Industries and Gorskiy appear on the fascias. The precise maker-to-unit pairings, painted liveries, panels and wiring shown here are the recreation's own designs. Borrowed community terms and invented local parts are distinguished in the [lore register](doc/lore/summary.md) and [component catalogue](doc/lore/component-catalogue.json). How every switch, knob and lever reaches the machine, and which lamps, needles and screens report back, is drawn in the [control graph](doc/design/control-graph.md).

The surrounding laboratory includes an analogue wall clock, a map of global flux correlations, a test bench with a BBC Micro Model B beneath its Microvitec Cub monitor and a separate 5¼-inch disk drive, an isolated wall socket, a floor mains lead, the cabinet aerial and a safety notice board. A small amber-glass ashtray sits on the west workbench beside the deep white porcelain sink, its last cigarette still burning. Below the map, a wall meter shows instantaneous load in kW and accumulated consumption in kWh, and responds to the connected apparatus in this recreation. Three period advertisements just above the west workbench offer differing accounts of VX equipment and its likely operators. Three reference drawers hold the operating guide, core-handling instructions and a redrawn signal path. A Neumann Dynamik teleprinter stands on a bracket fixed to the right-hand wall, with continuous-feed stock below and old output gathering on the floor; just above it, a prismatic Time Dilation tell-tale pulses as the field becomes active. The printer is presently idle; its telemetry feed has not yet been connected. On the east wall stands a 1974 process board, rewired in 1986 as a remote station for the VX3. Its eighteen handles work the rack, including mains, emergency stop, purge and reset; its alarm windows flash until acknowledged with QUITT, and its channel grid, meters, trim pointers, trend screen and red readouts repeat the rack's state. The plate reading AUSSER BETRIEB has not been removed. Neither the wall map nor its pin lights is a substitute for local measurement.

## Contributions from fellow VX Junkies

The east wall carries a compact three-bay auxiliary process board: mint-enamel 1974 controls, a channel overview and a beige 1986 instrument retrofit with a CRT and numeric readouts. Its stopped paper trace and blanked instruments survive the laboratory's 1990s abandonment. The surviving board now repeats the rack's operating controls and measurements. The emergency decoherence hotline is mounted outside in the corridor beside the lab entrance; the reference drawers stand in the south-east corner. An [inspection view](https://vx3-simulator.fly.dev/?view=control-panel) faces the process board directly.

Fellow VX Junkies are invited to contribute apparatus, operating notes, circuit diagrams, incident reports or corrections. Simply open a pull request with your proposed addition to the workstation record. Please distinguish observed community lore from details invented for the recreation so the next operator knows which readings have actually been taken.

## Verification procedure

Before recording a change to the workstation, run:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

## Construction record

The cabinet and laboratory are rendered with Three.js. The three framed advertisements were generated for this recreation; their art direction is recorded in the [poster record](doc/art/poster-prompts.md). The apparatus sound effects are synthesised in code using Web Audio and [ZzFX](https://github.com/KilledByAPixel/ZzFX) (MIT). The BBC Micro uses a [two-second startup recording](src/audio/assets/README.md) supplied as a reference by the owner. The workstation also uses Vite (MIT), TypeScript (Apache-2.0), Vitest (MIT), ESLint (MIT) and Prettier (MIT).

The plant room has the same internal dimensions as the laboratory, its own working steel door and 300 mm masonry walls. A mercury arc rectifier glows blue-white and buzzes when the master switch is closed. The xenon bank stands behind a working cage; its thick manifold and rubber hose connect to a labelled wall port immediately beside the cage. Opening the regulator raises delivery pressure and then indicated flow; the purple XE FLUSS lamp flashes below 2 SLPM. The sink initially drips about once every ten seconds. Working the hot tap on and off reseats its washer; its quiet drip can only be heard inside the laboratory.

The BBC keyboard has sculpted keycaps, red function keys, a brown cursor cluster, lock lamps, a printed deck strip and rear sockets. Clicking the computer clears the Cub, replays its boot sound and loads the diagnostic disk; the drive lamp follows disk activity. This restarts the computer without resetting the apparatus. Ten original German pages advise on master power, rack power, xenon supply, heater warm-up, drive and governor settings, and excessive speed. When the powered spindle turns with sufficient xenon, the program reports FERROKERNE DREHEN SICH. The [screen record](doc/art/bbc-monitor/README.md) includes the pre-rendered pages.
