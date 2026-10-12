# Development Diary Entry - 2026-10-12

## Context

- **Date**: 2026-10-12 20:57 UTC
- **Branch**: main
- **Commit**: uncommitted workspace
- **Contributors**: creative implementation agent and owner

## Problem Statement

Knob markers appeared to rotate around their own midpoints, clicking only advanced settings, the xenon hose intersected the floor and its port was too distant from the cage, and the sink drip carried into the plant room.

## Our Approach

Put body and marker on a common shaft, resolve click direction in screen space and clamp continuous controls at their end stops. Place the gas bulkhead on the north wall beside the cage, and keep the full hose radius above the slab. Confine the quieter sink sound to the lab regardless of door openings.

## Implementation

Rack knobs and selectors rotate around their shaft groups; the auxiliary amplifier and xenon regulator now use the same body-and-marker mounting rule. All three accept left/right operation, including crosshair use and touch. The hose spline limits its lowest centreline position by the tube radius plus clearance. The drip synthesis volume is reduced from 0.24 to 0.045, and both room transmission and emission checks suppress it outside the lab. This follows the ongoing full-sized plant-room, mercury rectifier, xenon supply chain, low crouch, thermionic valve and input/indicator ownership work in the shared workspace.

## Outcomes

Typecheck, lint, formatting, all 87 tests and the production build pass. Browser clicks confirmed spindle settings increasing on the right and decreasing on the left. A crouched browser view confirmed the adjacent wall port and hose clearing the slab. Screenshots are in doc/design/screenshots/2026-10-12/knob-direction.jpg and xenon-port-clearance.jpg. Regression tests cover marker orbit under a transformed parent, screen-space left/right, reversible end stops, full hose clearance and room-only sound with both doors open.

## Next Steps

Publish the verified workspace to the existing Fly application and retain the local server on port 5174.
