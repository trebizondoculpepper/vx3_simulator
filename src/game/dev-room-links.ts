import type { Footprint } from './walk-collision';

export type DevRoomId =
  'corridor' | 'dev0' | 'dev1' | 'dev2' | 'dev3' | 'dev4' | 'museum';
export type DoorSide = 'north' | 'south' | 'east' | 'west';
export interface DevDoor {
  to: DevRoomId;
  side: DoorSide;
  x: number;
  z: number;
}

export const DEV_ROOM_NAMES: Record<DevRoomId, string> = {
  corridor: 'HAUPTFLUR',
  dev0: 'DEV0 · ENTWICKLUNG',
  dev1: 'DEV1 · EFFEKTE',
  dev2: 'DEV2 · BAUTEILE',
  dev3: 'DEV3 · ARCHIV',
  dev4: 'DEV4 · TRUGBILDER',
  museum: 'VX-MUSEUM',
};
export const DEV_DOOR_WIDTH = 1.2;
export const DEV_DOOR_HEIGHT = 2.2;

/** A row of adjacent rooms, with the archive accessed below its north cordon. */
export function devDoors(
  id: Exclude<DevRoomId, 'corridor'>,
  bounds: Footprint,
  metre: number,
): DevDoor[] {
  const laneZ = bounds.maxZ - 1.1 * metre;
  const west = (to: DevRoomId): DevDoor => ({
    to,
    side: 'west',
    x: bounds.minX,
    z: laneZ,
  });
  const east = (to: DevRoomId): DevDoor => ({
    to,
    side: 'east',
    x: bounds.maxX,
    z: laneZ,
  });
  switch (id) {
    case 'museum':
      return [
        {
          to: 'corridor',
          side: 'north',
          x: (bounds.minX + bounds.maxX) / 2 - 2.475 * metre,
          z: bounds.minZ,
        },
      ];
    case 'dev0':
      return [
        {
          to: 'corridor',
          side: 'north',
          x: (bounds.minX + bounds.maxX) / 2,
          z: bounds.minZ,
        },
        east('dev1'),
      ];
    case 'dev1':
      return [west('dev0'), east('dev2')];
    case 'dev2':
      return [west('dev1'), east('dev3')];
    case 'dev3':
      return [west('dev2'), east('dev4')];
    case 'dev4':
      return [west('dev3')];
  }
}

export interface WallPiece extends Footprint {
  bottom: number;
  top: number;
}

/** Masonry stops at each jamb; only the lintel spans the opening. */
export function devWallPieces(
  bounds: Footprint,
  doors: readonly DevDoor[],
  metre: number,
  height: number,
): WallPiece[] {
  const pieces: WallPiece[] = [];
  const thick = 0.3 * metre;
  for (const side of ['north', 'south', 'west', 'east'] as const) {
    const horizontal = side === 'north' || side === 'south';
    const edge =
      side === 'north'
        ? bounds.minZ
        : side === 'south'
          ? bounds.maxZ
          : side === 'west'
            ? bounds.minX
            : bounds.maxX;
    const start = horizontal ? bounds.minX : bounds.minZ;
    const end = horizontal ? bounds.maxX : bounds.maxZ;
    const door = doors.find((d) => d.side === side);
    const add = (a: number, b: number, bottom = 0) => {
      if (b <= a) return;
      pieces.push(
        horizontal
          ? {
              minX: a,
              maxX: b,
              minZ: edge - thick / 2,
              maxZ: edge + thick / 2,
              bottom,
              top: height,
            }
          : {
              minX: edge - thick / 2,
              maxX: edge + thick / 2,
              minZ: a,
              maxZ: b,
              bottom,
              top: height,
            },
      );
    };
    if (!door) {
      add(start, end);
      continue;
    }
    const at = horizontal ? door.x : door.z;
    const half = (DEV_DOOR_WIDTH * metre) / 2;
    add(start, at - half);
    add(at + half, end);
    add(at - half, at + half, DEV_DOOR_HEIGHT * metre);
  }
  return pieces;
}

/** Door transitions are handled by the app, without reloading the browser. */
export function enterDevRoom(to: DevRoomId, from: DevRoomId) {
  window.dispatchEvent(new CustomEvent('vx3-room', { detail: { to, from } }));
}
