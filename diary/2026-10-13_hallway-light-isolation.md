# Development Diary Entry - 2026-10-13

## Context

- **Date**: 2026-10-13
- **Branch**: main
- **Commit**: working changes, uncommitted
- **Contributors**: Codex + owner

## Problem Statement

Posters, the Cub monitor and panel display faces flickered while turning, and hallway lighting affected the lab despite different object layers.

## Our Approach

Keep the poster face explicitly one millimetre ahead of the frame backing and apply a local polygon depth offset. Draw the hallway in a separate pass because Three.js selects lights by camera layers, rather than matching each light's layer to each receiving mesh.

## Implementation

Added `renderWithHallwayLighting`: first render the existing room layers without hallway lights, then draw only the hallway with its lights, without clearing colour or depth. Temporarily remove the background on the second pass to avoid Three.js forcing a clear. Restore camera, background and renderer state even after errors. Include the hallway fire beacon and outward-facing plant entrance parts in the hallway layer, and enable that layer for interaction raycasts.

Set the Cub screen, east panel CRT and LED readouts, and seven-segment display windows one millimetre ahead of their backing faces. Apply a local polygon depth offset to their display materials. Move the Cub cursor with the screen so it remains ahead of the glass.

## Outcomes

All 222 tests and the production build passed, along with TypeScript, scoped lint and changed-file formatting checks. Focused regression tests cover light separation, preserving the shared depth buffer, single-pass views without the hallway, and restoration after a render failure. Chrome inspection views show the hallway illuminated and the lab dark with the lab switch off. Sustained turning checks for the display surfaces remain outstanding.

## Next Steps

Check the poster faces while turning and verify that toggling the lab lights leaves the hallway lit while the lab becomes dark.
