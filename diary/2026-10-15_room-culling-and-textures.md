# Development Diary Entry - 2026-10-15

## Context

- **Date**: 2026-10-15 UTC
- **Branch**: main
- **Commit**: 48ad4fa (GPU texture unloading), then this entry's commit (facades and interiors)
- **Contributors**: Claude Code (creative lead) + owner

## Problem Statement

The owner asked for the game to hold only the textures of the room the player is in, to cut its memory footprint.

## Our Approach

Measure first. Every texture in the lab build is a procedurally drawn canvas: 605 of them, 172 MB, of which the lab holds 142 MB, the corridor 17 MB, the museum 11 MB and the plant room 2 MB; about 20 MB is exact duplicates. three.js uploads a texture the first time it is drawn and never frees it. From the corridor every room was drawn whole, because the doors belong to the room groups, so the corridor drew everything: 5,276 draw calls and 339,000 triangles.

## Implementation

- `src/rendering/room-textures.ts` records which textures each room uses and disposes those whose every room has been out of sight for four real seconds; three.js re-uploads them unchanged from the retained canvas when the room is next drawn.
- `src/rendering/room-interiors.ts` splits each room into a facade (meshes that reach outside its floor plan within reach of its doorway: doors, frames, the wall round them, signs) and an interior, which goes on the room's own camera layer. No part is listed by hand. Layers rather than `visible`, so game code that hides and shows things is undisturbed; the pointer's raycaster follows the camera's layers.
- `visibleRooms` now shows a room's interior from the corridor only through its open door. A room's group is drawn whenever the room or the corridor can be seen, so its facade is always there; this also fixes the plant door vanishing when seen across the corridor from the open lab.
- `vx3Walker.stats()` reports texture bytes by room, what is resident, the largest textures, and each room's facade and interior counts.

## Outcomes

In the corridor: 648 draw calls (from 5,276), 11,000 triangles (from 339,000), 20 MB of textures resident (from 193 MB). In the museum after visiting the lab, 28 MB rather than 159 MB. Opening a door shows the room behind it with its textures; screenshots from the corridor match the old ones.

## Next Steps

The canvases themselves stay in CPU memory (172 MB). Releasing those for rooms out of sight means rebuilding them on return, with a short delay as a door opens. Drawing each duplicated texture once would save about 20 MB.
