# Development Diary Entry - 2026-10-15

## Context

- **Date**: 2026-10-15
- **Branch**: main
- **Contributors**: owner and Codex

## Problem Statement

The geometric CRT should move during full normal operation. The fire alarm needs pre-rendered German evacuation speech and a spoken all-clear after successful cancellation.

## Our Approach

Animate only while the world’s existing `plant.fullyOperational` output is true. Render the speech to bundled audio assets so runtime playback needs no speech service or browser voice.

## Implementation

Added a rotating polyhedron and a true sixteen-vertex, thirty-two-edge tesseract projection, drawn into one reused 256 × 192 green-phosphor framebuffer at 10 Hz. The grid and legends stay fixed. Warming, cooling, failures and reduced-motion mode retain the existing pre-rendered stills. The live circuit board, which replaced the old east board, owns the animation.

Rendered the two German scripts using `de-DE-KatjaNeural` through edge-tts 7.3.1, filtered and normalised them for PA playback, and bundled mono 44.1 kHz MP3s. The alarm announces evacuation after six seconds and repeats twenty seconds after each utterance ends. A successful reset of an active alarm interrupts it and plays one all-clear after two seconds; a refused reset does not. The tonal sounder ducks during speech. Master volume, mute and audio-context suspension apply. Reset Simulation cancels queued and playing announcements without an all-clear. The source script, encoding notes and credits are recorded in the repository.

The owner approved the clean speech and requested a Tannoy treatment. Added a 350–3400 Hz speaker band, 1.6 kHz presence boost, compression, soft clipping and short early reflections. A grey PA cabinet sits high behind the corridor trays, with a dedicated spatial bus and closed-door muffling. A separate red sounder inside the lab carries the siren. Added inspection views for both fittings.

## Outcomes

Tests cover wireframe topology and projection bounds, non-overlapping repeats, cancellation, stale asynchronous decode requests, simulation reset, audio unlock and a new alarm superseding the all-clear. Production build, typecheck, lint and formatting checks pass. Audio files decode with FFmpeg as mono 44.1 kHz MP3. The owner’s existing game was not reloaded.

## Next Steps

Review the PA voice and mix in the game.

## Startup regression and recovery

The cigarette integration initially queried a nonexistent `fire.water` graph vertex, preventing the first scene render. Corrected it to use the scene’s existing `fire.water` state, and added a contract test validating literal world-read keys in the live scene against a real world graph. The development server on 5174 also became unresponsive and was restarted. A fresh browser page then rendered without errors, opened the lab doors with E and responded to the movement control. The original user tab was not manually reloaded.
