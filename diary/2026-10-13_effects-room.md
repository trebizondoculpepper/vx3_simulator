# Development Diary Entry - 2026-10-13

## Context

- **Date**: 2026-10-13 14:56 UTC
- **Branch**: main
- **Commit**: (this commit)
- **Contributors**: Claude Code + owner

## Problem Statement

The owner wanted a second developer room, `dev1`, for exploring the effects that signal the rig's end states: a 10 m walkable room with grid walls, standard test objects (a polygon, a teapot, a chair), and a control panel for the warp, π shift and colour channel phaser. Partway through, the owner shared a set of distortion suggestions by email and asked for the first three to be built (lost numerical precision, chromatic divergence, a warp centred on a point) and the rest noted as a future mission. The owner then asked for the controls to be an in-game console rather than an HTML overlay.

## Our Approach

Build the room at the lab's own scale (`RACK_METRE`), because the warp shader works in scene units and would look different at one unit per metre. Describe every dial in a pure settings module, with a preset function that reproduces the lab exactly, so the room can start from what the game does and then go further. Make the shader's fixed numbers into shared uniforms whose defaults are the old values, so the lab is unchanged. Reuse the 1980s panel parts and the game's knob rule for the console.

## Implementation

- `src/game/effect-settings.ts` (tested): `EffectSettings`, `settingsForActivity` and `effectFrame`. The test checks the presets against `anomalyEffects` at several activities and times.
- `src/rendering/ps1-material.ts`: warp shape (`warpTwist`, `warpSwell`), a warp centre and reach (`warpField`), lost precision (`precision`, with a per-material `userData.ps1Precision`), a per-material `userData.ps1Warp`, and `linearTarget`, which keeps the dither in display encoding when drawing into a render target.
- `src/rendering/chromatic-divergence.ts`: renders the scene with depth into a target, then reads red and blue from radially scaled, turning and depth-parallax offsets.
- `src/rendering/effects-console.ts`: rows of skirted knobs, buttons and a character LCD; knobs follow their values.
- `src/rendering/effects-room.ts`: the grid room, the test objects, colour bars and a colour checker, π instruments (a clock, a gauge and a ring of 24 blocks placed with the room's π), the sloping desk and a beacon at the warp's centre. `window.vx3Dev1` has scripted hooks for views, settings and clicks.
- `src/main.ts` routes `?room=dev1`.
- `doc/resume/2026-10-13_reality-distortion-mission.md` briefs the remaining ideas; `doc/plan.md` links it.

## Outcomes

Screenshots confirmed each effect, and a scripted click on a knob changed the settings. Lost precision tears thin cards off the walls, because they snap independently of the wall behind them; the teapot's exemption works. A strong warp opens small gaps where surfaces only share edges, which the brief now records as a feature. The first console was too tall and blocked the room, and the geometry effects mangled it; the desk is now low and sloping, and its materials opt out of the warp and precision loss. Chrome tabs in the background never render, so screenshots were taken with headless Chromium using SwiftShader.

## Next Steps

Bring the centred warp, divergence and precision loss into the lab, centred on the ferrocores and staged with activation. Let π drift reach circular geometry. Then work through the mission brief.
