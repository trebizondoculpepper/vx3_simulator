# Request: add `@preact/signals-core` as a runtime dependency

Requested by the project owner on 14 October 2026, and installed at their direction in the same session, so this file records it for devops review rather than asking first.

## What

`@preact/signals-core` 1.14.4, pinned exactly (`npm install --save-exact`). MIT licence, no dependencies of its own, released 7 July 2026. It has nothing to do with Preact or React at runtime: it is the framework-free signals core.

## Why

The owner asked for the world simulation to be rebuilt as a directed graph of cached functions, where a node whose inputs have not changed is not recomputed and nothing downstream of an unchanged value runs. That is what signals do (`signal`, `computed`, `batch`, with early cutoff when a recomputed value is unchanged). The new model lives in `src/game/world/` and is pure logic with tests; it is not yet wired into the scene.

## Outcome

(Devops: record the review outcome here.)
