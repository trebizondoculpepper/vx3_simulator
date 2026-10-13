# Development Diary Entry - 2026-10-13

## Context

- **Branch**: main
- **Contributors**: implementation agent and owner

## Problem Statement

The owner requested that the printer respond only to model-changing operator actions, asked for five quieter printer recordings from a video, requested playback of the generated music through the cassette player, and reported plant lights appearing on before entry then going dark inside.

## Implementation

Printer transactions compare machine state before and after an operator action. Only a real model change sends its timestamped log entries to the printer; unlogged machine controls receive a short action entry. Doors, lighting, taps, tape transport, refused inputs, end stops and automatic status reports remain notebook-only. The subsequent request to find better effects supplied scope to select a real public-domain Star LC-10 recording by Priwo. Five distinct 0.70-second excerpts replace the synthesised burst at a quiet playback gain. The requested video URL was not supplied, so these are credited as the independently sourced recording rather than that video. Paper feed and sound cues occur only during printing, once per line.

The four generated tracks are present with measured loop guards in `public/music/manifest.json`. Buffered Web Audio playback follows their cassette order and repeats after the fourth track. Stop retains position; Play resumes it; Fast Forward advances audibly at five times speed and one-quarter gain, with the natural higher tape pitch. Playback uses the cassette's spatial source, door transmission and the existing master volume/mute/visibility controls. Only the current and following track are retained in the decode cache. The reel animation also runs five times faster. The README credits the original locally generated music and links its detailed provenance record.

Plant meshes and their local lights now use a dedicated lighting layer, with separate fill lights driven solely by the plant switch. They no longer borrow the lab's illumination while viewed from the corridor. The rectifier's shadow camera uses the same layer. The existing plant-switch state starts off; `lights=on` now applies only to the lab, while a separate `plant-lights=on` inspection override is explicit.

## Verification

Tests cover model-changing action filtering, refused/no-op inputs, unlogged controls, nested transactions, cassette Stop/resume, five-times advance, quarter gain, playlist wrap, actual buffer-source rate changes, decoded guard offsets and source cleanup.

## Sound Audit

The column’s head pump, purge hiss, end-stop and clamp sounds, hot/spinning core voice and two failure sounds existed only in the dev room. They are now wired to the live lab model, on the shared audio context with spatial attenuation and room transmission. The recirculator gains a quiet fan/pump loop while working. Recorded metal-door hinge textures replace generic switch-like door and cage sounds. `CREDITS.md` centralises every recorded-effect author, source URL, licence and edit; README links there, and the asset README contains encoding/excerpt details. Future sound prompts and the agent guide name this central record.

The owner reported the new hinge recording was too loud; its playback gain was reduced from 0.2 to 0.03 (15% of the earlier level, about −16.5 dB), with a regression assertion for the quieter gain.

The owner requested quieter mechanical buttons, relocation of the safety pin-board above the west-wall trunking, explicit resulting-state log messages and a slightly random 1–2 second teletype response. Buttons and door latches now use a short CC0 cassette-key click. Individual column power selections are recorded even while another switch keeps the rig off; unlogged inputs get a state description instead of “operated”. The notebook remains immediate and printer jobs retain action order after the delayed response.

The owner wanted to audition controls in the development room. Shared defaults now give push-buttons/keycaps a recorded key-style press, switches a crisp recorded click and rockers a separate deeper click. The development control test uses the same recordings as the lab, with `?room=dev&view=controls` as a direct inspection view. Switch recordings are attributed to StevenBrown under CC BY 3.0; cassette-key recordings remain Joseph Sardin CC0. The old synthetic button cue is removed, including the electronic blip used for door latches.

Validation: typecheck, ESLint, Prettier check, all 213 tests across 43 files and the production build passed. Fresh local browser previews verified the control-test viewpoint, enabled audio with no warnings/errors and confirmed the safety board clears the west-wall trunking. Screenshots are saved under `doc/design/screenshots/2026-10-13/`. The existing user game tab was not reloaded.
