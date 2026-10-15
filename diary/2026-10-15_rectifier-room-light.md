# Development Diary Entry - 2026-10-15

## Context

- **Date**: 2026-10-15
- **Branch**: main
- **Contributors**: owner and Codex

## Problem Statement

The rectifier’s arc remained present, but its light could not illuminate the plant room with the ceiling lights off. Room-owned surface shaders intentionally ignore ordinary point lights to prevent cross-wall leaks, removing the rectifier’s spill too.

## Our Approach

Declare the rectifier as a local lamp belonging to the plant room. Add its blue contribution independently of the switched room fill, with position, surface direction, range and strength calculated in the surface shader.

## Implementation

The room lighting registry accepts an optional local lamp. Plant-room lit materials receive the rectifier’s shared blue colour, world position, six-metre range and pulse strength. Their switched fill is dimmed before adding the arc light and emissive surfaces. Other rooms receive no such lamp, and unlit glowing arcs retain their existing behaviour. The eight-Hz arc envelope drives both the bulb and the room spill; reduced motion remains steady. Added `plant-power=on` to the existing inspection options for repeatable dark-room checks.

## Outcomes

A browser test at `?view=rectifier&plant-power=on` showed blue illumination with ceiling lights off, no shader errors, darkness when HAUPTSCHALTER was opened, and restored illumination when closed. Tests check lamp uniform propagation and isolation from the lab, alongside the existing arc pulse tests. The user’s existing tab was not manually reloaded.

## Next Steps

Review the room-lighting intensity in play.
