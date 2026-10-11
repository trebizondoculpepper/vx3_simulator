# Resume: lore, livery and sound follow-up

The playable rack now has a fixed six-role lineup in `src/game/rack-catalogue.ts` so later gameplay can depend on exact module neighbours. `src/scene/panel-livery.ts` draws distinct 1970s coloured faceplates for each sourced manufacturer. Exact maker-to-part assignments and panel artwork are reconstructions. The opening log line says “For educational use only.”

Research from the supplied artifact is in `doc/lore/vxjunkies-lore.md`, with `component-catalogue.json` and `summary.md`. Community terms and game inventions are distinguished there. The README is written in universe for an early-1970s analogue VX3, and mentions the later ConVX computer retrofit and the practical impossibility of conventional VX8 simulation.

`src/audio/` synthesises ZzFX one-shots and a Web Audio room, mains, heater, motor, field and strain mix. It loads after interaction, exposes mute and volume controls remembered locally, and suspends with the page. The spindle speed drives both motor pitch and the repeating bearing pulse. Navigation controls are silent. Every rack switch and pushbutton still has an effect.

The laboratory has the wall clock, global flux map, bench, socket, floor cable and cabinet antenna. A six-station ferrocore drum sits to the right of the main rack and rotates with the spindle; a second cabinet contains a betaform amplifier, isolated-frame flux emitter and nanocore radiator. A three-drawer filing cabinet opens reconstructed operating papers. The safety pin board has three period marketing posters above it, saved in `public/posters/` with prompts in `doc/art/poster-prompts.md`. Canvas dragging orbits the view; vertical wheel motion and arrows pan along the rack, while horizontal Magic Mouse swipes and left/right arrows pan across the lab. Separate zoom controls adjust the camera.

The Vite demo is running at `http://127.0.0.1:5173/`. Before committing further changes, run typecheck, lint, format check, tests and build as required by AGENTS.md. Work on `main`; do not modify devops-owned configuration.
