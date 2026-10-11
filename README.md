# VX3 Simulator

Operate a historical "full" VX3 rig, racked in a 19-inch cabinet, in your browser. Warm the valves, spin up the phase spindle, keep the Helmholtz-Blatz field trimmed, and read in the logbook what happened when you didn't.

A bench toy in the deadpan tradition of [r/VXJunkies](https://www.reddit.com/r/VXJunkies/), rendered in a PS1 style with Three.js.

**Status:** playable first slice. A randomised five-panel cabinet has working controls, instruments, scrolling and an operator's logbook. The panel designs are currently invented; community lore research is pending. The design mockup lives in `doc/design/`.

## Run locally

Use Node.js 22.13.x, 24.x, or 26+ and npm.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite (normally `http://127.0.0.1:5173/`). Click switches and knobs on the rack, then use the mouse wheel, drag, or the arrow buttons to move through the cabinet. Switch between perspective and isometric cameras to compare the PS1-style views. The logbook can be put away and reopened.

## Checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

## Credits

- [Three.js](https://threejs.org/) by the three.js authors — MIT.
- Development tools: [Vite](https://vite.dev/) (MIT), [TypeScript](https://www.typescriptlang.org/) (Apache-2.0), [Vitest](https://vitest.dev/) (MIT), [ESLint](https://eslint.org/) (MIT), [Prettier](https://prettier.io/) (MIT).
- Premise: the r/VXJunkies community. This project is unaffiliated fan work.
