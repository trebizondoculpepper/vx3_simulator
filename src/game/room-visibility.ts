import type { DoorOpenings, RoomId } from './sound-rooms';

/**
 * A corridor hub with three doors: which rooms' interiors can be seen from
 * where the viewer stands. From the corridor, a room's interior shows only
 * through its open door; its door leaves, frame and signs are its facade,
 * drawn whenever the corridor can be seen (src/rendering/room-interiors.ts).
 * Other interiors are reached only through open links. This graph decides
 * visibility, not light.
 */
export function visibleRooms(
  viewer: RoomId,
  doors: DoorOpenings,
): Record<RoomId, boolean> {
  if (viewer === 'corridor')
    return {
      lab: doors.lab > 0.05,
      plant: doors.plant > 0.05,
      museum: doors.museum > 0.05,
      corridor: true,
    };
  const through = doors[viewer] > 0.05;
  return {
    lab: viewer === 'lab' || (through && doors.lab > 0.05),
    plant: viewer === 'plant' || (through && doors.plant > 0.05),
    museum: viewer === 'museum' || (through && doors.museum > 0.05),
    corridor: true,
  };
}
