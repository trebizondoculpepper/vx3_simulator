import type { RoomId } from './sound-rooms';

/**
 * Which rooms are worth drawing from where the viewer stands. The lab and
 * the plant room share only a solid wall and each opens onto the corridor
 * by its own door in the same wall, so neither can be seen from inside the
 * other. From the corridor both doorways are in view.
 */
export function visibleRooms(viewer: RoomId): Record<RoomId, boolean> {
  return {
    lab: viewer !== 'plant',
    plant: viewer !== 'lab',
    corridor: true,
  };
}
