# Development Diary Entry - 2026-10-13

## Context

- **Date**: 2026-10-13
- **Branch**: main
- **Commit**: uncommitted working tree
- **Contributors**: creative lead agent and project owner

## Problem Statement

Try the analysed redline mission as a playable fire incident, including a manual call point, corridor reset, sprinklers and the first terminal failure states.

## Our Approach

Keep timing and recovery decisions in a pure incident model, then connect its state and transition events to the existing rack, room, audio and log systems. Preserve the current main worktree and concurrent edits.

## Implementation

Added sustained smoke detection, a three-second sprinkler delay, powered device ignition, cumulative fire duration, a five-second live-water grace period, and reset rules. The lab call point and corridor panel are physical controls with German labels. Beacons, detector lamps, simple spray and puddles, flame lights, wiring discharge, log entries and a terminal on-screen reset present the sequence. Machine controls lock after ruin while doors and movement remain available. Browser inspection caught a metre-to-world-unit scaling error in the new panels; the call point was resized and moved clear of the light switch. The corridor telephone's face and sign now use corridor lighting instead of the dark lab circuit. The lab call point now follows the owner's break-glass reference, while the corridor cabinet follows the red enclosure, pale inset and recessed display of the [RP-2002 product photograph](https://gb.wiautomation.com/honeywell/general-automation/general-automation/rp2002); both are original scene geometry and textures.

The sprinkler presentation now emits droplets directly from the modeled lab heads, spreads them in a falling fan, and adds small floor splashes at the impact area. A continuous filtered water hiss follows the water state, and the call point has its own press cue. The water closes automatically after 45 seconds, including after terminal ruin. Both room light switches now share the lab-style rocker with a yellow locator lamp when off. The particle approach follows Unity's shape and plane-collision guidance and Three.js dynamic buffer geometry rather than a fluid simulation.

## Outcomes

Pure tests cover exposure interruption, manual call, recovery, both ruin causes and reset refusal. Typecheck, lint, formatting, 134 tests and production build pass. The local server serves the updated scene, and visual inspection confirmed the call point is clear of the light switch and the phone is readable. The water/fire presentation remains a first pass; a sustained in-game playthrough and sound design remain to be reviewed.

## Next Steps

Exercise a severe, stable redline in the browser to confirm the fire route beats the water short; inspect placement, visual quality and audio; tune only the proposed detector and ignition values if the actual playthrough warrants it.
