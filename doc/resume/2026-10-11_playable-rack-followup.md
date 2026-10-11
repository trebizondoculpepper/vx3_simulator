# Resume prompt: playable rack follow-up

The creative lead replaced the placeholder with a playable five-module 3D rack in `src/rendering/start-scene.ts`. The current look is 1950s–60s industrial: enamel panels, steel rails, brass screws, valves, analogue gauges, oscilloscope and Nixie counter. The owner can switch between perspective and isometric PS1-style camera views. `src/game/rack-catalogue.ts` defines the small randomised invented catalogue. `src/game/rack-controls.ts` replaced the old desk mapping. Scrolling works through wheel, drag and on-screen arrows. The notebook overlay logs actions and rig events and can be dismissed. `doc/plan.md` tracks the direction.

The owner has another agent doing lore research. Its findings should be incorporated when available, with community and invented entries clearly distinguished. The older VX3 should feel like a plausible valve-era analogue computing rig; the running joke is that modern VX8 cannot be credibly simulated by conventional computers.

The development server was started at `http://127.0.0.1:5173/` in an agent session. Restart with `npm run dev` if needed. Before any commit, run typecheck, lint, format check, test and build as required by AGENTS.md. Stay on main and do not push without the owner asking.

Next: review the first slice with the owner, improve panel hardware and instrument legibility, add accessible control equivalents, integrate researched lore, then grow the module catalogue. Continue to use `/Users/salimfadhley/workspace/idea_grabber` as a technical reference where useful.
