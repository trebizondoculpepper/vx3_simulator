import type { DoorOpenings, RoomId } from './sound-rooms';

/**
 * A corridor hub with three doors. The bordering rooms are always drawn from
 * the corridor so their door leaves remain visible; other interiors are
 * reached only through open links. This graph decides visibility, not light.
 */
export function visibleRooms(
  viewer: RoomId,
  doors: DoorOpenings,
): Record<RoomId, boolean> {
  if (viewer === 'corridor')
    return { lab: true, plant: true, museum: true, corridor: true };
  const through = doors[viewer] > 0.05;
  return {
    lab: viewer === 'lab' || (through && doors.lab > 0.05),
    plant: viewer === 'plant' || (through && doors.plant > 0.05),
    museum: viewer === 'museum' || (through && doors.museum > 0.05),
    corridor: true,
  };
}
