import { Mesh } from 'three';
import type { Color, Material, Object3D, Scene, Vector3 } from 'three';

export interface RoomLight {
  value: number;
}

/** A powered lamp whose spill belongs only to its declared room. */
export interface RoomLamp {
  position: { value: Vector3 };
  color: { value: Color };
  range: { value: number };
  strength: { value: number };
}

export interface RoomDefinition {
  id: string;
  level: RoomLight;
  lamp?: RoomLamp;
}

export interface RoomAudit {
  unowned: Mesh[];
  multiplyOwned: Mesh[];
}

/**
 * Records surface ownership independently of visibility and position.
 * Materials are copied only when the same original is used in two rooms.
 */
export function createRoomLighting() {
  const rooms = new Map<string, RoomDefinition>();
  const owners = new Map<Mesh, string>();
  const duplicates = new Set<Mesh>();
  const materialOwners = new WeakMap<Material, string>();
  const roomCopies = new WeakMap<Material, Map<string, Material>>();
  const copies: Material[] = [];

  const defineRoom = (id: string, level: RoomLight, lamp?: RoomLamp) => {
    if (rooms.has(id)) throw new Error(`Room already defined: ${id}`);
    const room = { id, level, lamp };
    rooms.set(id, room);
    return room;
  };

  const registerMesh = (room: RoomDefinition, mesh: Mesh) => {
    const existing = owners.get(mesh);
    if (existing && existing !== room.id) {
      duplicates.add(mesh);
      return;
    }
    if (existing) return;
    owners.set(mesh, room.id);
    const assign = (source: Material) => {
      const previous = materialOwners.get(source);
      let material = source;
      if (previous && previous !== room.id) {
        let byRoom = roomCopies.get(source);
        if (!byRoom) {
          byRoom = new Map();
          roomCopies.set(source, byRoom);
        }
        const known = byRoom.get(room.id);
        if (known) material = known;
        else {
          material = source.clone();
          byRoom.set(room.id, material);
          copies.push(material);
        }
      }
      materialOwners.set(material, room.id);
      material.userData.ps1Room = room.level;
      material.userData.ps1RoomLamp = room.lamp;
      material.userData.ps1LocalRoom = true;
      material.needsUpdate = true;
      return material;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(assign)
      : assign(mesh.material);
  };

  const registerRoot = (room: RoomDefinition, root: Object3D) => {
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const declared = object.userData.roomId as string | undefined;
      const owner = declared ? rooms.get(declared) : room;
      if (!owner) throw new Error(`Unknown room declared on mesh: ${declared}`);
      registerMesh(owner, object);
    });
  };

  const audit = (scene: Scene): RoomAudit => {
    const unowned: Mesh[] = [];
    scene.traverse((object) => {
      if (object instanceof Mesh && !owners.has(object)) unowned.push(object);
    });
    return { unowned, multiplyOwned: [...duplicates] };
  };

  const dispose = () => {
    for (const material of copies) material.dispose();
  };

  return { defineRoom, registerMesh, registerRoot, audit, dispose };
}
