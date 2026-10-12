# Development Diary Entry - 2026-10-12

## Context

- **Date**: 2026-10-12
- **Branch**: main
- **Commit**: uncommitted
- **Contributors**: creative agent + owner

## Problem Statement

Remove the VX3 Full Rig overlay, replace the pedestal ashtray with an ordinary bench ashtray near the sink, and make the sink a deeper white porcelain basin.

## Our Approach

Removed the heading markup, its frame-loop updates and unused styles, and moved camera and sound controls into the freed space. Reused the existing glass ashtray without its stand. Corrected the cupboard geometry that previously filled the basin interior.

## Implementation

Placed a 150 mm glass ashtray on the worktop just north of the sink. Increased the basin depth to 380 mm, lowered the solid cupboard body below it and added a thick raised porcelain rim with a smoother white material. Tap operation and its stream still use the basin's dimensions. Updated the workstation record and plan.

## Outcomes

Local browser inspection confirmed the removed overlay, clear controls, small bench ashtray and visibly hollow white sink. No browser errors were reported. Shared workspace changes were preserved.

## Next Steps

The overlay, ashtray and sink update was published successfully. The owner then requested a BBC Micro Model B beneath the Cub and correction of the xenon manifold intersecting the tank bodies. Added a metre-scaled cream computer with a sloping black keyboard, red function keys, model badge and vents, and raised the Cub onto its rear deck. Corrected the cylinder shoulder height so the valves no longer sit inside the domes; moved the manifold forward beyond the cylinder radius and connected each valve with a curved copper pigtail. The regulator and feed hose move with the manifold.

Model B proportions were checked against the [Science Museum Group catalogue](https://collection.sciencemuseumgroup.org.uk/objects/co8033133/bbc-microcomputer-model-b-1986-microcomputer); keyboard and case details use the [Centre for Computing History record](https://www.computinghistory.org.uk/pages/cache/FULL-182.htm). The model is original simplified scene geometry, not a downloaded asset. Direct ?view=computer and ?view=xenon inspection views support browser verification.

Final checks passed typecheck, lint, formatting, all 59 tests and production build. The updated version was deployed with Fly.io's remote builder and verified in the live browser without console errors. Screenshots record the BBC/Cub, external xenon manifold and revised workbench under doc/design/screenshots/2026-10-12. Changes remain uncommitted on main.

The owner requested sliding the teletype right toward the control console. Positioned its casing 80 mm from the console's nearest edge and moved its wall brackets, stock and output pile with it. Local browser inspection confirmed the adjacent arrangement without overlap; all five project checks passed again.
