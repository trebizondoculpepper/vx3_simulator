import { Box3, Mesh } from 'three';
import type { Layers, Object3D } from 'three';
import type { FloorBounds } from '../game/sound-rooms';

/**
 * Splits a room into its facade, the parts seen from the corridor (its
 * doors, their frames, the wall round them, the signs beside them), and
 * its interior, which can be seen only through an open door.
 *
 * A mesh is facade when it reaches outside the room's floor plan within
 * `reach` of the doorway; everything else is interior. Nothing has to be
 * listed by hand, so a new door part or sign is found as it is added.
 *
 * Interior meshes are moved to the room's own camera layer, and the
 * caller switches that layer on the camera only when the room can be seen
 * into. The meshes' own `visible` flags are left alone, so game code that
 * hides and shows things keeps working. Meshes added to the room later
 * stay on the default layer and are always drawn.
 */
export function splitRoom(
  roots: readonly Object3D[],
  {
    bounds,
    doorway,
    reach,
    layer,
  }: {
    bounds: FloorBounds;
    /** The doorway's centre on the floor plan. */
    doorway: { x: number; z: number };
    /** How far from the doorway facade parts may be (scene units). */
    reach: number;
    /** The camera layer for the interior (1–31). */
    layer: number;
  },
) {
  const facade: Mesh[] = [];
  const interior: Mesh[] = [];
  const box = new Box3();
  for (const root of roots) {
    root.updateWorldMatrix(true, true);
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      box.setFromObject(object);
      if (box.isEmpty()) return;
      const outside =
        box.min.x < bounds.minX ||
        box.max.x > bounds.maxX ||
        box.min.z < bounds.minZ ||
        box.max.z > bounds.maxZ;
      // Distance on the floor plan from the doorway to the nearest point
      // of the mesh's box.
      const dx = Math.max(box.min.x - doorway.x, 0, doorway.x - box.max.x);
      const dz = Math.max(box.min.z - doorway.z, 0, doorway.z - box.max.z);
      if (outside && Math.hypot(dx, dz) <= reach) facade.push(object);
      else {
        object.layers.set(layer);
        interior.push(object);
      }
    });
  }
  return {
    facade,
    interior,
    /** Draw (and let the pointer reach) the interior, or not. */
    show(layers: Layers, shown: boolean) {
      if (shown) layers.enable(layer);
      else layers.disable(layer);
    },
  };
}
