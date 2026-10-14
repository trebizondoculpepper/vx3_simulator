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
import { createCorridorBlueprints } from './corridor-blueprints';
import { createCanvasTexture, createLabelTexture } from './screens';

export interface CorridorOptions {
  floorY: number;
  worldUnitsPerMetre: number;
  /** Corridor face of the lab's front wall, which is the corridor's north wall. */
  northZ: number;
  /** The lab's outer side faces; the corridor wall between them is the lab's. */
  labMinX: number;
  labMaxX: number;
  doorX: number;
  doorWidth: number;
  doorHeight: number;
  devDoor?: { x: number; width: number; height: number };
  museumDoor?: { x: number; width: number; height: number };
  plantDoor?: { x: number; width: number; height: number };
}

const WALL = '#3c4440';
const DADO = '#23302c';
const RAIL = '#7d7660';
const SKIRT = '#1e221f';
const TUBE_ON = new Color('#d9dcc4');
const TUBE_DIM = new Color('#6b6d5e');
const TUBE_OFF = new Color('#2a2c27');

/** On/off durations in seconds; none faster than three flashes a second. */
const flicker = [0.4, 0.5, 0.35, 0.35, 0.6, 1.8, 0.35, 0.4];

/**
 * The long, dim institute corridor outside the VX lab: worn lino, dark green
 * dado, closed doors to other rooms, and single-tube fittings on long rods,
 * only a few of them lit. Its far ends are left to the fog.
 */
