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
import { createCeilingServices } from './ceiling-services';
import { createLightSwitch } from './light-switch';
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
    result.castShadow = !unlit;
    result.receiveShadow = !unlit;
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
  const wallThickness = 0.3 * worldUnitsPerMetre;

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
    box(
      wallThickness,
      height + 0.4,
      depth + wallThickness * 2,
      WALL,
      out(wallThickness / 2),
      midY,
      midZ,
    );
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
  const wallZ = maxZ + wallThickness / 2;
  const leftWidth = doorX - doorWidth / 2 - minX;
  const rightWidth = maxX - (doorX + doorWidth / 2);
  box(
    leftWidth,
    height + 0.4,
    wallThickness,
    WALL,
    minX + leftWidth / 2,
    midY,
    wallZ,
  );
  box(
    rightWidth,
    height + 0.4,
    wallThickness,
    WALL,
    maxX - rightWidth / 2,
    midY,
    wallZ,
  );
  box(
    doorWidth,
    height - doorHeight,
    wallThickness,
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
  // Swing from the inner wall face; a hinge buried at the corridor face made
  // the open leaves cut through the masonry around the opening.
  const doorZ = maxZ + 0.02 * worldUnitsPerMetre;
  box(
    doorWidth,
    0.025 * worldUnitsPerMetre,
    wallThickness,
    '#777768',
    doorX,
    floorY - 0.015 * worldUnitsPerMetre,
    wallZ,
  );
  for (const x of [doorX - doorWidth / 2, doorX + doorWidth / 2])
    box(
      0.06 * worldUnitsPerMetre,
      doorHeight,
      wallThickness,
      '#a39b83',
      x,
      floorY + doorHeight / 2,
      wallZ,
    );
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
  // Each leaf hangs on its outer jamb and swings into the room. The centre
  // astragal rides on the right leaf so the opening is clear when both swing.
  const leafWidth = (doorWidth - 0.12) / 2;
  const glassY = floorY + doorHeight * 0.67;
  const handleY = floorY + doorHeight * 0.45;
  const leaves: Group[] = [];
  const doorParts: Mesh[] = [];
  for (const side of [-1, 1]) {
    const hingeX = doorX + side * (leafWidth + 0.03);
    const leaf = new Group();
    leaf.position.set(hingeX, 0, doorZ);
    leaf.userData.side = side;
    group.add(leaf);
    leaves.push(leaf);
    let faceOwner: 'lab' | 'corridor' | undefined;
    const part = (
      w: number,
      h: number,
      d: number,
      color: string,
      x: number,
      y: number,
      z: number,
    ) => {
      const result = mesh(
        new BoxGeometry(w, h, d),
        color,
        x - hingeX,
        y,
        z - doorZ,
        leaf,
      );
      if (faceOwner) result.userData.roomId = faceOwner;
      doorParts.push(result);
      return result;
    };
    const leafX = doorX + side * (leafWidth / 2 + 0.03);
    for (const face of [-1, 1]) {
      faceOwner = face < 0 ? 'lab' : 'corridor';
      // Each half of the leaf is owned by the room it faces.
      part(
        leafWidth,
        doorHeight - 0.05,
        0.04,
        '#55665f',
        leafX,
        floorY + doorHeight / 2,
        doorZ + face * 0.02,
      );
      const glassZ = doorZ + face * 0.05;
      part(2.05, 4.2, 0.02, '#1c2724', leafX, glassY, glassZ);
      for (let i = 0; i < 5; i++) {
        part(
          2.05,
          0.012,
          0.01,
          '#8b958e',
          leafX,
          glassY - 1.68 + i * 0.84,
          glassZ + face * 0.015,
        );
        part(
          0.012,
          4.2,
          0.01,
          '#8b958e',
          leafX - 0.82 + i * 0.41,
          glassY,
          glassZ + face * 0.015,
        );
      }
      // Push plate on the lab side, a pull handle on the corridor side.
      if (face < 0)
        part(
          0.85,
          0.22,
          0.025,
          '#b9b6aa',
          doorX + side * 0.62,
          handleY,
          doorZ - 0.06,
        );
      else {
        part(
          0.08,
          1.3,
          0.08,
          '#c9c6ba',
          doorX + side * 0.5,
          handleY,
          doorZ + 0.17,
        );
        for (const dy of [-0.55, 0.55])
          part(
            0.06,
            0.06,
            0.14,
            '#c9c6ba',
            doorX + side * 0.5,
            handleY + dy,
            doorZ + 0.1,
          );
      }
      part(
        leafWidth - 0.18,
        1.6,
        0.02,
        '#8a8a80',
        leafX,
        floorY + 0.85,
        doorZ + face * 0.05,
      );
    }
    faceOwner = undefined;
    if (side > 0)
      part(
        0.12,
        doorHeight - 0.05,
        0.1,
        '#2c302c',
        doorX,
        floorY + doorHeight / 2,
        doorZ,
      );
  }
  // A painted steel lining round the opening covers the wall's reveal.
  const lining: Mesh[] = [];
  for (const side of [-1, 1])
    lining.push(
      box(
        0.04,
        doorHeight,
        wallThickness + 0.02,
        '#3d4a45',
        doorX + side * (doorWidth / 2 - 0.02),
        floorY + doorHeight / 2,
        wallZ,
      ),
    );
  lining.push(
    box(
      doorWidth,
      0.04,
      wallThickness + 0.02,
      '#3d4a45',
      doorX,
      floorY + doorHeight - 0.02,
      wallZ,
    ),
  );
  // On the corridor face the lining turns out as a frame over the 7 cm
  // margin the corridor's cladding leaves round the opening.
  const frameZ = maxZ + wallThickness + 0.01;
  for (const side of [-1, 1])
    lining.push(
      box(
        0.07,
        doorHeight + 0.14,
        0.02,
        '#3d4a45',
        doorX + side * (doorWidth / 2 + 0.035),
        floorY + (doorHeight + 0.14) / 2,
        frameZ,
      ),
    );
  lining.push(
    box(
      doorWidth,
      0.14,
      0.02,
      '#3d4a45',
      doorX,
      floorY + doorHeight + 0.07,
      frameZ,
    ),
  );
  for (const outerFrame of lining.slice(-3))
    outerFrame.userData.roomId = 'corridor';
  // The closed door is solid; the walker's collision asks for this.
  const doorFootprint = {
    minX: doorX - doorWidth / 2,
    maxX: doorX + doorWidth / 2,
    minZ: doorZ - 0.1,
    maxZ: doorZ + 0.1,
  };
  let doorOpen = false;
  let doorAmount = 0;
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
  // The EXIT box is on the emergency supply, so it stays lit in the dark.
  const exitMaterial = createPs1Material({ map: exitSign.texture }, true, true);
  materials.push(exitMaterial);
  const exitMesh = new Mesh(new PlaneGeometry(1.6, 0.43), exitMaterial);
  exitMesh.position.set(doorX, floorY + doorHeight + 1.6, maxZ - 0.125);
  exitMesh.rotation.y = Math.PI;
  group.add(exitMesh);

  // The light switch, a chunky rocker on a Bakelite plate, sits on the lab
  // side of the wall just west of the door frame.
  const switchX = doorX - doorWidth / 2 - 0.35 * worldUnitsPerMetre;
  const switchY = floorY + 1.25 * worldUnitsPerMetre;
  const lightSwitch = createLightSwitch(worldUnitsPerMetre);
  lightSwitch.group.position.set(switchX, switchY, maxZ - 0.06);
  lightSwitch.group.rotation.y = Math.PI;
  group.add(lightSwitch.group);
  const switchParts = lightSwitch.parts;

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

  // Basement services cross the ceiling front to back. The deep runs keep to
  // the gaps between the light fittings; the shallow ones pass above them.
  const m = worldUnitsPerMetre;
  const services = createCeilingServices({
    axis: 'z',
    from: minZ,
    to: maxZ,
    ceilingY,
    worldUnitsPerMetre: m,
    trapezes: [
      {
        across: [midX + 0.7 * m, midX + 1.13 * m],
        hang: 0.18,
        spacing: 1.2,
      },
    ],
    lanes: [
      {
        kind: 'duct',
        across: minX + 0.3 * m,
        branches: [{ at: 2.3, drop: 0.08 }],
      },
      {
        kind: 'clad-duct',
        across: midX,
        diameter: 0.45,
        branches: [
          { at: 2.8, drop: 0.08 },
          { at: 4.5, drop: 0.08 },
        ],
      },
      { kind: 'tray', across: maxX - 0.3 * m, hang: 0.15 },
      // A ladder of black power cable alongside the heating pipe, on its
      // own trapezes, clear of the light fittings' rods.
      {
        kind: 'ladder',
        across: midX + 0.92 * m,
        width: 0.33,
        hang: 0.1,
        onTrapeze: true,
      },
      {
        kind: 'pipe',
        across: midX - 1.0 * m,
        color: '#3f5f7a',
        diameter: 0.1,
        medium: 'DRUCKLUFT · 6 BAR',
        // A compressed-air drop over the workbench.
        branches: [{ at: 2.6, side: -1, reach: 0.75, drop: 0.42 }],
      },
      {
        kind: 'pipe',
        across: midX - 1.25 * m,
        color: '#4c6b45',
        diameter: 0.08,
        medium: 'KÜHLWASSER · VORLAUF',
        branches: [{ at: 4.0, side: -1, reach: 0.5, drop: 0.55 }],
      },
      {
        kind: 'pipe',
        across: midX + 0.6 * m,
        color: '#9c2b20',
        diameter: 0.05,
        medium: 'HEIZUNG · RÜCKLAUF',
        flow: -1,
      },
      {
        kind: 'pipe',
        across: midX + 1.4 * m,
        color: '#8a7a52',
        diameter: 0.06,
        medium: 'XENON · 4 BAR',
        // Toward the rack.
        flow: -1,
      },
      { kind: 'trunking', across: midX - 0.6 * m, hang: 0.02 },
      {
        kind: 'trunking',
        across: maxX - 0.75 * m,
        hang: 0.02,
        color: '#8e9a8a',
      },
      { kind: 'conduit', across: midX + 0.95 * m },
      { kind: 'conduit', across: midX + 1.0 * m, color: '#7a6a3a' },
      { kind: 'conduit', across: minX + 0.8 * m, hang: 0.03 },
      // Two wet sprinkler ranges, their heads clear of the light fittings.
      ...[midX - 0.38 * m, midX + 1.2 * m].map((across) => ({
        kind: 'sprinkler' as const,
        across,
        hang: 0.02,
        medium: 'SPRINKLER · NASS',
        spacing: 2,
        offset: 0.8,
        drop: 0.48,
      })),
      {
        kind: 'detector',
        across: midX - 1.6 * m,
        detector: 'heat',
        spacing: 2,
        offset: 1,
      },
      {
        kind: 'detector',
        across: midX + 0.4 * m,
        detector: 'smoke',
        spacing: 2,
        offset: 1,
      },
    ],
  });
  roof.add(services.group);

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
        { color: TUBE_OFF.clone() },
        true,
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
      const light = new PointLight('#e8f2dc', 0, 0, 2);
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

  // The tubes are switched together. Switching on, each one strikes on its
  // own: a few starter blinks, none faster than two a second, then steady.
  // Each fitting's lamp and the room's fill ease between states, so the
  // tubes blink crisply but the room as a whole brightens in stutters
  // rather than flashing.
  let lightsOn = false;
  let level = 0;
  const strike = () => {
    const pattern = [0.1 + random() * 0.7];
    const blinks = 2 + Math.floor(random() * 3);
    for (let i = 0; i < blinks; i++)
      pattern.push(0.22 + random() * 0.18, 0.3 + random() * 0.35);
    return pattern;
  };

  let last: number | undefined;
  let fireAlarm = false;
  return {
    group,
    roof,
    sprinklerHeads: services.sprinklerHeads,
    setFireAlarm(active: boolean) {
      fireAlarm = active;
    },
    door: {
      /** Every mesh of both leaves, for clicking. */
      parts: doorParts as readonly Mesh[],
      footprint: doorFootprint,
      width: doorWidth,
      height: doorHeight,
      /** World position of the doorway centre at handle height. */
      handle: { x: doorX, y: handleY, z: doorZ },
      get open() {
        return doorOpen;
      },
      /** True while the leaves still block the opening. */
      get blocking() {
        return doorAmount < 0.75;
      },
      /** How far the leaves are open, 0 (shut) to 1. */
      get amount() {
        return doorAmount;
      },
      toggle() {
        doorOpen = !doorOpen;
        return doorOpen;
      },
    },
    lights: {
      /** Every mesh of the switch, for clicking. */
      switchParts: switchParts as readonly Mesh[],
      get on() {
        return lightsOn;
      },
      /** The share of the lab's lighting currently lit, smoothed: 0 to 1. */
      get level() {
        return level;
      },
      toggle() {
        lightsOn = !lightsOn;
        for (const fixture of fixtures) {
          fixture.flickerAt = lightsOn ? 0 : -1;
          fixture.pattern = lightsOn ? strike() : patterns[0];
          fixture.nextFlicker = 40 + random() * 110;
        }
        return lightsOn;
      },
    },
    /** Advance the sway and the occasional flicker. */
    update(seconds: number, reducedMotion: boolean) {
      const delta = last === undefined ? 0 : Math.min(0.1, seconds - last);
      last = seconds;
      services.update(seconds, fireAlarm);
      // The leaves swing on their hinges, easing to rest against the stops.
      const target = doorOpen ? 1 : 0;
      doorAmount +=
        Math.sign(target - doorAmount) *
        Math.min(
          Math.abs(target - doorAmount),
          delta * (reducedMotion ? 8 : 1.4),
        );
      const eased = doorAmount * doorAmount * (3 - 2 * doorAmount);
      for (const leaf of leaves)
        leaf.rotation.y = -(leaf.userData.side as number) * eased * 1.45;
      for (const [index, strip] of telltales.entries())
        strip.rotation.z = reducedMotion
          ? -0.25
          : -0.33 - Math.sin(seconds * 5.5 + index * 1.7) * 0.12;
      let lit = 0;
      for (const fixture of fixtures) {
        const t = seconds * 0.35 + fixture.phase;
        fixture.pivot.rotation.z = reducedMotion ? 0 : Math.sin(t) * 0.025;
        fixture.pivot.rotation.x = reducedMotion
          ? 0
          : Math.sin(t * 0.7 + 1.3) * 0.015;

        let on = lightsOn;
        if (lightsOn && !reducedMotion) {
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
        const glow = on ? 26 : lightsOn ? 1.5 : 0;
        fixture.light.intensity +=
          (glow - fixture.light.intensity) *
          Math.min(1, delta * (reducedMotion ? 60 : 10));
        lit += on ? 1 : 0;
      }
      // The room's fill light follows the tubes, eased a little so a
      // flicker reads as a stutter rather than a flash.
      const share = lit / fixtures.length;
      level +=
        (share - level) * Math.min(1, delta * (reducedMotion ? 60 : 2.5));
      lightSwitch.update(lightsOn);
    },
    dispose() {
      lightSwitch.dispose();
      services.dispose();
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const item of materials) item.dispose();
      for (const item of textures) item.dispose();
    },
  };
}
