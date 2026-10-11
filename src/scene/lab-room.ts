import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  PointLight,
} from 'three';
import type { BufferGeometry, Material, Texture } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createLabelTexture } from './screens';

export interface LabRoomOptions {
  floorY: number;
  worldUnitsPerMetre: number;
  /** Underside of the ceiling. */
  ceilingY: number;
  /** Inner faces of the four walls. The main cabinet stands against minZ. */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const WALL = '#626f68';
const DADO = '#344d48';
const RAIL = '#d0c3a0';
const SKIRT = '#373d38';
const TUBE_ON = new Color('#eef6e4');
const TUBE_OFF = new Color('#3c423c');

interface Fixture {
  pivot: Group;
  tubes: Material & { color: Color };
  light: PointLight;
  phase: number;
  /** Seconds until this fixture next misbehaves. */
  nextFlicker: number;
  /** Time into the current flicker, or -1 when steady. */
  flickerAt: number;
  pattern: number[];
}

/**
 * Flicker patterns as alternating on/off durations in seconds. None flashes
 * faster than three times a second, keeping it within photosensitivity
 * guidance; the long dark gaps are what make it unsettling.
 */
const patterns = [
  [0.35, 0.4, 0.5, 0.35, 0.9],
  [0.6, 1.4],
  [0.35, 0.35, 0.35, 0.35, 0.4, 2.2],
  [0.45, 0.6, 0.4, 0.35],
];

/**
 * The square VX lab around the main cabinet: side walls and a front wall
 * with a door opposite the cabinet, a full floor, a tall ceiling, and
 * fluorescent tube fittings hanging on long rods that sway slowly and,
 * very occasionally, flicker.
 */
export function createLabRoom(options: LabRoomOptions) {
  const { floorY, ceilingY, minX, maxX, minZ, maxZ, worldUnitsPerMetre } =
    options;
  const group = new Group();
  group.name = 'LabRoom';
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const mesh = (
    geometry: BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    parent: Group = group,
    unlit = false,
  ) => {
    const material = createPs1Material({ color }, unlit);
    materials.push(material);
    const result = new Mesh(geometry, material);
    result.position.set(x, y, z);
    parent.add(result);
    return result;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
  ) => mesh(new BoxGeometry(w, h, d), color, x, y, z);

  const width = maxX - minX;
  const depth = maxZ - minZ;
  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;
  const height = ceilingY - floorY;
  const midY = (floorY + ceilingY) / 2;

  // Floor with seams on a 1.5-unit grid.
  box(width + 0.4, 0.3, depth + 0.4, '#706d60', midX, floorY - 0.18, midZ);
  for (let x = Math.ceil(minX / 1.5) * 1.5; x <= maxX; x += 1.5)
    box(0.025, 0.008, depth, '#56594f', x, floorY - 0.02, midZ);
  for (let z = Math.ceil(minZ / 1.5) * 1.5; z <= maxZ; z += 1.5)
    box(width, 0.008, 0.025, '#56594f', midX, floorY - 0.02, z);

  // Side walls, each with a dark dado, a cream rail and a skirting board.
  for (const side of [-1, 1]) {
    const face = side < 0 ? minX : maxX;
    const out = (offset: number) => face + side * offset;
    box(0.2, height + 0.4, depth + 0.4, WALL, out(0.1), midY, midZ);
    box(0.22, 3.4, depth, DADO, out(-0.01), floorY + 1.7, midZ);
    box(0.29, 0.11, depth, RAIL, out(-0.1), floorY + 3.4, midZ);
    box(0.3, 0.2, depth, SKIRT, out(-0.1), floorY + 0.12, midZ);
  }

  // High extraction grille on the right wall. Two loose cloth strips show
  // that air is moving even when the fan itself cannot be seen.
  const ventZ = midZ + 4.5;
  const ventY = ceilingY - 0.62;
  box(0.14, 0.92, 2.8, '#222d2a', maxX - 0.09, ventY, ventZ);
  box(0.17, 0.09, 2.9, '#a8a78f', maxX - 0.13, ventY + 0.48, ventZ);
  box(0.17, 0.09, 2.9, '#a8a78f', maxX - 0.13, ventY - 0.48, ventZ);
  for (let z = ventZ - 1.25; z <= ventZ + 1.26; z += 0.25)
    box(0.18, 0.78, 0.045, '#879087', maxX - 0.16, ventY, z);
  const telltales: Group[] = [];
  for (const [index, z] of [ventZ - 0.7, ventZ + 0.7].entries()) {
    const strip = new Group();
    strip.position.set(maxX - 0.25, ventY - 0.43, z);
    group.add(strip);
    mesh(
      new BoxGeometry(0.035, 0.68, 0.13),
      index ? '#dbbb82' : '#d9d5c1',
      -0.06,
      -0.34,
      0,
      strip,
    );
    telltales.push(strip);
  }

  // Front wall, built around the door opposite the cabinet.
  const doorWidth = 10.8;
  // The double entrance is 1.2 m wide and clears 2.1 m.
  const doorHeight = 2.1 * worldUnitsPerMetre;
  const doorX = midX;
  const wallZ = maxZ + 0.1;
  const leftWidth = doorX - doorWidth / 2 - minX;
  const rightWidth = maxX - (doorX + doorWidth / 2);
  box(leftWidth, height + 0.4, 0.2, WALL, minX + leftWidth / 2, midY, wallZ);
  box(rightWidth, height + 0.4, 0.2, WALL, maxX - rightWidth / 2, midY, wallZ);
  box(
    doorWidth,
    height - doorHeight,
    0.2,
    WALL,
    doorX,
    floorY + doorHeight + (height - doorHeight) / 2,
    wallZ,
  );
  for (const [x0, w] of [
    [minX, leftWidth],
    [doorX + doorWidth / 2, rightWidth],
  ]) {
    box(w, 3.4, 0.22, DADO, x0 + w / 2, floorY + 1.7, maxZ + 0.01);
    box(w, 0.11, 0.29, RAIL, x0 + w / 2, floorY + 3.4, maxZ - 0.03);
    box(w, 0.2, 0.3, SKIRT, x0 + w / 2, floorY + 0.12, maxZ - 0.04);
  }
  // A full-height equipment entrance: two steel leaves with wired-glass
  // vision panels, push plates and kick plates.
  const doorZ = maxZ + 0.02;
  box(
    0.14,
    doorHeight + 0.14,
    0.32,
    '#2c302c',
    doorX - doorWidth / 2,
    floorY + doorHeight / 2,
    doorZ - 0.04,
  );
  box(
    0.14,
    doorHeight + 0.14,
    0.32,
    '#2c302c',
    doorX + doorWidth / 2,
    floorY + doorHeight / 2,
    doorZ - 0.04,
  );
  box(
    doorWidth + 0.28,
    0.14,
    0.32,
    '#2c302c',
    doorX,
    floorY + doorHeight + 0.07,
    doorZ - 0.04,
  );
  const leafWidth = (doorWidth - 0.12) / 2;
  const glassY = floorY + doorHeight * 0.67;
  const handleY = floorY + doorHeight * 0.45;
  for (const side of [-1, 1]) {
    const leafX = doorX + side * (leafWidth / 2 + 0.03);
    box(
      leafWidth,
      doorHeight - 0.05,
      0.08,
      '#55665f',
      leafX,
      floorY + doorHeight / 2,
      doorZ,
    );
    box(2.05, 4.2, 0.02, '#1c2724', leafX, glassY, doorZ - 0.05);
    for (let i = 0; i < 5; i++) {
      box(
        2.05,
        0.012,
        0.01,
        '#8b958e',
        leafX,
        glassY - 1.68 + i * 0.84,
        doorZ - 0.065,
      );
      box(
        0.012,
        4.2,
        0.01,
        '#8b958e',
        leafX - 0.82 + i * 0.41,
        glassY,
        doorZ - 0.065,
      );
    }
    box(
      0.85,
      0.22,
      0.025,
      '#b9b6aa',
      doorX + side * 0.62,
      handleY,
      doorZ - 0.06,
    );
    box(
      leafWidth - 0.18,
      1.6,
      0.02,
      '#8a8a80',
      leafX,
      floorY + 0.85,
      doorZ - 0.05,
    );
  }
  box(
    0.12,
    doorHeight - 0.05,
    0.1,
    '#2c302c',
    doorX,
    floorY + doorHeight / 2,
    doorZ - 0.05,
  );
  const sign = createLabelTexture('VX LAB  ·  AUTHORISED PERSONNEL ONLY', {
    ink: '#151511',
    plate: '#f2c230',
    size: 11,
  });
  textures.push(sign.texture);
  const signMaterial = createPs1Material({ map: sign.texture }, true);
  materials.push(signMaterial);
  const signMesh = new Mesh(
    new PlaneGeometry(sign.width / 140, sign.height / 140),
    signMaterial,
  );
  signMesh.position.set(doorX, floorY + doorHeight + 0.45, maxZ - 0.02);
  signMesh.rotation.y = Math.PI;
  group.add(signMesh);
  // Green EXIT box above the door, facing into the room.
  box(
    1.8,
    0.55,
    0.12,
    '#1d1f1c',
    doorX,
    floorY + doorHeight + 1.6,
    maxZ - 0.06,
  );
  const exitSign = createLabelTexture('EXIT', {
    ink: '#e9ffe9',
    plate: '#1f8a3e',
    size: 12,
  });
  textures.push(exitSign.texture);
  const exitMaterial = createPs1Material({ map: exitSign.texture }, true);
  materials.push(exitMaterial);
  const exitMesh = new Mesh(new PlaneGeometry(1.6, 0.43), exitMaterial);
  exitMesh.position.set(doorX, floorY + doorHeight + 1.6, maxZ - 0.125);
  exitMesh.rotation.y = Math.PI;
  group.add(exitMesh);

  // Tall ceiling, with exposed beams running front to back.
  const roof = new Group();
  group.add(roof);
  mesh(
    new BoxGeometry(width + 0.4, 0.25, depth + 0.4),
    '#3d433f',
    midX,
    ceilingY + 0.12,
    midZ,
    roof,
  );
  for (let x = minX + 3; x < maxX - 1; x += 5)
    mesh(
      new BoxGeometry(0.35, 0.45, depth),
      '#4b514c',
      x,
      ceilingY - 0.22,
      midZ,
      roof,
    );

  // Four suspended twin-tube fittings: each T8 tube is 1.2 m long and
  // 26 mm across, at about 2.4 m above the floor.
  const fixtures: Fixture[] = [];
  const rows = [minZ + depth * 0.36, minZ + depth * 0.76];
  const columns = [minX + width * 0.28, minX + width * 0.72];
  const tubeLength = 1.2 * worldUnitsPerMetre;
  const tubeRadius = 0.013 * worldUnitsPerMetre;
  const drop = 0.25 * worldUnitsPerMetre;
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (const z of rows)
    for (const x of columns) {
      const pivot = new Group();
      pivot.position.set(x, ceilingY, z);
      group.add(pivot);
      for (const dx of [-tubeLength * 0.43, tubeLength * 0.43]) {
        mesh(
          new CylinderGeometry(0.012, 0.012, drop, 4),
          '#2a2a26',
          dx,
          -drop / 2,
          0,
          pivot,
        );
        mesh(
          new CylinderGeometry(0.06, 0.06, 0.04, 6),
          '#55554c',
          dx,
          -0.02,
          0,
          pivot,
        );
      }
      // Sheet-steel reflector with two bare tubes beneath it.
      mesh(
        new BoxGeometry(tubeLength + 0.3, 0.12, 0.9),
        '#b9bcae',
        0,
        -drop - 0.05,
        0,
        pivot,
      );
      const tubes = createPs1Material(
        { color: TUBE_ON.clone() },
        true,
      ) as Material & {
        color: Color;
      };
      materials.push(tubes);
      for (const dz of [-0.25, 0.25]) {
        const tube = new Mesh(
          new CylinderGeometry(tubeRadius, tubeRadius, tubeLength, 8),
          tubes,
        );
        tube.rotation.z = Math.PI / 2;
        tube.position.set(0, -drop - 0.14, dz);
        pivot.add(tube);
      }
      for (const dx of [-tubeLength / 2, tubeLength / 2])
        mesh(
          new BoxGeometry(0.06, 0.1, 0.3),
          '#55554c',
          dx,
          -drop - 0.13,
          0,
          pivot,
        );
      const light = new PointLight('#e8f2dc', 26, 0, 2);
      light.position.set(0, -drop - 0.35, 0);
      pivot.add(light);
      fixtures.push({
        pivot,
        tubes,
        light,
        phase: random() * Math.PI * 2,
        nextFlicker: 20 + random() * 70,
        flickerAt: -1,
        pattern: patterns[0],
      });
    }

  let last: number | undefined;
  return {
    group,
    roof,
    /** Advance the sway and the occasional flicker. */
    update(seconds: number, reducedMotion: boolean) {
      const delta = last === undefined ? 0 : Math.min(0.1, seconds - last);
      last = seconds;
      for (const [index, strip] of telltales.entries())
        strip.rotation.z = reducedMotion
          ? -0.25
          : -0.33 - Math.sin(seconds * 5.5 + index * 1.7) * 0.12;
      for (const fixture of fixtures) {
        const t = seconds * 0.35 + fixture.phase;
        fixture.pivot.rotation.z = reducedMotion ? 0 : Math.sin(t) * 0.025;
        fixture.pivot.rotation.x = reducedMotion
          ? 0
          : Math.sin(t * 0.7 + 1.3) * 0.015;

        let on = true;
        if (!reducedMotion) {
          if (fixture.flickerAt < 0) {
            fixture.nextFlicker -= delta;
            if (fixture.nextFlicker <= 0) {
              fixture.flickerAt = 0;
              fixture.pattern =
                patterns[Math.floor(random() * patterns.length)];
            }
          }
          if (fixture.flickerAt >= 0) {
            fixture.flickerAt += delta;
            let elapsed = fixture.flickerAt;
            let index = 0;
            while (
              index < fixture.pattern.length &&
              elapsed > fixture.pattern[index]
            ) {
              elapsed -= fixture.pattern[index];
              index++;
            }
            if (index >= fixture.pattern.length) {
              fixture.flickerAt = -1;
              fixture.nextFlicker = 40 + random() * 110;
            } else on = index % 2 === 1;
          }
        }
        fixture.tubes.color.copy(on ? TUBE_ON : TUBE_OFF);
        fixture.light.intensity = on ? 26 : 1.5;
      }
    },
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const item of materials) item.dispose();
      for (const item of textures) item.dispose();
    },
  };
}
