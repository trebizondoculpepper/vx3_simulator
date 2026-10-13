# Mission brief: reality distortion effects

A future mission, briefed from the owner's "distortion suggestions" notes of 13 October 2026. Nothing below is built yet unless marked. Try each effect in the effects room (`/?room=dev1`) before it goes into the lab.

## The direction

Mathematical horror, not psychedelic horror. The room must stay perfectly real while the rules that define it stop holding: constants drift, geometry stops agreeing with itself, light and time fall out of step. The best effects start as tiny errors of perception that the player half-doubts, such as a control panel whose reflection has one extra switch, or a doorframe whose perspective is wrong only once you step sideways.

## Already in the effects room

- **Non-Euclidean warp** (in the lab already): a vertex twist about the line of sight and a swell of distances. It can now be centred on a point with a reach, so space recovers as you walk away. The lab still bends everywhere alike; centring it on the ferrocores is a small step.
- **π drift** (in the lab already): drives the clock, dials and the π ring. Still to do: let it reach circular geometry itself, by rescaling each vertex's angle about its object's axis by π′/π, so cylinders, knobs and dials visibly fail to close.
- **Colour channel phaser** (in the lab already): each channel's brightness breathes on its own cycle.
- **Chromatic divergence** (effects room only): red and blue drawn from different places than green, radially, by a turning shift, and by depth parallax so near things split further than far ones. It is a full-screen pass over a target with depth; `ps1Uniforms.linearTarget` keeps the dither looking the same.
- **Lost numerical precision** (effects room only): world positions snap to a coarse grid and tremble. Each material can opt out through `userData.ps1Precision`, so some things hold together while others disintegrate.
- **Topological tears**, found by accident: a strong warp pulls apart surfaces that only meet at their edges. Worth keeping on purpose.

## Still to build

| Effect                     | What the player sees                                                                    | Likely approach                                  |
| -------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Temporal echoes            | Moving things leave solid copies of where they were; some echoes move first             | History render targets and feedback              |
| A second rendering history | The lab as it is and as it was, blended by a spatial field; an instrument in two places | Render twice with different states and composite |
| Shadows that disagree      | Shadows pointing toward lights, belonging to other objects, moving on their own         | Proxy shadow casters, animated light directions  |
| Depth inversion            | Distant things drawn in front of near ones                                              | Custom depth test or compositing                 |
| Perspective disagreement   | Objects with different vanishing points                                                 | Per-object projection matrices                   |
| Backwards parallax         | Distant walls moving faster than near objects                                           | Depth-dependent screen warp                      |
| Impossible reflections     | A mirror showing a slightly different lab                                               | Second camera and render target                  |
| Negative illumination      | Lights that darken                                                                      | Custom lighting term                             |
| Texture drift              | Labels and markings sliding across solid objects                                        | Animated texture coordinates                     |
| Local time bubbles         | Objects animating at their own rate, some backwards                                     | Per-object clocks                                |
| Object duplication         | An instrument in two places at once                                                     | Ghost meshes                                     |
| Causality inversion        | A switch moving before it is touched                                                    | Predictive animation                             |
| Normal corruption          | Surfaces lit from impossible angles                                                     | Perturbed normals in the fragment shader         |
| Fractional dimensions      | Edges that turn fractal                                                                 | Procedural displacement                          |
| Spatial recursion          | A doorway that shows the same doorway again                                             | Recursive portal rendering                       |

## Structure

One distortion system with independently controlled effects, fed by the rig's activation, instability and end state, rather than effects hard-coded into the end-state sequence. `src/game/effect-settings.ts` is the start of it: every dial on every effect, with `settingsForActivity` reproducing the lab.

Stage the effects with activation, roughly: at about 12%, subtle divergence and barely perceptible curvature; at 40%, lost precision, anomalous shadows, drifting textures and echoes; at 72%, objects disagreeing about projection, portals, reversed time bubbles and wrong reflections; at full activation, competing coordinate systems, tears, severe distortion and overlapping timelines. Make the distortion depend on distance from the apparatus, so the player can walk away and watch reality partly recover, until the terminal state.

Stay on `WebGLRenderer`. Moving to WebGPU would mean rewriting the PS1 material every surface uses, and nothing here needs it; `three/addons` post-processing is enough.
