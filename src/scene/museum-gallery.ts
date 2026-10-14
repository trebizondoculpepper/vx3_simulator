import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  SpotLight,
} from 'three';
import type { Material, Object3D, Texture } from 'three';
import type { Footprint } from '../game/walk-collision';
import {
  DEV_DOOR_HEIGHT,
  DEV_DOOR_WIDTH,
  devWallPieces,
} from '../game/dev-room-links';
import { createPs1Material } from '../rendering/ps1-material';
import {
  contraptionNames,
  contraptionNotes,
  createBenchContraptions,
} from './bench-contraptions';
import { createLightSwitch } from './light-switch';
import { createCeilingServices } from './ceiling-services';
import { createCanvasTexture, createLabelTexture } from './screens';

/** A continuous room south of the corridor, in the same world and renderer. */
export function createMuseumGallery(
  m: number,
  floorY: number,
  centerX: number,
  northZ: number,
) {
  const group = new Group();
  group.name = 'VX Museum';
  group.position.set(centerX, floorY, northZ);
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const actions = new Map<Object3D, () => void>();
  const solids: Footprint[] = [];
  const museumLight = { value: 0.12 };
  const paint = (color: string) => {
    const material = createPs1Material({ color });
    material.userData.ps1Room = museumLight;
    materials.push(material);
    return material;
  };
  const box = (
    parent: Object3D,
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new Mesh(new BoxGeometry(w * m, h * m, d * m), paint(color));
    mesh.position.set(x * m, y * m, z * m);
    parent.add(mesh);
    return mesh;
  };
  const label = (
    parent: Object3D,
    value: string,
    width: number,
    x: number,
    y: number,
    z: number,
    rotationY = 0,
  ) => {
    const printed = createLabelTexture(value, {
      ink: '#252622',
      plate: '#e1d6b7',
      size: 24,
    });
    textures.push(printed.texture);
    const material = createPs1Material({ map: printed.texture }, true);
    material.userData.ps1Room = museumLight;
    materials.push(material);
    const mesh = new Mesh(
      new PlaneGeometry(
        width * m,
        (width * printed.height * m) / printed.width,
      ),
      material,
    );
    mesh.position.set(x * m, y * m, z * m);
    mesh.rotation.y = rotationY;
    parent.add(mesh);
    return mesh;
  };
  box(group, 9, 0.16, 7.5, '#4e5148', 0, -0.08, 3.75);
  box(group, 9, 0.18, 7.5, '#343b36', 0, 3.29, 3.75);
  for (const x of [-3, 0, 3])
    box(group, 0.025, 0.006, 7.5, '#30352f', x, 0.006, 3.75);
  for (let z = 0.5; z < 7.5; z += 1)
    box(group, 9, 0.006, 0.025, '#30352f', 0, 0.007, z);
  const bounds = { minX: -4.5 * m, maxX: 4.5 * m, minZ: 0, maxZ: 7.5 * m };
  const doors = [
    { to: 'corridor' as const, side: 'north' as const, x: -2.475 * m, z: 0 },
  ];
  for (const piece of devWallPieces(bounds, doors, m, 3.2 * m)) {
    const mesh = new Mesh(
      new BoxGeometry(
        piece.maxX - piece.minX,
        piece.top - piece.bottom,
        piece.maxZ - piece.minZ,
      ),
      paint('#687169'),
    );
    mesh.position.set(
      (piece.minX + piece.maxX) / 2,
      (piece.bottom + piece.top) / 2,
      (piece.minZ + piece.maxZ) / 2,
    );
    group.add(mesh);
    if (piece.bottom === 0)
      solids.push({
        minX: piece.minX + centerX,
        maxX: piece.maxX + centerX,
        minZ: piece.minZ + northZ,
        maxZ: piece.maxZ + northZ,
      });
  }
  for (const x of [-4.36, 4.36])
    box(group, 0.035, 0.85, 7.5, '#3c4940', x, 0.425, 3.75);
  box(group, 9, 0.85, 0.035, '#3c4940', 0, 0.425, 7.35);
  const outerThreshold = box(
    group,
    1.2,
    0.03,
    0.15,
    '#686557',
    -2.475,
    -0.015,
    -0.225,
  );
  outerThreshold.userData.roomId = 'corridor';
  box(group, 1.2, 0.03, 0.15, '#686557', -2.475, -0.015, -0.075);
  label(group, 'VX-MUSEUM  ·  SEKTION PHYSIK', 2.7, -0.8, 2.78, 0.19);

  const hinge = new Group();
  hinge.position.set((-2.475 - DEV_DOOR_WIDTH / 2) * m, 0, 0);
  group.add(hinge);
  const leaf = box(
    hinge,
    DEV_DOOR_WIDTH - 0.06,
    DEV_DOOR_HEIGHT - 0.04,
    0.0325,
    '#655139',
    (DEV_DOOR_WIDTH - 0.06) / 2,
    1.09,
    -0.01625,
  );
  leaf.userData.roomId = 'corridor';
  const innerLeaf = box(
    hinge,
    DEV_DOOR_WIDTH - 0.06,
    DEV_DOOR_HEIGHT - 0.04,
    0.0325,
    '#655139',
    (DEV_DOOR_WIDTH - 0.06) / 2,
    1.09,
    0.01625,
  );
  const handle = box(
    hinge,
    0.09,
    0.16,
    0.1,
    '#c5b785',
    DEV_DOOR_WIDTH - 0.19,
    1.04,
    -0.08,
  );
  const innerHandle = box(
    hinge,
    0.09,
    0.16,
    0.1,
    '#c5b785',
    DEV_DOOR_WIDTH - 0.19,
    1.04,
    0.08,
  );
  handle.userData.roomId = 'corridor';
  const outerLabel = label(
    hinge,
    'VX-MUSEUM',
    0.65,
    0.56,
    1.75,
    -0.06,
    Math.PI,
  );
  outerLabel.userData.roomId = 'corridor';
  let open = false;
  let doorAmount = 0;
  const doorParts = [leaf, innerLeaf, handle, innerHandle];
  hinge.traverse((part) => {
    part.userData.noCollision = true;
  });
  const doorFootprint: Footprint = {
    minX: centerX - 3.075 * m,
    maxX: centerX - 1.875 * m,
    minZ: northZ - 0.08 * m,
    maxZ: northZ + 0.08 * m,
  };
  const toggleDoor = () => {
    open = !open;
    return open;
  };

  const lockedDoor = (side: 'north' | 'east' | 'west') => {
    const door = new Group();
    const x = side === 'north' ? 2.65 : side === 'east' ? 4.3 : -4.3;
    const z = side === 'north' ? 0.2 : 3.85;
    door.position.set(x * m, 0, z * m);
    door.rotation.y =
      side === 'north' ? 0 : side === 'east' ? -Math.PI / 2 : Math.PI / 2;
    group.add(door);
    box(door, 1.12, 2.32, 0.08, '#27382f', 0, 1.16, 0);
    const lockedLeaf = box(door, 0.94, 2.18, 0.06, '#765c3e', 0, 1.1, 0.055);
    box(door, 0.78, 1.55, 0.025, '#54442f', 0, 1.28, 0.092);
    const lock = box(door, 0.11, 0.19, 0.07, '#c8b778', 0.35, 1.1, 0.12);
    label(door, 'VERSCHLOSSEN', 0.63, 0, 1.9, 0.106);
    actions.set(lockedLeaf, () => undefined);
    actions.set(lock, () => undefined);
  };
  lockedDoor('north');
  lockedDoor('east');
  lockedDoor('west');
  const lightSwitch = createLightSwitch(m);
  lightSwitch.group.position.set(-3.55 * m, 1.35 * m, 0.24 * m);
  group.add(lightSwitch.group);
  let lightsOn = false;
  let lightLevel = 0;
  const switchParts = lightSwitch.parts;
  const toggleLights = () => {
    lightsOn = !lightsOn;
    lightSwitch.update(lightsOn);
    return lightsOn;
  };
  lightSwitch.update(false);
  const spots: SpotLight[] = [];
  const spotBulbs: Array<ReturnType<typeof createPs1Material>> = [];
  const places: Array<{ x: number; z: number }> = [];
  for (const z of [2.2, 5.3])
    for (const x of [-3.3, -1.1, 1.1, 3.3]) places.push({ x, z });
  const threeNames = ['BANKRESONATOR', 'KUPFERSOLENOID', 'SPULENSCHRANK'];
  for (const [index, { x, z }] of places.entries()) {
    box(group, 0.83, 0.8, 0.83, '#4a4c49', x, 0.4, z);
    box(group, 0.88, 0.035, 0.88, '#8d8f83', x, 0.815, z);
    label(
      group,
      index < 3 ? threeNames[index] : 'SAMMLUNG / FOLGT',
      0.7,
      x,
      0.63,
      z - 0.424,
      Math.PI,
    );
    solids.push({
      minX: centerX + (x - 0.45) * m,
      maxX: centerX + (x + 0.45) * m,
      minZ: northZ + (z - 0.45) * m,
      maxZ: northZ + (z + 0.45) * m,
    });
    const spot = new SpotLight('#ffe6af', 0, 4.6 * m, 0.46, 0.55, 1.5);
    spot.position.set(x * m, 3.05 * m, (z - 0.25) * m);
    spot.target.position.set(x * m, 0.8 * m, z * m);
    group.add(spot, spot.target);
    spots.push(spot);
    box(group, 0.22, 0.13, 0.28, '#282b27', x, 3.06, z - 0.25);
    const bulb = createPs1Material({ color: '#302b20' }, true, true);
    materials.push(bulb);
    spotBulbs.push(bulb);
    const lens = new Mesh(
      new CylinderGeometry(0.075 * m, 0.075 * m, 0.018 * m, 8),
      bulb,
    );
    lens.position.set(x * m, 2.985 * m, (z - 0.25) * m);
    group.add(lens);
  }
  for (const z of [2.2, 5.3])
    box(group, 8.2, 0.055, 0.065, '#242a27', 0, 3.17, z);
  // The gallery has the lab's exposed services, but no fluorescent fittings.
  const services = createCeilingServices({
    axis: 'z',
    from: 0.45 * m,
    to: 7.05 * m,
    ceilingY: 3.2 * m,
    worldUnitsPerMetre: m,
    lanes: [
      { kind: 'duct', across: 0, clad: true, hang: 0.04 },
      {
        kind: 'pipe',
        across: -2.25 * m,
        color: '#607f8b',
        diameter: 0.07,
        medium: 'KÜHLWASSER',
      },
      {
        kind: 'pipe',
        across: 2.25 * m,
        color: '#9f6a32',
        diameter: 0.06,
        medium: 'RÜCKLAUF',
      },
      { kind: 'tray', across: -0.85 * m, width: 0.28, hang: 0.08 },
      { kind: 'conduit', across: 0.9 * m, diameter: 0.028, color: '#77786e' },
    ],
    trapezes: [{ across: [-2.65 * m, 2.65 * m], hang: 0.22, spacing: 2.1 }],
  });
  group.add(services.group);
  const contraptions = createBenchContraptions(
    m,
    { along: [0, 0, 0], sockets: [0, 0, 0], out: 0, socketOut: 0, socketUp: 0 },
    false,
  );
  const visits = [0, 0, 0];
  for (const [index, machine] of contraptions.machines.entries()) {
    const place = places[index];
    machine.position.set(place.x * m, 0.835 * m, place.z * m);
    machine.rotation.y = Math.PI;
    group.add(machine);
    for (const part of contraptions.parts[index])
      actions.set(part, () => {
        const on = contraptions.toggle(index);
        const notes = contraptionNotes[index];
        status = on
          ? notes[visits[index]++ % notes.length]
          : `${contraptionNames[index]} ausgeschaltet.`;
      });
  }
  let status = '';
  const portraitNames = [
    ['ERNST FANKEL', 'FORSCHUNG / DELTA'],
    ['KATHERINE YALGETH', 'VX-THEORIE'],
    ['HELMUT VAN FAHRER', 'FRÜHE APPARATE'],
    ['ERWIN HARKONEN', 'SUBFLUX'],
    ['KARL BLANKENBURG', 'KONSTANTEN'],
    ['LUKAS STRINGENGROTTEN', 'VX-THEORIE'],
  ] as const;
  const magazines = [
    ['VX-WELT', 'DIE DDR-AUSGABE', '#ba5138'],
    ['VX HEUTE', 'NEUE WEGE DER FLUXTECHNIK', '#48857b'],
    ['DEIN VX', 'BAUEN · MESSEN · STAUNEN', '#a97c36'],
  ] as const;
  const atlasPrint = (
    file: string,
    column: number,
    columns: number,
    row: number,
    rows: number,
    caption: readonly string[],
  ) => {
    const { context, texture } = createCanvasTexture(384, 480);
    context.fillStyle = '#b7a98a';
    context.fillRect(0, 0, 384, 480);
    const source = new Image();
    source.onload = () => {
      const cellWidth = source.width / columns;
      const cellHeight = source.height / rows;
      context.drawImage(
        source,
        column * cellWidth,
        row * cellHeight,
        cellWidth,
        cellHeight,
        0,
        0,
        384,
        480,
      );
      context.fillStyle = 'rgba(20, 29, 29, 0.88)';
      context.fillRect(0, 395, 384, 85);
      context.fillStyle = '#f0e5c8';
      context.textAlign = 'center';
      context.font = 'bold 23px monospace';
      context.fillText(caption[0], 192, 428, 360);
      if (caption[1]) {
        context.font = '16px monospace';
        context.fillText(caption[1], 192, 456, 360);
      }
      texture.needsUpdate = true;
    };
    source.src = `/art/museum/${file}`;
    return texture;
  };
  const portrait = (index: number) =>
    atlasPrint(
      'portraits.png',
      index % 3,
      3,
      Math.floor(index / 3),
      2,
      portraitNames[index],
    );
  const magazine = (index: number) =>
    atlasPrint('magazines.png', index, 3, 0, 1, magazines[index]);
  const archiveCard = (index: number, caption: readonly string[]) =>
    atlasPrint('ddr-history.png', index, 2, 0, 1, caption);
  const framed = (
    texture: Texture,
    x: number,
    z: number,
    rotationY: number,
    width = 0.88,
    tall = 1.1,
  ) => {
    textures.push(texture);
    const frame = new Group();
    frame.position.set(x * m, 1.87 * m, z * m);
    frame.rotation.y = rotationY;
    group.add(frame);
    box(frame, width + 0.11, tall + 0.11, 0.055, '#3d3025', 0, 0, 0);
    box(frame, width + 0.035, tall + 0.035, 0.01, '#cfbf93', 0, 0, 0.04);
    const imageMaterial = createPs1Material({ map: texture });
    imageMaterial.userData.ps1Room = museumLight;
    materials.push(imageMaterial);
    const image = new Mesh(
      new PlaneGeometry(width * m, tall * m),
      imageMaterial,
    );
    image.position.z = 0.049 * m;
    frame.add(image);
  };
  // Portraits line the west and east walls; magazine covers and DDR history
  // occupy the south wall. Frames stop short of the locked doors.
  const portraitZ = [1.05, 2.4, 6.15];
  for (let i = 0; i < 3; i++)
    framed(portrait(i), -4.29, portraitZ[i], Math.PI / 2);
  for (let i = 3; i < 6; i++)
    framed(portrait(i), 4.29, portraitZ[i - 3], -Math.PI / 2);
  framed(
    archiveCard(0, ['DDR / VX', 'LEIPZIGER INSTRUMENTE']),
    -4.29,
    5.0,
    Math.PI / 2,
  );
  framed(
    archiveCard(1, ['DDR / VX', 'WERKSTATT 1971']),
    4.29,
    5.0,
    -Math.PI / 2,
  );
  for (let i = 0; i < 3; i++)
    framed(magazine(i), -2.8 + i * 2.8, 7.29, Math.PI, 1.02, 1.3);
  label(group, 'BEITRÄGE DER DDR ZUR VX-TECHNIK', 3.4, 0, 2.85, 7.26, Math.PI);

  return {
    group,
    lighting: museumLight,
    actions,
    doorParts,
    switchParts,
    solids,
    doorFootprint,
    get doorAmount() {
      return doorAmount;
    },
    get doorBlocking() {
      return doorAmount < 0.85;
    },
    get lightLevel() {
      return lightLevel;
    },
    get status() {
      const message = status;
      status = '';
      return message;
    },
    toggleDoor,
    toggleLights,
    update(delta: number, time: number, reducedMotion: boolean) {
      doorAmount += ((open ? 1 : 0) - doorAmount) * Math.min(1, delta * 6);
      hinge.rotation.y = (-doorAmount * Math.PI) / 2;
      lightLevel +=
        ((lightsOn ? 1 : 0) - lightLevel) * Math.min(1, delta * 2.5);
      museumLight.value = 0.12 + 0.88 * lightLevel;
      for (const spot of spots) spot.intensity = 16 * lightLevel;
      for (const bulb of spotBulbs)
        bulb.color.set(lightLevel > 0.2 ? '#fff0bc' : '#302b20');
      services.update(time, false);
      contraptions.update(time, reducedMotion);
    },
    dispose() {
      lightSwitch.dispose();
      services.dispose();
      contraptions.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
