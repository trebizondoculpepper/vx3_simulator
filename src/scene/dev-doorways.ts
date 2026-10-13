import { BoxGeometry, Group, Mesh, PlaneGeometry, Vector3 } from 'three';
import type { Material, Texture } from 'three';
import type { Footprint } from '../game/walk-collision';
import {
  DEV_DOOR_HEIGHT,
  DEV_DOOR_WIDTH,
  DEV_ROOM_NAMES,
  enterDevRoom,
} from '../game/dev-room-links';
import type { DevDoor, DevRoomId } from '../game/dev-room-links';
import { createPs1Material } from '../rendering/ps1-material';
import { createLabelTexture } from './screens';

/** Real hinged doors and shallow connecting thresholds for separately rendered rooms. */
export function createDevDoorways(
  from: DevRoomId,
  doors: readonly DevDoor[],
  floorY: number,
  metre: number,
) {
  const group = new Group();
  group.name = 'Development room doorways';
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const uses = new Map<Mesh, () => void>();
  const width = DEV_DOOR_WIDTH * metre;
  const height = DEV_DOOR_HEIGHT * metre;
  const point = new Vector3();
  let leaving = false;
  const entries = doors.map((door) => {
    const frame = new Group();
    frame.position.set(door.x, floorY, door.z);
    frame.rotation.y =
      door.side === 'north'
        ? 0
        : door.side === 'south'
          ? Math.PI
          : door.side === 'east'
            ? -Math.PI / 2
            : Math.PI / 2;
    group.add(frame);
    const box = (
      w: number,
      h: number,
      d: number,
      color: string,
      x: number,
      y: number,
      z: number,
      parent = frame,
    ) => {
      const material = createPs1Material({ color });
      material.userData.ps1Warp.value = 0;
      material.userData.ps1Pi.value = 0;
      material.userData.ps1Precision.value = 0;
      materials.push(material);
      const mesh = new Mesh(new BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.userData.noCollision = true;
      parent.add(mesh);
      return mesh;
    };
    for (const side of [-1, 1])
      box(
        0.065 * metre,
        height,
        0.34 * metre,
        '#33433a',
        side * (width / 2 - 0.015 * metre),
        height / 2,
        0,
      );
    box(
      width + 0.08 * metre,
      0.08 * metre,
      0.34 * metre,
      '#33433a',
      0,
      height + 0.04 * metre,
      0,
    );
    // A lit threshold gives the open doorway depth; crossing it loads the neighbour.
    box(
      width,
      0.06 * metre,
      1.1 * metre,
      '#6b6a5b',
      0,
      -0.03 * metre,
      -0.45 * metre,
    );
    for (const side of [-1, 1])
      box(
        0.1 * metre,
        height,
        metre,
        '#626f68',
        (side * width) / 2,
        height / 2,
        -0.6 * metre,
      );
    box(width, 0.06 * metre, metre, '#cbcbb3', 0, height, -0.6 * metre);
    const hinge = new Group();
    hinge.position.x = -width / 2 + 0.035 * metre;
    frame.add(hinge);
    const leafWidth = width - 0.07 * metre;
    const leaf = box(
      leafWidth,
      height - 0.035 * metre,
      0.065 * metre,
      '#5e6350',
      leafWidth / 2,
      height / 2,
      0,
      hinge,
    );
    box(
      leafWidth - 0.12 * metre,
      0.56 * metre,
      0.073 * metre,
      '#414c43',
      leafWidth / 2,
      0.5 * metre,
      0,
      hinge,
    );
    const handle = box(
      0.19 * metre,
      0.035 * metre,
      0.12 * metre,
      '#baac80',
      leafWidth - 0.17 * metre,
      1.05 * metre,
      0.08 * metre,
      hinge,
    );
    box(
      0.045 * metre,
      0.18 * metre,
      0.08 * metre,
      '#baac80',
      leafWidth - 0.23 * metre,
      1.05 * metre,
      0.04 * metre,
      hinge,
    );
    const label = createLabelTexture(DEV_ROOM_NAMES[door.to], {
      ink: '#e8e2cc',
      plate: '#20302b',
      size: 24,
    });
    textures.push(label.texture);
    const labelMaterial = createPs1Material({ map: label.texture }, true, true);
    labelMaterial.userData.ps1Warp.value = 0;
    labelMaterial.userData.ps1Pi.value = 0;
    labelMaterial.userData.ps1Precision.value = 0;
    materials.push(labelMaterial);
    const sign = new Mesh(
      new PlaneGeometry(width, (width * label.height) / label.width),
      labelMaterial,
    );
    sign.position.set(0, height + 0.23 * metre, 0.18 * metre);
    frame.add(sign);
    let open = false;
    let amount = 0;
    const toggle = () => {
      open = !open;
    };
    uses.set(leaf, toggle);
    uses.set(handle, toggle);
    const footprint: Footprint =
      door.side === 'north' || door.side === 'south'
        ? {
            minX: door.x - width / 2,
            maxX: door.x + width / 2,
            minZ: door.z - 0.05 * metre,
            maxZ: door.z + 0.05 * metre,
          }
        : {
            minX: door.x - 0.05 * metre,
            maxX: door.x + 0.05 * metre,
            minZ: door.z - width / 2,
            maxZ: door.z + width / 2,
          };
    return {
      door,
      frame,
      hinge,
      footprint,
      toggle,
      get amount() {
        return amount;
      },
      open() {
        open = true;
        amount = 1;
        hinge.rotation.y = Math.PI / 2;
      },
      update(delta: number) {
        amount +=
          Math.sign((open ? 1 : 0) - amount) *
          Math.min(Math.abs((open ? 1 : 0) - amount), delta * 2.5);
        hinge.rotation.y = (amount * Math.PI) / 2;
      },
    };
  });
  return {
    group,
    uses,
    entries,
    solids: () =>
      entries
        .filter((entry) => entry.amount < 0.85)
        .map((entry) => entry.footprint),
    /** Arrive just inside the matching open door, facing into this room. */
    arrival(previous: string | null) {
      leaving = false;
      const entry = entries.find((entry) => entry.door.to === previous);
      if (!entry) return undefined;
      entry.open();
      group.updateMatrixWorld(true);
      point.set(0, 0, 0.75 * metre);
      entry.frame.localToWorld(point);
      return {
        x: point.x,
        z: point.z,
        yaw: Math.PI - entry.frame.rotation.y,
        pitch: 0,
      };
    },
    update(delta: number, x: number, z: number) {
      group.updateMatrixWorld(true);
      for (const entry of entries) {
        entry.update(delta);
        point.set(x, floorY, z);
        entry.frame.worldToLocal(point);
        if (
          !leaving &&
          entry.amount > 0.85 &&
          Math.abs(point.x) < width / 2 &&
          point.z < -0.25 * metre &&
          point.z > -1.2 * metre
        ) {
          leaving = true;
          enterDevRoom(entry.door.to, from);
        }
      }
    },
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      group.removeFromParent();
    },
  };
}