export function createCorridor(options: CorridorOptions) {
  const {
    floorY,
    worldUnitsPerMetre: m,
    northZ,
    labMinX,
    labMaxX,
    doorX,
    doorWidth,
    doorHeight,
  } = options;
  const group = new Group();
  group.name = 'Corridor';
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const mesh = (
    geometry: BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    parent: Group = group,
  ) => {
    const material = createPs1Material({ color });
    materials.push(material);
    const result = new Mesh(geometry, material);
    result.castShadow = true;
    result.receiveShadow = true;
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
  const sign = (
    text: string,
    x: number,
    y: number,
    z: number,
    style: { ink: string; plate: string; size: number },
    scale: number,
  ) => {
    const image = createLabelTexture(text, style);
    textures.push(image.texture);
    // Corridor signs are lit by the corridor, not by the lab's switch.
    const material = createPs1Material({ map: image.texture }, true, true);
    materials.push(material);
    const result = new Mesh(
      new PlaneGeometry(image.width / scale, image.height / scale),
      material,
    );
    result.position.set(x, y, z);
    group.add(result);
    return result;
  };

  const width = 2.4 * m;
  const height = 3 * m;
  const halfLength = 40 * m;
  const southZ = northZ + width;
  const midZ = (northZ + southZ) / 2;
  const ceilingY = floorY + height;
  const midY = floorY + height / 2;
  const length = halfLength * 2;
  const wallThickness = 0.3 * m;

  // Lino floor with a seam every metre and a scuffed walking line.
  box(length + 0.4, 0.3, width + 0.4, '#3f3d35', 0, floorY - 0.18, midZ);
  box(length, 0.006, width * 0.4, '#47453c', 0, floorY - 0.025, midZ);
  for (let x = -halfLength; x <= halfLength; x += m)
    box(0.03, 0.008, width, '#2f2e28', x, floorY - 0.02, midZ);
  // Ceiling and the two end walls.
  box(length + 0.4, 0.25, width + 0.4, '#262823', 0, ceilingY + 0.12, midZ);
  for (const end of [-1, 1])
    box(0.2, height, width, WALL, end * (halfLength + 0.1), midY, midZ);

  // Walls: the far (south) wall runs the whole length; the near (north)
  // wall belongs to the lab between its side walls, so it is only clad there.
  const run = (x0: number, x1: number, z: number, face: number) => {
    const w = x1 - x0;
    const x = (x0 + x1) / 2;
    box(w, 0.9 * m, 0.04, DADO, x, floorY + 0.45 * m, z + face * 0.02);
    box(w, 0.06, 0.08, RAIL, x, floorY + 0.9 * m, z + face * 0.04);
    box(w, 0.15, 0.1, SKIRT, x, floorY + 0.075, z + face * 0.05);
  };
  const southOpenings = [options.museumDoor, options.devDoor]
    .filter((door): door is { x: number; width: number; height: number } =>
      Boolean(door),
    )
    .sort((a, b) => a.x - b.x);
  const southRanges: number[][] = [];
  let southCursor = -halfLength;
  for (const door of southOpenings) {
    southRanges.push([southCursor, door.x - door.width / 2]);
    southCursor = door.x + door.width / 2;
  }
  southRanges.push([southCursor, halfLength]);
  for (const [a, b] of southRanges) {
    box(
      b - a,
      height,
      wallThickness,
      WALL,
      (a + b) / 2,
      midY,
      southZ + wallThickness / 2,
    );
    run(a, b, southZ, -1);
  }
  for (const door of southOpenings)
    box(
      door.width,
      height - door.height,
      wallThickness,
      WALL,
      door.x,
      floorY + (height + door.height) / 2,
      southZ + wallThickness / 2,
    );
  // The north wall stops short of its back face, so where a room such as
  // the plant room lies behind it the two walls do not share a surface.
  const backedWall = wallThickness - 0.04;

  for (const [x0, x1] of [
    [-halfLength, labMinX],
    [labMaxX, halfLength],
  ]) {
    const opening = options.plantDoor;
    const ranges =
      opening && opening.x > x0 && opening.x < x1
        ? [
            [x0, opening.x - opening.width / 2],
            [opening.x + opening.width / 2, x1],
          ]
        : [[x0, x1]];
    for (const [a, b] of ranges) {
      box(
        b - a,
        height,
        backedWall,
        WALL,
        (a + b) / 2,
        midY,
        northZ - backedWall / 2,
      );
      run(a, b, northZ, 1);
    }
    if (ranges.length === 2 && opening)
      box(
        opening.width,
        height - opening.height,
        backedWall,
        WALL,
        opening.x,
        floorY + (height + opening.height) / 2,
        northZ - backedWall / 2,
      );
  }
  const doorLeft = doorX - doorWidth / 2 - 0.07;
  const doorRight = doorX + doorWidth / 2 + 0.07;
  box(
    doorLeft - labMinX,
    height,
    0.02,
    WALL,
    (labMinX + doorLeft) / 2,
    midY,
    northZ + 0.01,
  );
  box(
    labMaxX - doorRight,
    height,
    0.02,
    WALL,
    (doorRight + labMaxX) / 2,
    midY,
    northZ + 0.01,
  );
  box(
    doorRight - doorLeft,
    height - doorHeight - 0.14,
    0.02,
    WALL,
    doorX,
    floorY + doorHeight + 0.14 + (height - doorHeight - 0.14) / 2,
    northZ + 0.01,
  );
  run(labMinX, doorLeft, northZ, 1);
  run(doorRight, labMaxX, northZ, 1);

  // Two floors down, the ceiling is where the building keeps its plumbing.
  const services = createCeilingServices({
    axis: 'x',
    from: -halfLength,
    to: halfLength,
    ceilingY,
    worldUnitsPerMetre: m,
    glowingSigns: true,
    trapezes: [
      { across: [northZ + 0.05 * m, northZ + 0.86 * m], hang: 0.362 },
      {
        across: [northZ + 1.24 * m, northZ + 1.56 * m],
        hang: 0.2,
        spacing: 2,
      },
    ],
    lanes: [
      {
        kind: 'duct',
        across: southZ - 0.45 * m,
        clad: true,
        branches: [12, 22, 33, 47, 58, 68].map((at) => ({ at, drop: 0.1 })),
      },
      {
        kind: 'pipe',
        across: northZ + 0.2 * m,
        color: '#9c2b20',
        diameter: 0.05,
        medium: 'HEIZUNG · VORLAUF',
      },
      {
        kind: 'pipe',
        across: northZ + 0.4 * m,
        color: '#3f5f7a',
        diameter: 0.1,
        hang: 0.08,
        medium: 'DRUCKLUFT · 6 BAR',
        flow: -1,
        // The lab's air feed, through the wall just west of its door, and two
        // drops that slip down between the basket and the tray.
        branches: [
          { at: 38, side: -1, reach: 0.4, drop: 0.45, end: 'wall' },
          { at: 15, side: 1, reach: 0.9, drop: 0.5 },
          { at: 70, side: 1, reach: 0.9, drop: 0.5 },
        ],
      },
      {
        kind: 'pipe',
        across: northZ + 0.6 * m,
        color: '#4c6b45',
        diameter: 0.08,
        medium: 'KÜHLWASSER · RÜCKLAUF',
        flow: -1,
      },
      // Cable runs alongside the pipes, sharing their trapezes: a basket of
      // data cable under the heating and air mains, a perforated tray of
      // mixed cable beside it, and a ladder of black power cable further out.
      {
        kind: 'basket',
        across: northZ + 0.22 * m,
        width: 0.28,
        hang: 0.31,
        onTrapeze: true,
      },
      {
        kind: 'tray',
        across: northZ + 0.62 * m,
        hang: 0.28,
        onTrapeze: true,
      },
      {
        kind: 'ladder',
        across: northZ + 1.4 * m,
        width: 0.28,
        hang: 0.12,
        onTrapeze: true,
      },
      { kind: 'trunking', across: northZ + 1.62 * m, hang: 0.02 },
      { kind: 'conduit', across: northZ + 0.9 * m },
      { kind: 'conduit', across: northZ + 0.95 * m, color: '#7a6a3a' },
      { kind: 'conduit', across: southZ - 0.1 * m, hang: 0.4 },
      // Heads sit halfway between the light fittings.
      {
        kind: 'sprinkler',
        across: northZ + 1.03 * m,
        hang: 0.02,
        medium: 'SPRINKLER · NASSANLAGE',
        spacing: 2.5,
        offset: 1.25,
        drop: 0.6,
      },
      {
        kind: 'detector',
        across: northZ + 1.115 * m,
        detector: 'smoke',
        spacing: 7.5,
        offset: 3.75,
      },
    ],
  });
  group.add(services.group);

  const blueprints = createCorridorBlueprints({
    doorX,
    southZ,
    floorY,
    worldUnitsPerMetre: m,
  });
  group.add(blueprints.group);

  // The lab's name over its door.
  sign(
    'UNIVERSITÄT LEIPZIG  ·  HELMHOLTZ-BAU',
    doorX,
    floorY + doorHeight + 1.7,
    northZ + 0.03,
    { ink: '#e8e2cc', plate: '#20302b', size: 13 },
    32,
  );
  // The room's door plate beside the door, as the original read: an
  // enamelled plate on a brass-framed backing at eye level.
  {
    const plate = createDoorPlateTexture();
    textures.push(plate.texture);
    const width = 0.42 * m;
    const height = width * (plate.height / plate.width);
    const x = doorX + doorWidth / 2 + 0.45 * m;
    const y = floorY + 1.55 * m;
    box(width + 0.25, height + 0.25, 0.04, '#7a6432', x, y, northZ + 0.02);
    const material = createPs1Material({ map: plate.texture }, true, true);
    materials.push(material);
    const face = new Mesh(new PlaneGeometry(width, height), material);
    face.position.set(x, y, northZ + 0.045);
    group.add(face);
    for (const dx of [-1, 1])
      for (const dy of [-1, 1])
        box(
          0.05,
          0.05,
          0.03,
          '#c9b77a',
          x + dx * (width / 2 + 0.05),
          y + dy * (height / 2 + 0.05),
          northZ + 0.05,
        );
  }

  // Level markers stencilled on the far wall, facing the lab door and
  // repeated down the corridor.
  for (let x = doorX; x < halfLength; x += 20 * m)
    for (const at of x === doorX ? [x] : [x, doorX * 2 - x]) {
      const marker = sign(
        'EBENE  −2',
        at,
        floorY + 1.55 * m,
        southZ - 0.03,
        { ink: '#d8cf9e', plate: '#2c3532', size: 14 },
        70,
      );
      marker.rotation.y = Math.PI;
    }

  // Closed doors to other rooms, staggered down both walls.
  const otherDoorWidth = 0.9 * m;
  for (let x = -halfLength + 5 * m; x < halfLength - 2 * m; x += 7 * m) {
    for (const [face, offset] of [
      [1, 0],
      [-1, 3.5 * m],
    ]) {
      const dx = x + offset;
      if (
        face < 0 &&
        southOpenings.some(
          (door) => Math.abs(dx - door.x) < door.width / 2 + otherDoorWidth,
        )
      )
        continue;
      // Remove the nearest decorative doorway to the left of the real plant room.
      if (
        face > 0 &&
        options.plantDoor &&
        dx < options.plantDoor.x &&
        dx > options.plantDoor.x - 7 * m
      )
        continue;
      if (
        face > 0 &&
        options.plantDoor &&
        Math.abs(dx - options.plantDoor.x) <
          options.plantDoor.width / 2 + otherDoorWidth
      )
        continue;
      if (dx < labMaxX + 1.5 * m && dx > labMinX - 1.5 * m) continue;
      if (dx > halfLength - otherDoorWidth) continue;
      const z = face > 0 ? northZ : southZ;
      box(
        otherDoorWidth + 0.3,
        doorHeight + 0.15,
        0.1,
        SKIRT,
        dx,
        floorY + (doorHeight + 0.15) / 2,
        z + face * 0.05,
      );
      box(
        otherDoorWidth,
        doorHeight,
        0.12,
        '#3a2f22',
        dx,
        floorY + doorHeight / 2,
        z + face * 0.08,
      );
      box(
        0.3,
        0.08,
        0.16,
        '#8f8a78',
        dx + face * otherDoorWidth * 0.36,
        floorY + 1.05 * m,
        z + face * 0.14,
      );
    }
  }

  // Single-tube fittings every five metres. Only the ones nearest the lab
  // are wired to lamps that light anything; the rest glow faintly, one has
  // failed altogether, and one is on its way out.
  const tubeLength = 1.5 * m;
  const drop = 0.45 * m;
  interface Fitting {
    pivot: Group;
    tube: Material & { color: Color };
    light?: PointLight;
    phase: number;
    failing: boolean;
  }
  const fittings: Fitting[] = [];
  let index = 0;
  for (let x = -halfLength + 2.5 * m; x < halfLength; x += 5 * m, index++) {
    const pivot = new Group();
    pivot.position.set(x, ceilingY, midZ);
    group.add(pivot);
    for (const dx of [-tubeLength * 0.4, tubeLength * 0.4])
      mesh(
        new CylinderGeometry(0.012, 0.012, drop, 4),
        '#1d1d1a',
        dx,
        -drop / 2,
        0,
        pivot,
      );
    mesh(
      new BoxGeometry(tubeLength + 0.2, 0.1, 0.45),
      '#8c8e83',
      0,
      -drop - 0.04,
      0,
      pivot,
    );
    const near = Math.abs(x) < 8 * m;
    const dead = index === 3;
    const failing = index === 10;
    const tube = createPs1Material(
      { color: (dead ? TUBE_OFF : near ? TUBE_ON : TUBE_DIM).clone() },
      true,
      true,
    ) as Material & { color: Color };
    materials.push(tube);
    const tubeMesh = new Mesh(
      new CylinderGeometry(0.013 * m, 0.013 * m, tubeLength, 6),
      tube,
    );
    tubeMesh.rotation.z = Math.PI / 2;
    tubeMesh.position.set(0, -drop - 0.13, 0);
    pivot.add(tubeMesh);
    let light: PointLight | undefined;
    if (near) {
      light = new PointLight('#d8dcbe', 9, 0, 2);
      light.position.set(0, -drop - 0.4, 0);
      pivot.add(light);
    }
    fittings.push({ pivot, tube, light, phase: index * 1.37, failing });
  }

  return {
    group,
    /** Where a visitor stands to face the lab door: on the corridor's centre line. */
    spawn: { x: doorX, z: southZ - 0.45 * m },
    update(seconds: number, reducedMotion: boolean) {
      services.update(seconds);
      for (const fitting of fittings) {
        const t = seconds * 0.3 + fitting.phase;
        fitting.pivot.rotation.z = reducedMotion ? 0 : Math.sin(t) * 0.02;
        fitting.pivot.rotation.x = reducedMotion
          ? 0
          : Math.sin(t * 0.8 + 0.9) * 0.012;
        if (!fitting.failing) continue;
        // The failing tube runs its stutter once every twenty seconds.
        let on = true;
        if (!reducedMotion) {
          let elapsed = seconds % 20;
          let step = 0;
          while (step < flicker.length && elapsed > flicker[step]) {
            elapsed -= flicker[step];
            step++;
          }
          on = step >= flicker.length || step % 2 === 1;
        }
        fitting.tube.color.copy(on ? TUBE_DIM : TUBE_OFF);
      }
    },
    dispose() {
      services.dispose();
      blueprints.dispose();
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const item of materials) item.dispose();
      for (const item of textures) item.dispose();
    },
  };
}

