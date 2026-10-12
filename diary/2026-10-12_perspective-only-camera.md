# Development Diary Entry - 2026-10-12

## Context

- **Date**: 2026-10-12 21:58 UTC
- **Branch**: main
- **Commit**: 6cbc339
- **Contributors**: creative lead agent with Salim Fadhley

## Problem Statement

The operator should use only the first-person perspective camera, without a perspective/isometric selector.

## Our Approach

We removed the second camera and its view state, then connected the remaining wheel and navigation controls directly to first-person movement.

## Implementation

The view switch and its styles are gone. The renderer, raycaster and audio listener now use the perspective camera. Mouse wheel moves the operator forward and back, horizontal wheel motion steps sideways, and Option/Alt plus wheel adjusts eye height. The on-screen arrows remain movement controls; the plus and minus buttons adjust field of view. The README and plan describe the single camera.

## Outcomes

The local browser shows only the sound and movement controls, and the forward button moves the viewpoint. Typecheck, lint, format check, 112 tests and production build passed.

## Next Steps

Continue tuning first-person navigation as the room fills with apparatus.
