# Prompt: procedural sound effects for VX3 Simulator

Paste everything below the line into the session that will build the game's sound. It is self-contained.

---

## Your task

Design and implement all of the sound for **VX3 Simulator**, a browser game in `/Users/salimfadhley/workspace/vx3_simulator` (public repository `https://github.com/trebizondoculpepper/vx3_simulator`). Use model-driven procedural sound for continuous apparatus behaviour and suitable edited recordings for physical actions. Existing recordings and their authors/source URLs are listed in `CREDITS.md`; technical details are in `src/audio/assets/README.md`. Background music has its own handoff in [music-generation.md](music-generation.md).

The game is a deadpan bench toy based on the r/VXJunkies subreddit. The player operates a historical "full" VX3 rig: a scrolling 19-inch equipment rack of mismatched 1970s rack-mount appliances, rendered in a PS1 style. The player flips toggles, turns knobs and throws a mains breaker. The simulation warms valves, spins up a phase spindle and holds a Helmholtz-Blatz field, which drifts and becomes unstable if the operator neglects the Blatz trim. When strain builds up, an incident trips the breaker and something odd happens (the logbook reports it in a calm, deadpan way).

The sound should feel like a real, slightly unwell piece of vintage electronics in a garage: warm, humming, mechanical and a little alarming. It should not sound like cartoon or arcade effects. Comedy comes from realism pushed slightly too far, never from slide whistles.

## Tools available

- **ZzFX** (`zzfx` 1.4.0, MIT, already a dependency) for **one-shot effects**. Import `{ zzfx, ZZFX, ZZFXSound }` from `'zzfx'`; types are in `src/types/zzfx.d.ts`. Prefer `new ZZFXSound([...])` built once and replayed with `.play(volume, pitch)`, which gives slight natural variation. The ZzFX designer at https://killedbyapixel.github.io/ZzFX/ helps tune parameter lists; record the final list in code with a comment saying what it is.
- **The Web Audio API** for **continuous sounds** whose parameters follow the simulation every frame: oscillators, noise from buffers of random samples, `BiquadFilterNode`, `WaveShaperNode`, `GainNode`, `StereoPannerNode`, and `AudioWorklet` if you need custom processing.
- **Do not add other audio packages.** If you genuinely need one, write a request in `doc/requests/<UTC-date>_<slug>.md` explaining why; the devops agent owns dependencies.

Important gotcha: ZzFX creates its `AudioContext` when the module is imported. Browsers start that context suspended until a user gesture, and the test runner (Vitest in Node) has no `AudioContext` at all. Therefore:

- import ZzFX and create Web Audio nodes **lazily**, inside the audio module after the first click, never at the top level of a module the tests import;
- call `ZZFX.audioContext.resume()` on the first pointer or key press, and route your continuous sounds through the **same** context (`ZZFX.audioContext`) so there is one master volume and one unlock.

## What to build

Find the hooks in the code: `src/game/rig.ts` (the simulation state: `heater`, `spindle`, `field`, `drift`, `instability`, `strain`, and events `warmed`, `field-locked`, `warning`, `incident`), `src/game/rack-controls.ts` (toggles and knobs), `src/game/rack-catalogue.ts` (the randomised modules) and `src/rendering/start-scene.ts` (where input and the frame loop live). Keep sound logic in its own module, for example `src/audio/`, driven by state each frame and by explicit events, the way the rendering reads the simulation.

### One-shot effects (ZzFX)

- **Toggle switch:** a hard, short bat-handle snap, slightly different for up and down.
- **Knob detent:** a tiny click per step while turning, pitched a little by knob size.
- **Rotary selector or band switch:** a heavier ratchet clunk.
- **Push buttons** (RESET, PURGE, DO NOT): a soft mushroom-button thump, plus whatever the button does.
- **Mains breaker on:** a big mechanical clack, then a relay chatter.
- **Mains breaker off:** a clack, then the continuous sounds winding down.
- **Field locked:** a short, satisfied two-tone chirp from somewhere inside the rack.
- **Warning:** a sickly relay buzz or a detuned alarm pip. It should be irritating, not loud.
- **Incident:** a muffled thump and a crackle, then the breaker tripping. Silence afterwards matters: let the room tone carry it.
- **Spark gap:** irregular snapping cracks while it is arcing.
- **Radiation counter:** individual clicks at a random rate that follows counts per minute.
- **Logbook:** a soft paper flip when opened and closed, and a faint pencil scratch when an entry is written.

### Continuous sounds (Web Audio)

- **Room tone:** a very quiet garage ambience of low filtered noise, always on, so silence never sounds digital.
- **Mains hum:** 50 Hz with a few harmonics, present while the mains is on, slightly louder as the field strengthens.
- **Valve heaters:** a soft hiss that fades in as `heater` rises.
- **Phase spindle:** a motor whine plus bearing rumble whose pitch and level follow `spindle`.
- **Helmholtz-Blatz field:** a drone whose pitch follows `field`. As `instability` rises it should detune, beat against itself and wobble. Near collapse it should sound genuinely uneasy.
- **Strain:** a faint, rising, high whistle or transformer squeal as `strain` builds.

Mix guidance: keep everything below the music level of a typical web game, and leave headroom for stacking. Pan sounds gently by where their module sits in the rack, if that is easy.

## Requirements

- **Mute and volume control in the UI layer,** remembered in `localStorage`, wrapped in try/catch. Default to on, but nothing plays until the first interaction.
- **Respect `prefers-reduced-motion`** by removing wobble and tremolo modulation, and stop audio when the tab is hidden.
- **Performance:** no allocation in the per-frame update; build ZzFX sounds once; reuse nodes; ramp parameters with `setTargetAtTime` rather than setting them directly, so nothing clicks.
- **Tests:** keep the mapping from simulation state to sound parameters pure (for example `soundParameters(state) → { humGain, spindleHz, ... }`) and unit-test that. Do not test the audio output itself.
- **Credits:** record sound-effect authors, author links, original source URLs, stated licences and edits in `CREDITS.md`. Link to that central record from README; keep asset encoding notes separately.

## Repository rules

Work on `main` only; do not create branches or worktrees. Before committing, run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` and `npm run build`. Markdown is one paragraph per line. Do not change dependencies, build configuration, CI, Docker or Fly.io files; ask devops through `doc/requests/`. Add a short diary entry in `diary/` when you finish.
