# Room lighting: one light state per room, by declaration

Design note, 14 October 2026. Proposes how the game lights a series of connected rooms (lab, plant room, corridor, museum and whatever comes next) so that each room's lighting is its own and cannot bleed into the next. Nothing here is built yet. It is written for the owner and for whichever agent takes it on; it touches `start-scene.ts`, `ps1-material.ts` and every room, so agree who does it first.

## The problem

We keep hitting the same fault in new forms: one room's lighting state shows in another. The plant room borrowed the lab's light through its door until it was given its own pass; the corridor needed its own permanently lit circuit; and, as of today, looking south along the corridor the whole wall renders black (the museum, which is another agent's work in progress, is not the subject here, only an example of the pattern).

## How lighting works now

Two mechanisms, used together:

- **Render layers** (`src/rendering/hallway-render.ts`). Three.js lights reach every mesh the camera can see, whatever the mesh's layer. To keep rooms apart, each room's meshes and its own lights are put on one layer (the lab on layer 0, the plant room on 1, the corridor on `HALLWAY_LAYER`, 2), and `renderWithHallwayLighting` draws the scene once per layer, each pass seeing only that layer's lights. Rooms are put on their layer by walking their groups, with exceptions patched afterwards (`plantRoom.entryParts`, which face the corridor, go back to the corridor's layer).
- **A room light level in the PS1 shader** (`ps1Room` in `src/rendering/ps1-material.ts`). A material can carry its room's light level as a uniform, which dims it as that room's switch does. `dimPrintedWith` assigns it to everything under some roots, deciding in places which room a mesh is in from where it is (`outside(mesh)` tests coordinates).

## Why it keeps going wrong

1. **Room membership is implicit.** Nothing records which room a mesh belongs to. Layers are set by traversing groups, then patched; the shader's room level is assigned by root, then partly by position. A new room, or a part that straddles two, has no defined owner.
2. **Boundaries are one mesh seen from two rooms.** A wall, door or doorway lining between two rooms is a single mesh, so it can belong to only one room's layer and carry only one room's light level. From the other side it is lit wrongly: dark when its room is dark, or lit by the wrong lights.
3. **The room light level lives on the material.** `ps1Room` is read from `material.userData` when the shader compiles, so a material shared by meshes in two rooms can only follow one of them. Shared panel kits and paints make this easy to do by accident.
4. **A pass per room costs a full render each** and grows with every room added, and the order and clearing between passes are fragile.

## What the sources say

- In WebGLRenderer, a light in the scene lights every object in it; layers decide only what the camera draws, so they cannot give selective lighting ([Layers and lights](https://discourse.threejs.org/t/layers-and-lights/4155), [Per-object lights](https://discourse.threejs.org/t/per-object-lights/44987)).
- The usual WebGL workaround is separate scenes, or passes, each with its own lights, drawn in turn ([Selective light](https://discourse.threejs.org/t/selective-light/30749)). That is what `renderWithHallwayLighting` does.
- WebGPURenderer does support selective lights per material ([Per-object lights, reply](https://discourse.threejs.org/t/per-object-lights/44987/6)). Moving to it would mean rewriting the PS1 material every surface uses, which the reality distortion brief already decided against.
- Classic engines split the world into cells (rooms) joined by portals (doorways) to decide what to draw ([Portal rendering](https://en.wikipedia.org/wiki/Portal_rendering)); that is visibility, not lighting, so each cell still needs its own light state.
- PlayStation games used almost no real-time lights: lighting was precomputed into vertex colours, multiplied with the texture, and did most of the visual work ([PS1 lighting discussion](https://redlib.hbubli.cc/r/blenderhelp/comments/1k8g41e/ps1_textures_looking_flat), [Vertex Lightmapper](https://github.com/bigsnake09/Vertex-Lightmapper)). Mixing baked vertex lighting with real lights is a known way to get surfaces that go black ([Panda3D: mixing dynamic and baked lights](https://discourse.panda3d.org/t/mixing-dynamic-and-baked-lights/12505)).

## The proposal

Light each room by its own light level in the shader, with every mesh declared as belonging to exactly one room. This stays on WebGLRenderer, suits the PS1 look, and makes bleed impossible by construction rather than by patching.

1. **Rooms are declared.** A small registry, `defineRoom(id, { level })`, holds each room: its id, its light level (a uniform), and later its baked light sets. Each room's builder registers its root groups with it, and every mesh under them belongs to that room. Nothing is assigned by position.
2. **Every mesh belongs to exactly one room.** In development, the scene is audited on load, as controls are today: any mesh in no room, or in two, is logged. A material is never shared between rooms; registering a mesh in a room gives it that room's copy of its material.
3. **Light comes from the room's light level, not from Three.js lights.** The shader's existing room level (`ps1Room`) becomes the normal way a surface is lit: the room's level times the surface's own shading. A room's lamps and switches set its level through the world model (the plant powered, the lights switched on), so lighting follows the same rule as sound: the world says what is true, the room's fittings show it. Three.js lights are kept only where an effect needs one (a spotlight on a plinth, the fire's glow, the sparks), and then only as that room's own; see point 6.
4. **Boundaries are split.** A wall, door, frame or lining between two rooms is built as two meshes, one face in each room, so each side is lit by the room it faces. The corridor's side of the lab door belongs to the corridor; the lab's side to the lab. Builders that make a doorway make both halves.
5. **Optionally, bake.** For more than a flat level, precompute vertex colours for each room's light states (lights on, lights off, emergency lighting), and let the shader blend between them by the room's level. This is how PS1 games looked, and it gives soft corners and pools of light without a single real-time light.
6. **Where a real light is unavoidable,** it is drawn in a pass of its own room only, as now, and the room's builder says so. These should be rare and named, not the default.
7. **Visibility is separate.** A room graph (rooms joined by doorways, each open or shut) decides which rooms are drawn from where the viewer stands. It generalises `visibleRooms` in `src/game/room-visibility.ts` and the dev wing's `src/game/dev-room-links.ts`. Lighting never depends on it.

## What it replaces

- `renderWithHallwayLighting` and the per-room layers, except for the rare named passes in point 6.
- `dimPrintedWith`'s position tests, replaced by declared membership.
- The patches that move individual parts between layers (`plantRoom.entryParts` and the like), replaced by split boundaries.

## Moving to it

1. Add the room registry and the development audit, reporting what is in no room or two, without changing how anything is lit. The audit's first report is the list of what to fix.
2. Give each existing room its own material copies and light level, room by room (corridor, lab, plant room), checking each with screenshots from both sides of every doorway.
3. Split the boundary meshes: the lab door and its frame, the plant-room door, the dev wing's doorway, and any others the audit finds.
4. Replace the lab's, plant room's and corridor's Three.js lights with their room levels, keeping only the named effect lights; then retire the layer passes.
5. Bake light sets where a room wants more than a flat level.
6. New rooms (the museum included, when its author is ready) register with the registry from the start.

## Done when

Every mesh belongs to exactly one room and the audit is clean; switching any room's lights changes only that room, seen from inside it and through every doorway; and adding a room needs no layer, pass or patch.
