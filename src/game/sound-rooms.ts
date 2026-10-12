/**
 * Which room a sound is in, and how much of it reaches a listener in
 * another room. The lab and the plant room each open onto the basement
 * corridor through their own door, and share only a solid wall, so sound
 * between them has to go out through one door and in through the other. A
 * closed door stops a sound completely.
 */

export type RoomId = 'lab' | 'plant' | 'corridor';

export interface FloorBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface RoomPlan {
  lab: FloorBounds;
  plant: FloorBounds;
}

/** How far each door is open, from 0 (shut) to 1 (wide open). */
export interface DoorOpenings {
  lab: number;
  plant: number;
}

const within = (bounds: FloorBounds, x: number, z: number) =>
  x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;

/** The room a point on the floor plan is in; anywhere else is corridor. */
export function roomAt(plan: RoomPlan, x: number, z: number): RoomId {
  if (within(plan.lab, x, z)) return 'lab';
  if (within(plan.plant, x, z)) return 'plant';
  return 'corridor';
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** The share of a sound's level that passes from one room to another. */
export function transmission(
  from: RoomId,
  to: RoomId,
  doors: DoorOpenings,
  roomOnly = false,
): number {
  if (from === to) return 1;
  if (roomOnly) return 0;
  const door = (room: RoomId) =>
    room === 'lab'
      ? clamp(doors.lab)
      : room === 'plant'
        ? clamp(doors.plant)
        : 1;
  return door(from) * door(to);
}
