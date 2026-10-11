# VX3 Simulator

A workstation reconstruction of a **full early-1970s VX3 cabinet**. The object of a run is to bring the heaters to temperature, establish spindle rotation, raise the field and hold a useful Delta without exceeding the rack's tolerance for drift. For educational use only.

The original equipment uses analogue regulation, valves, ferrocores and a Baltovsky chamber monitor. Its numerical counter and oscilloscope are observation instruments, not a computer control register. The later ConVX practice of driving a VX3 from a microcomputer is outside this reconstruction. No credible calculation of a VX8 on a conventional computer is presently available.

## Commissioning the workstation

Use Node.js 22.13.x, 24.x or 26+ and npm. From this directory:

```sh
npm ci
npm run dev
```

Open the local address printed by the workstation, normally `http://127.0.0.1:5173/`. Close the mains breaker, wait for the valve heaters, advance spindle speed and field excitation, then trim the local Helmholtz-Blatz regulator as the field wanders. Its “Blatz” scale and phase spindle are particular to this installation; they should not be mistaken for general VX nomenclature. A fully stable field still respects Yalgeth's 0.88 Delta limit.

Click controls on the cabinet. Use the mouse wheel or up/down arrows to reach lower sections; drag the scene to look around. Left/right pan and zoom controls reveal the auxiliary apparatus. The perspective and isometric selectors change the observation angle. The operator's log records adjustments and incidents; it may be put away and reopened. Sound begins after the first operator action and may be muted or adjusted at the top left.

## Represented equipment

The fixed rack includes a varistance-isolated supply, a chromocore and valve bank, an Encabulator drive, a Holtzmann resonance coil, a Fromitz detector and an ion insulation check. A six-station ferrocore drum stands beside it, followed by a smaller cabinet holding a betaform amplifier, isolated-frame flux emitter and nanocore radiator. Volt Xoccula, Neumann Dynamik, Synclex, Wonshou Labs, Bonk Industries and Gorskiy appear on the fascias. The precise maker-to-unit pairings, painted liveries, panels and wiring shown here are reconstruction designs. Borrowed community terms and invented local parts are distinguished in the [lore register](doc/lore/summary.md) and [component catalogue](doc/lore/component-catalogue.json).

The surrounding laboratory includes an analogue wall clock, a map of global flux correlations, a test bench, an isolated wall socket, a floor mains lead, the cabinet aerial and a safety notice board. Below the map, a wall meter shows instantaneous load in kW and accumulated consumption in kWh; a prismatic Time Dilation tell-tale pulses as the field becomes active. Both respond to the connected apparatus in this reconstruction. Three period advertisements above the board offer differing accounts of VX equipment and its likely operators. Three reference drawers hold the operating guide, core-handling instructions and reconstructed signal path. Neither the wall map nor its pin lights is a substitute for local measurement.

## Contributions from fellow VX Junkies

Fellow VX Junkies are invited to contribute apparatus, operating notes, circuit diagrams, incident reports or corrections. Simply open a pull request with your proposed addition to the workstation record. Please distinguish observed community lore from reconstructed details so the next operator knows which readings have actually been taken.

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

The cabinet and laboratory are rendered with Three.js. The three framed advertisements were generated for this reconstruction; their art direction is recorded in the [poster record](doc/art/poster-prompts.md). The sound effects are synthesised in code using Web Audio and [ZzFX](https://github.com/KilledByAPixel/ZzFX) (MIT); no recorded samples are used. The workstation also uses Vite (MIT), TypeScript (Apache-2.0), Vitest (MIT), ESLint (MIT) and Prettier (MIT).