/**
 * The door plate of room −02 17 as it read under the GDR: cream enamel,
 * black lettering, the room number large, and the access warning in red.
 */
function createDoorPlateTexture() {
  const width = 384;
  const height = 240;
  const { context, texture } = createCanvasTexture(width, height);
  context.fillStyle = '#ece6d2';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = '#1b1a16';
  context.lineWidth = 4;
  context.strokeRect(10, 10, width - 20, height - 20);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const line = (text: string, y: number, font: string, ink = '#1b1a16') => {
    context.fillStyle = ink;
    context.font = font;
    context.fillText(text, width / 2, y, width - 44);
  };
  const rule = (y: number) => {
    context.fillStyle = '#1b1a16';
    context.fillRect(40, y, width - 80, 3);
  };
  line('KARL-MARX-UNIVERSITÄT LEIPZIG', 38, 'bold 19px sans-serif');
  line('Sektion Physik', 66, 'bold 18px sans-serif');
  rule(84);
  line('VERSUCHSLABOR -02 17', 118, 'bold 32px sans-serif');
  line('Experimentelle Vektor- und Feldtechnik', 156, 'bold 18px sans-serif');
  rule(176);
  line(
    'Zutritt nur für befugtes Personal',
    204,
    'bold 17px sans-serif',
    '#a3221a',
  );
  texture.needsUpdate = true;
  return { texture, width, height };
}
