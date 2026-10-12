import {
  AmbientLight,
  Box3,
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  Mesh,
  NearestFilter,
  OctahedronGeometry,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Material, Object3D, Texture } from 'three';
import { createSoundEngine } from '../audio/sound-engine';
import { assembleRack } from '../game/rack-catalogue';
import {
  applyRack,
  createRackControls,
  knobLine,
  toggleLine,
} from '../game/rack-controls';
import { createRig, deltaScore, stepRig } from '../game/rig';
import {
  createSafetyTelltales,
  stepSafetyTelltales,
} from '../game/safety-telltales';
import {
  createCanvasTexture,
  createDialTexture,
  createLabelTexture,
  createNixieScreen,
  createScopeScreen,
} from '../scene/screens';
import { createWorldMapTexture } from '../scene/world-map';
import { createPedestalAshtray } from '../scene/pedestal-ashtray';
import { createXenonCylinders } from '../scene/xenon-cylinders';
import { createHotlinePhone } from '../scene/hotline-phone';
import { createLabRoom } from '../scene/lab-room';
import { createCorridor } from '../scene/corridor';
import { createToolRack } from '../scene/tool-rack';
import { createWestWorkbench } from '../scene/west-workbench';
import { createTouchSticks } from '../ui/touch-sticks';
import { slide } from '../game/walk-collision';
import type { Footprint } from '../game/walk-collision';
import { createTeleprinter } from '../scene/teleprinter';
import { createPanelHeader, createPanelLivery } from '../scene/panel-livery';
import { createPs1Material, ps1Uniforms } from './ps1-material';

const panelWidth = 4.35;
const worldUnitsPerMetre = panelWidth / 0.4826;
// A panel is 19 inches across; one rack unit is 1.75 inches high.
const U = (panelWidth * 1.75) / 19;
// Ten named instruments and one open 4U inspection bay fill a 42U cabinet.
const inspectionBayUnits = 4;
// The handles occupy the outer edges of a panel. Instruments stay between them.
const instrumentSafeRight = 1.72;

export function startScene(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  const perspectiveCamera = new PerspectiveCamera(52, 1, 0.1, 150);
  const isometricCamera = new OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
  let view: 'perspective' | 'isometric' = 'perspective';
  const camera = () =>
    view === 'perspective' ? perspectiveCamera : isometricCamera;
  const scene = new Scene();
  const roomTone = new Color('#181714');
  scene.background = roomTone;
  // Two floors underground the corridor fades into darkness either way.
  const basementFog = new Fog('#0d0c0a', 55, 148);
  scene.add(new AmbientLight('#fff0d7', 1.5));
  const lamp = new DirectionalLight('#ffe4ad', 2.1);
  lamp.position.set(-3, 5, 7);
  scene.add(lamp);
  const rim = new DirectionalLight('#829a98', 0.7);
  rim.position.set(3, -1, 2);
  scene.add(rim);

  const materials: Material[] = [];
  const textures: Texture[] = [];
  const interactive: Object3D[] = [];
  const actions = new Map<number, () => void>();
  const dynamic: Array<() => void> = [];
  const rig = createRig();
  const telltales = createSafetyTelltales();
  const settings = createRackControls();
  const audio = createSoundEngine();
  const modules = assembleRack();
  const rackUnits =
    modules.reduce((sum, module) => sum + module.units, 0) + inspectionBayUnits;
  const totalHeight = rackUnits * U + (modules.length + 1) * 0.045 + 0.35;
  const rack = new Group();
  rack.position.z = 3.8;
  scene.add(rack);
  const material = (color: string, unlit = false) => {
    const result = createPs1Material({ color }, unlit);
    materials.push(result);
    return result;
  };
  const cube = (
    parent: Group,
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new Mesh(new BoxGeometry(w, h, d), material(color));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const disc = (
    parent: Group,
    radius: number,
    color: string,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new Mesh(new CircleGeometry(radius, 12), material(color));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const label = (
    parent: Group,
    value: string,
    x: number,
    y: number,
    z: number,
    size = 11,
    ink = '#e3dcc4',
    plate = '#272a26',
  ) => {
    const image = createLabelTexture(value, { size, ink, plate });
    textures.push(image.texture);
    const mesh = new Mesh(
      new PlaneGeometry(image.width / 85, image.height / 85),
      createPs1Material({ map: image.texture }, true),
    );
    materials.push(mesh.material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
  };
  const bind = (object: Object3D, action: () => void) => {
    interactive.push(object);
    actions.set(object.id, action);
  };

  // The cabinet belongs to a room: painted masonry, benches and old test gear.
  const lab = new Group();
  scene.add(lab);
  const floorY = -totalHeight / 2 - 0.23;
  // The 19-inch panel sets the room scale: 4.5 m wide, 5 m deep, 2.7 m high.
  const room = {
    minX: -2.25 * worldUnitsPerMetre,
    maxX: 2.25 * worldUnitsPerMetre,
    minZ: -3.81,
    maxZ: -3.81 + 5 * worldUnitsPerMetre,
    floorY,
    ceilingY: floorY + 2.7 * worldUnitsPerMetre,
    worldUnitsPerMetre,
  };
  const backWallHeight = room.ceilingY - floorY;
  cube(
    lab,
    room.maxX - room.minX,
    backWallHeight,
    0.18,
    '#626f68',
    0,
    floorY + backWallHeight / 2,
    -3.9,
  );
  cube(lab, room.maxX - room.minX, 3.4, 0.2, '#3d5750', 0, floorY + 1.7, -3.79);
  cube(
    lab,
    room.maxX - room.minX,
    0.11,
    0.29,
    '#d0c3a0',
    0,
    floorY + 3.4,
    -3.66,
  );
  cube(
    lab,
    room.maxX - room.minX,
    0.2,
    0.32,
    '#373d38',
    0,
    floorY + 0.12,
    -3.65,
  );
  const labRoom = createLabRoom(room);
  lab.add(labRoom.group);
  dynamic.push(() =>
    labRoom.update(performance.now() / 1000, reducedMotion.matches),
  );
  // Outside the door: the long basement corridor of the Helmholtz-Bau.
  const corridor = createCorridor({
    floorY,
    worldUnitsPerMetre,
    northZ: room.maxZ + 0.2,
    labMinX: room.minX - 0.2,
    labMaxX: room.maxX + 0.2,
    doorX: labRoom.door.handle.x,
    doorWidth: labRoom.door.width,
    doorHeight: labRoom.door.height,
  });
  scene.add(corridor.group);
  dynamic.push(() =>
    corridor.update(performance.now() / 1000, reducedMotion.matches),
  );
  // The everyday tool board hangs on the south wall east of the door,
  // facing into the lab; the west side of the door is the sink's corner.
  const toolRack = createToolRack(worldUnitsPerMetre);
  toolRack.group.position.set(
    labRoom.door.handle.x + labRoom.door.width / 2 + 0.85 * worldUnitsPerMetre,
    floorY + 1.45 * worldUnitsPerMetre,
    room.maxZ,
  );
  toolRack.group.rotation.y = Math.PI;
  lab.add(toolRack.group);
  for (const item of toolRack.tools)
    for (const part of item.parts) bind(part, () => write(item.note));
  // A long workbench along the west wall, with the sink in the south-west
  // corner. It starts clear of the xenon bank and the ashtray stand.
  const workbench = createWestWorkbench({
    floorY,
    worldUnitsPerMetre,
    wallX: room.minX,
    fromZ: room.minZ + 1.4 * worldUnitsPerMetre,
    toZ: room.maxZ,
  });
  lab.add(workbench.group);
  dynamic.push(() =>
    workbench.update(performance.now() / 1000, reducedMotion.matches),
  );
  for (const part of workbench.tapParts)
    bind(part, () =>
      write(
        workbench.toggleTap()
          ? 'Sink tap on. The pipes knock twice, then think better of it.'
          : 'Sink tap off.',
      ),
    );
  // The door is used from within arm's reach, from either side.
  const doorReach = 2.8 * worldUnitsPerMetre;
  const doorParts = new Set<Object3D>(labRoom.door.parts);
  for (const part of labRoom.door.parts)
    bind(part, () => {
      const open = labRoom.door.toggle();
      audio.play(open ? 'relay' : 'breaker-off');
      write(open ? 'Lab door opened.' : 'Lab door closed.');
    });
  // A six-station ferrocore carousel occupies the companion rack's open bay.
  const drum = new Group();
  drum.position.set(5.35, floorY + 3.1, 2);
  drum.scale.setScalar(2);
  lab.add(drum);
  for (const x of [-0.68, 0.68]) {
    cube(drum, 0.16, 1.58, 0.22, '#69736c', x, -0.72, -0.23);
    cube(drum, 0.35, 0.08, 0.53, '#3a403a', x, -1.49, -0.18);
  }
  cube(drum, 1.6, 0.13, 0.55, '#353c38', 0, -0.67, -0.22);
  const barrel = new Mesh(
    new CylinderGeometry(0.7, 0.7, 0.52, 12),
    material('#444943'),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.07;
  drum.add(barrel);
  const carousel = new Group();
  drum.add(carousel);
  disc(carousel, 0.59, '#826953', 0, 0, 0.36);
  disc(carousel, 0.49, '#283733', 0, 0, 0.371);
  for (let station = 0; station < 6; station++) {
    const angle = (station / 6) * Math.PI * 2;
    const x = Math.sin(angle) * 0.4;
    const y = Math.cos(angle) * 0.4;
    disc(carousel, 0.145, '#b08a57', x, y, 0.385);
    disc(carousel, 0.11, '#2e3835', x, y, 0.392);
    const core = new Mesh(
      new TorusGeometry(0.072, 0.035, 4, 8),
      material(station < 4 ? '#d6c6a0' : '#918d72'),
    );
    core.position.set(x, y, 0.413);
    carousel.add(core);
  }
  disc(carousel, 0.115, '#e0a752', 0, 0, 0.4);
  disc(carousel, 0.055, '#413b2c', 0, 0, 0.409);
  cube(drum, 0.16, 0.34, 0.13, '#c49b5c', 0.82, 0.07, 0.28);
  disc(drum, 0.065, '#c6d7ba', 0.82, 0.31, 0.37);
  label(drum, 'FERROCORE DRUM / 1-6', 0, 0.89, 0.33, 10);
  const coreConduit = new Mesh(
    new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(2.1, floorY + 3.0, 0.06),
        new Vector3(2.75, floorY + 2.75, 0.4),
        new Vector3(3.45, floorY + 2.9, 1.3),
        new Vector3(3.9, floorY + 3.1, 1.8),
      ]),
      14,
      0.12,
      6,
      false,
    ),
    material('#262b28'),
  );
  lab.add(coreConduit);
  // The side cabinet carries the downstream amplifier, emitter and cooler.
  const sideCabinet = new Group();
  sideCabinet.position.set(5.35, floorY + 8.85, 2);
  lab.add(sideCabinet);
  // A shorter 19-inch companion rack: the three bolted instrument blocks
  // occupy its top rails, with the lower frame left deliberately empty.
  cube(sideCabinet, 4.8, 10.6, 0.08, '#1b2522', 0, -3.53, -5.17);
  cube(sideCabinet, 5.1, 0.15, 5.45, '#727a69', 0, 1.82, -2.5);
  cube(sideCabinet, 5.1, 0.15, 5.45, '#727a69', 0, -8.85, -2.5);
  for (const x of [-2.42, 2.42]) {
    for (const z of [-5.1, 0.2])
      cube(sideCabinet, 0.15, 10.6, 0.22, '#7d806f', x, -3.53, z);
    for (const y of [-1.62, -0.55, 0.55, 1.62])
      disc(sideCabinet, 0.045, '#d5bd87', x, y, 0.37);
  }
  const sideUnits = [
    { maker: 'NEUMANN DYNAMIK', title: '7-STAGE BETAFORM AMP', y: 1.1 },
    { maker: 'VOLT XOCCULA', title: 'ISOLATED-FRAME FLUX EMITTER', y: 0 },
    { maker: 'SYNCLEX', title: 'NANOCORE B-E RADIATOR', y: -1.1 },
  ];
  for (const unit of sideUnits) {
    cube(sideCabinet, panelWidth, 1.03, 3.0, '#424b45', 0, unit.y, -1.25);
    const skin = createPanelLivery(unit.maker, '#424b45', 3);
    textures.push(skin);
    const skinMesh = new Mesh(
      new PlaneGeometry(panelWidth - 0.08, 1),
      createPs1Material({ map: skin }, true),
    );
    materials.push(skinMesh.material);
    skinMesh.position.set(0, unit.y, 0.31);
    sideCabinet.add(skinMesh);
    const header = createPanelHeader(unit.maker, unit.title);
    textures.push(header);
    const headerMesh = new Mesh(
      new PlaneGeometry(panelWidth - 0.18, 0.24),
      createPs1Material({ map: header }, true),
    );
    materials.push(headerMesh.material);
    headerMesh.position.set(0, unit.y + 0.36, 0.36);
    sideCabinet.add(headerMesh);
    for (const x of [-2.05, 2.05])
      for (const y of [unit.y - 0.4, unit.y + 0.4])
        disc(sideCabinet, 0.06, '#d5bd87', x, y, 0.39);
  }
  for (let stage = 0; stage < 7; stage++) {
    const x = -0.77 + stage * 0.25;
    const lamp = disc(sideCabinet, 0.075, '#413b30', x, 0.96, 0.39);
    dynamic.push(() => {
      (lamp.material as ReturnType<typeof material>).color.set(
        rig.heater > (stage + 1) / 8 ? '#f3b157' : '#413b30',
      );
    });
  }
  const ampKnob = new Mesh(
    new CylinderGeometry(0.13, 0.13, 0.12, 10),
    material('#293330'),
  );
  ampKnob.rotation.x = Math.PI / 2;
  ampKnob.position.set(0.73, 0.7, 0.43);
  sideCabinet.add(ampKnob);
  bind(ampKnob, () => {
    settings.knobs.gain = (settings.knobs.gain + 0.1) % 1.01;
    audio.play('knob');
    write(`Betaform stage gain to ${(settings.knobs.gain * 10).toFixed(1)}.`);
  });
  disc(sideCabinet, 0.25, '#d7ad6b', 0, -0.11, 0.39);
  disc(sideCabinet, 0.16, '#273d3e', 0, -0.11, 0.4);
  const emitterLamp = disc(sideCabinet, 0.09, '#33433e', 0, -0.11, 0.41);
  dynamic.push(() => {
    (emitterLamp.material as ReturnType<typeof material>).color.set(
      rig.field > 0.2 ? '#7ce5c5' : '#33433e',
    );
  });
  for (let fin = 0; fin < 9; fin++)
    cube(
      sideCabinet,
      0.09,
      0.28,
      0.12,
      '#a2ad9d',
      -0.72 + fin * 0.18,
      -1.2,
      0.4,
    );
  const sideConduit = new Mesh(
    new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(3.84, floorY + 1.55, 0),
        new Vector3(4.28, floorY + 1.95, 0.03),
        new Vector3(4.2, floorY + 2.72, 0),
      ]),
      12,
      0.07,
      6,
      false,
    ),
    material('#272d2a'),
  );
  lab.add(sideConduit);
  // Steel document cabinet for the reconstructed operating papers.
  const fileCabinet = new Group();
  fileCabinet.position.set(10.8, floorY + 4.57, 1.2);
  fileCabinet.scale.set(2.8, 3.68, 4.8);
  lab.add(fileCabinet);
  cube(fileCabinet, 1.52, 2.48, 1.08, '#81918d', 0, 0, -0.13);
  cube(fileCabinet, 1.62, 0.1, 1.16, '#a8b5ab', 0, 1.23, -0.13);
  for (const x of [-0.54, 0.54])
    cube(fileCabinet, 0.1, 0.08, 0.1, '#444e48', x, -1.25, 0.26);
  const drawerNames = [
    'OPERATING GUIDE',
    'INSTRUCTION MANUAL',
    'CIRCUIT DIAGRAMS',
  ];
  const drawers: Group[] = [];
  let openDrawer = -1;
  let showManual: (index: number) => void = () => undefined;
  for (let index = 0; index < 3; index++) {
    const drawer = new Group();
    drawer.position.y = 0.73 - index * 0.78;
    fileCabinet.add(drawer);
    drawers.push(drawer);
    const front = cube(drawer, 1.32, 0.67, 0.08, '#a7b5ae', 0, 0, 0.47);
    cube(drawer, 0.55, 0.13, 0.07, '#515e56', 0, -0.13, 0.53);
    label(drawer, drawerNames[index], 0, 0.14, 0.53, 8, '#344139', '#e2dbc6');
    bind(front, () => {
      openDrawer = openDrawer === index ? -1 : index;
      drawers.forEach((item, itemIndex) => {
        item.position.z = itemIndex === openDrawer ? 0.2 : 0;
      });
      audio.play('paper');
      if (openDrawer >= 0) showManual(openDrawer);
    });
  }
  label(fileCabinet, 'VX3 REFERENCE FILES', 0, 1.36, 0.44, 10);
  const pinBoard = new Group();
  pinBoard.position.set(5.37, floorY + 13.05, -3.55);
  pinBoard.scale.setScalar(1.8);
  lab.add(pinBoard);
  cube(pinBoard, 2.8, 1.6, 0.11, '#5d4a32', 0, 0, 0);
  cube(pinBoard, 2.58, 1.4, 0.02, '#a5835a', 0, 0, 0.07);
  cube(pinBoard, 1.18, 1.15, 0.012, '#e7dcc0', -0.62, 0.06, 0.09);
  label(pinBoard, 'VX LAB SAFETY', -0.62, 0.42, 0.11, 13, '#b44334', '#e7dcc0');
  label(
    pinBoard,
    'NO LIVE CORE CHANGES',
    -0.62,
    0.12,
    0.11,
    8,
    '#303b35',
    '#e7dcc0',
  );
  label(
    pinBoard,
    'RETROCHECK FIRST',
    -0.62,
    -0.12,
    0.11,
    8,
    '#303b35',
    '#e7dcc0',
  );
  label(
    pinBoard,
    'REPORT ALL GLOW',
    -0.62,
    -0.36,
    0.11,
    8,
    '#303b35',
    '#e7dcc0',
  );
  cube(pinBoard, 1.02, 0.56, 0.012, '#d9ccaa', 0.73, 0.32, 0.09);
  label(pinBoard, 'SHIFT ROTA', 0.73, 0.43, 0.11, 9, '#374745', '#d9ccaa');
  label(pinBoard, 'A / B / C', 0.73, 0.22, 0.11, 9, '#374745', '#d9ccaa');
  cube(pinBoard, 1.02, 0.48, 0.012, '#e6b887', 0.76, -0.39, 0.1);
  label(
    pinBoard,
    'CORE 5: QUARANTINE',
    0.76,
    -0.38,
    0.12,
    8,
    '#5a3328',
    '#e6b887',
  );
  for (const [x, y] of [
    [-1.08, 0.6],
    [0.33, 0.56],
    [0.34, -0.16],
  ])
    disc(pinBoard, 0.04, '#c34b39', x, y, 0.14);
  const posterLoader = new TextureLoader();
  for (const [index, name] of [
    'volt-xoccula',
    'neumann-dynamik',
    'bonk-industries',
  ].entries()) {
    const x = 3.1 + index * 2.9;
    const y = floorY + 17.3;
    cube(lab, 2.48, 3.64, 0.035, '#4b3e31', x, y, -3.5);
    const poster = posterLoader.load(`/posters/${name}.png`);
    poster.colorSpace = SRGBColorSpace;
    poster.magFilter = NearestFilter;
    textures.push(poster);
    const printedFace = new Mesh(
      new PlaneGeometry(2.25, 3.4),
      createPs1Material({ map: poster }, true),
    );
    materials.push(printedFace.material);
    printedFace.position.set(x, y, -3.46);
    lab.add(printedFace);
  }
  for (let x = -8.5; x <= 8.5; x += 2.4) {
    cube(lab, 0.025, totalHeight + 4, 0.025, '#77847a', x, 0, -3.77);
  }
  const wallDisplayStart = lab.children.length;
  const wallDisplayX = -6.05;
  const wallDisplayTop = totalHeight / 2 - 0.42;
  const clockY = wallDisplayTop - 0.28;
  disc(lab, 0.49, '#594f3b', wallDisplayX, clockY, -3.6);
  disc(lab, 0.41, '#e4dac0', wallDisplayX, clockY, -3.58);
  for (let hour = 0; hour < 12; hour++) {
    const angle = (hour / 12) * Math.PI * 2;
    disc(
      lab,
      hour % 3 === 0 ? 0.034 : 0.02,
      '#4c5245',
      wallDisplayX + Math.sin(angle) * 0.34,
      clockY + Math.cos(angle) * 0.34,
      -3.56,
    );
  }
  const clockHand = (length: number, width: number) => {
    const hand = cube(
      lab,
      width,
      length,
      0.012,
      '#303c38',
      wallDisplayX,
      clockY,
      -3.54,
    );
    hand.geometry.translate(0, length / 2, 0);
    return hand;
  };
  const hourHand = clockHand(0.21, 0.033);
  const minuteHand = clockHand(0.3, 0.019);
  disc(lab, 0.04, '#a37149', wallDisplayX, clockY, -3.52);
  dynamic.push(() => {
    const now = new Date();
    hourHand.rotation.z =
      (-((now.getHours() % 12) + now.getMinutes() / 60) * Math.PI) / 6;
    minuteHand.rotation.z =
      (-(now.getMinutes() + now.getSeconds() / 60) * Math.PI) / 30;
  });
  cube(
    lab,
    2.85,
    0.34,
    0.08,
    '#323f39',
    wallDisplayX,
    wallDisplayTop - 1.05,
    -3.65,
  );
  label(
    lab,
    'GLOBAL FLUX CORRELATIONS',
    wallDisplayX,
    wallDisplayTop - 1.05,
    -3.59,
    12,
    '#e3d4ab',
    '#323f39',
  );
  cube(
    lab,
    2.94,
    1.47,
    0.09,
    '#564f3c',
    wallDisplayX,
    wallDisplayTop - 2.04,
    -3.65,
  );
  const worldMap = createWorldMapTexture();
  textures.push(worldMap);
  const mapFace = new Mesh(
    new PlaneGeometry(2.8, 1.34),
    createPs1Material({ map: worldMap }, true),
  );
  materials.push(mapFace.material);
  mapFace.position.set(wallDisplayX, wallDisplayTop - 2.04, -3.58);
  lab.add(mapFace);
  const ledPins: [number, number][] = [
    [0.2, 0.7],
    [0.27, 0.39],
    [0.47, 0.74],
    [0.53, 0.46],
    [0.63, 0.72],
    [0.75, 0.55],
    [0.84, 0.31],
  ];
  ledPins.forEach(([u, v], index) => {
    const x = wallDisplayX + (u - 0.5) * 2.8;
    const y = wallDisplayTop - 2.04 + (v - 0.5) * 1.34;
    disc(lab, 0.068, '#46443a', x, y, -3.55);
    const light = disc(lab, 0.038, '#f0b85b', x, y, -3.53);
    dynamic.push(() => {
      (light.material as ReturnType<typeof material>).color.set(
        Math.sin(performance.now() * 0.0013 + index * 1.8) > -0.45
          ? rig.field > 0.5 && index % 3 === 0
            ? '#ff7252'
            : '#ffd47c'
          : '#776b4e',
      );
    });
  });
  label(
    lab,
    'LABORATORY 3 / PHASE STUDIES',
    wallDisplayX,
    wallDisplayTop - 3.08,
    -3.57,
    9,
    '#e3d4ab',
    '#323f39',
  );
  // Wall-mounted supply audit meter: the needle shows load, the register totals kWh.
  const meterY = wallDisplayTop - 4.18;
  cube(lab, 2.9, 1.66, 0.24, '#4b5650', wallDisplayX, meterY, -3.46);
  cube(lab, 2.68, 1.47, 0.045, '#d6cbaa', wallDisplayX, meterY, -3.31);
  label(
    lab,
    'POWER DRAW / KILOWATT HOURS',
    wallDisplayX,
    meterY + 0.59,
    -3.275,
    10,
    '#343f39',
    '#d6cbaa',
  );
  disc(lab, 0.53, '#594e3c', wallDisplayX - 0.69, meterY - 0.06, -3.27);
  disc(lab, 0.46, '#e9dfbf', wallDisplayX - 0.69, meterY - 0.06, -3.25);
  for (let tick = 0; tick <= 8; tick++) {
    const angle = -Math.PI * 0.75 + (tick / 8) * Math.PI * 1.5;
    const x = wallDisplayX - 0.69 + Math.sin(angle) * 0.37;
    const y = meterY - 0.06 + Math.cos(angle) * 0.37;
    disc(lab, tick % 2 === 0 ? 0.026 : 0.014, '#4b5044', x, y, -3.235);
  }
  const loadNeedle = cube(
    lab,
    0.026,
    0.34,
    0.015,
    '#a94b38',
    wallDisplayX - 0.69,
    meterY - 0.06,
    -3.21,
  );
  loadNeedle.geometry.translate(0, 0.16, 0);
  disc(lab, 0.045, '#4b4135', wallDisplayX - 0.69, meterY - 0.06, -3.195);
  label(lab, 'LOAD kW', wallDisplayX - 0.69, meterY - 0.52, -3.22, 8);
  cube(
    lab,
    1.16,
    0.46,
    0.06,
    '#2f332e',
    wallDisplayX + 0.62,
    meterY - 0.08,
    -3.25,
  );
  const register = createCanvasTexture(160, 48);
  textures.push(register.texture);
  const registerFace = new Mesh(
    new PlaneGeometry(1.08, 0.34),
    createPs1Material({ map: register.texture }, true),
  );
  materials.push(registerFace.material);
  registerFace.position.set(wallDisplayX + 0.62, meterY - 0.08, -3.205);
  lab.add(registerFace);
  label(lab, 'TOTAL kWh', wallDisplayX + 0.62, meterY - 0.45, -3.23, 8);
  let lastRegister = '';
  dynamic.push(() => {
    loadNeedle.rotation.z =
      Math.PI * (0.75 - Math.min(1, telltales.powerKw / 8) * 1.5);
    const reading = telltales.energyKwh.toFixed(4).padStart(9, '0');
    if (reading === lastRegister) return;
    lastRegister = reading;
    register.context.fillStyle = '#1a231f';
    register.context.fillRect(0, 0, 160, 48);
    register.context.fillStyle = '#e4c875';
    register.context.font = 'bold 24px monospace';
    register.context.textAlign = 'center';
    register.context.textBaseline = 'middle';
    register.context.fillText(reading, 80, 25);
    register.texture.needsUpdate = true;
  });

  // Prismatic tell-tale for the connected field: dim at rest, occasional pulses in operation.
  const crystalY = wallDisplayTop - 6.17;
  cube(lab, 1.82, 1.62, 0.13, '#495a55', wallDisplayX, crystalY, -3.5);
  cube(lab, 1.58, 1.38, 0.028, '#263d3e', wallDisplayX, crystalY, -3.42);
  label(lab, 'TIME DILATION', wallDisplayX, crystalY + 0.62, -3.385, 12);
  disc(lab, 0.48, '#657873', wallDisplayX, crystalY - 0.11, -3.37);
  disc(lab, 0.4, '#172f36', wallDisplayX, crystalY - 0.11, -3.35);
  const crystalMaterial = material('#467888');
  const crystal = new Mesh(new OctahedronGeometry(0.4, 0), crystalMaterial);
  crystal.scale.set(0.72, 1.28, 0.56);
  crystal.rotation.z = 0.24;
  crystal.position.set(wallDisplayX, crystalY - 0.11, -3.13);
  lab.add(crystal);
  const crystalLamp = disc(
    lab,
    0.09,
    '#425c5c',
    wallDisplayX + 0.61,
    crystalY - 0.5,
    -3.38,
  );
  dynamic.push(() => {
    const pulse = telltales.crystalPulse;
    crystalMaterial.color.setRGB(
      0.18 + pulse * 0.48,
      0.35 + pulse * 0.46,
      0.4 + pulse * 0.55,
    );
    (crystalLamp.material as ReturnType<typeof material>).color.setRGB(
      0.18 + pulse * 0.55,
      0.33 + pulse * 0.52,
      0.33 + pulse * 0.62,
    );
    crystal.scale.set(
      0.72,
      1.28 * (reducedMotion.matches ? 1 : 1 + pulse * 0.12),
      0.56,
    );
  });
  // Scale the wall display around its lower edge, keeping the clock below the
  // ceiling while giving the map and safety meters readable physical sizes.
  const wallDisplay = new Group();
  const displayScale = 1.8;
  const displayAnchorY = floorY + 11.2;
  wallDisplay.scale.setScalar(displayScale);
  wallDisplay.position.set(
    -10.3 - wallDisplayX * displayScale,
    displayAnchorY * (1 - displayScale),
    -3.6 * (1 - displayScale),
  );
  for (const part of lab.children.slice(wallDisplayStart))
    wallDisplay.add(part);
  lab.add(wallDisplay);
  cube(lab, 2.4, 0.1, 0.25, '#a4aaa0', -4.45, totalHeight / 2 + 0.55, -3.45);
  cube(lab, 2.25, 0.055, 0.04, '#e5d6a7', -4.45, totalHeight / 2 + 0.45, -3.3);

  // A workbench with a CRT, calibration source and stacked paper records.
  const bench = new Group();
  bench.position.set(-7.9, floorY, -0.8);
  bench.scale.set(3.7, 5.7, 4.5);
  lab.add(bench);
  cube(bench, 2.8, 0.18, 1.35, '#896e50', 0, 1.24, 0);
  cube(bench, 2.85, 0.035, 1.4, '#c3a477', 0, 1.36, 0);
  for (const x of [-1.25, 1.25]) {
    for (const z of [-0.5, 0.5])
      cube(bench, 0.13, 1.2, 0.13, '#3c453e', x, 0.61, z);
  }
  cube(bench, 1.05, 0.65, 0.55, '#6b746b', 0.45, 1.77, -0.18);
  cube(bench, 0.68, 0.42, 0.02, '#172e2a', 0.42, 1.78, 0.11);
  const crtGlow = disc(bench, 0.12, '#8bc6a0', 0.42, 1.78, 0.125);
  crtGlow.scale.set(1.7, 0.4, 1);
  cube(bench, 0.57, 0.42, 0.45, '#a49b7f', -0.55, 1.65, -0.22);
  for (const x of [-0.71, -0.5, -0.29])
    disc(bench, 0.045, '#e0ba6d', x, 1.66, 0.02);
  for (let i = 0; i < 4; i++)
    cube(bench, 0.57, 0.025, 0.38, '#e0d4af', -0.48, 1.45 + i * 0.025, 0.36);

  // The brass stand sits left of the xenon bank, cigarette still burning.
  const ashtray = createPedestalAshtray();
  ashtray.group.position.set(-19.0, floorY, -1.6);
  ashtray.group.scale.setScalar(3.3);
  lab.add(ashtray.group);
  dynamic.push(() =>
    ashtray.update(performance.now() / 1000, reducedMotion.matches),
  );

  // Xenon supply: cylinders against the wall left of the bench, with a thick
  // hose run behind the bench to a bulkhead on the back of the main cabinet.
  const xenonFloor = floorY + 0.05;
  const xenon = createXenonCylinders({
    floorY,
    x: -16.5,
    z: -3.3,
    hoseVia: [
      new Vector3(-13.1, xenonFloor, -2.55),
      new Vector3(-5.1, xenonFloor, -2.6),
      new Vector3(-2.2, xenonFloor, -1.6),
    ],
    hoseEnd: new Vector3(-1.6, floorY + 1.3, -0.86),
  });
  lab.add(xenon.group);
  dynamic.push(() =>
    xenon.update(performance.now() / 1000, reducedMotion.matches),
  );
  bind(xenon.regulatorKnob, () => {
    const setting = xenon.stepRegulator();
    audio.play('knob');
    write(
      setting === 0
        ? 'Xenon regulator wound shut.'
        : `Xenon regulator to ${(setting * 4).toFixed(1)} bar; flow settling toward ${(setting * 10).toFixed(1)} SLPM.`,
    );
  });

  // The emergency telephone is on the east wall at shoulder height.
  const hotline = createHotlinePhone();
  hotline.group.position.set(
    room.maxX - 0.16,
    floorY + 1.4 * worldUnitsPerMetre,
    8,
  );
  hotline.group.rotation.y = -Math.PI / 2;
  // A roughly 18 cm wide wall telephone with a legible hazard sign.
  hotline.group.scale.setScalar(3.5);
  lab.add(hotline.group);

  const teleprinter = createTeleprinter();
  const printerY = floorY + 0.95 * worldUnitsPerMetre;
  teleprinter.group.position.set(room.maxX - 0.42, printerY, 1.25);
  teleprinter.group.scale.setScalar(2.5);
  teleprinter.group.rotation.y = -Math.PI / 2;
  teleprinter.outputPile.position.y = (floorY - printerY) / 2.5 + 0.08;
  for (const y of [printerY - 1.4, printerY + 0.9])
    cube(lab, 0.94, 0.09, 0.12, '#67736c', room.maxX - 0.38, y, 1.25);
  lab.add(teleprinter.group);

  // The wall outlet and the trailing rubber mains lead are visible at rack base.
  const socketX = -5.6;
  cube(lab, 0.52, 0.7, 0.08, '#c9bf9f', socketX, floorY + 2.5, -3.62);
  cube(lab, 0.35, 0.45, 0.018, '#eee2bd', socketX, floorY + 2.5, -3.56);
  for (const x of [socketX - 0.08, socketX + 0.08]) {
    disc(lab, 0.037, '#3c3b31', x, floorY + 2.56, -3.54);
  }
  disc(lab, 0.045, '#3c3b31', socketX, floorY + 2.4, -3.54);
  cube(lab, 0.18, 0.15, 0.13, '#403f36', socketX, floorY + 2.24, -3.46);
  label(
    lab,
    '240 V / ISOLATED',
    socketX,
    floorY + 3.03,
    -3.58,
    8,
    '#e3d8b7',
    '#343d38',
  );
  const cable = new Mesh(
    new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(socketX, floorY + 2.24, -3.4),
        new Vector3(socketX, floorY + 1.45, -3.05),
        new Vector3(-4.35, floorY + 0.04, -1.75),
        new Vector3(-4.15, floorY + 0.04, -0.2),
        new Vector3(-3.2, floorY + 0.04, 0.55),
        new Vector3(-2.55, floorY + 0.08, 0.28),
        new Vector3(-2.4, floorY + 0.28, -0.3),
      ]),
      48,
      0.055,
      5,
      false,
    ),
    material('#302e2a'),
  );
  lab.add(cable);

  // 825 mm deep enclosure, using the published 42U AV rack footprint.
  const cabinetDepth = 0.825 * worldUnitsPerMetre;
  const cabinetCentreZ = -0.15 - cabinetDepth / 2;
  cube(
    rack,
    5.05,
    totalHeight + 0.25,
    cabinetDepth,
    '#242724',
    0,
    0,
    cabinetCentreZ,
  );
  for (const x of [-2.5, 2.5]) {
    cube(
      rack,
      0.08,
      totalHeight + 0.25,
      cabinetDepth,
      '#313a35',
      x,
      0,
      cabinetCentreZ,
    );
  }
  cube(
    rack,
    4.65,
    totalHeight + 0.12,
    0.05,
    '#111b1a',
    0,
    0,
    -0.15 - cabinetDepth,
  );
  for (const x of [-2.38, 2.38]) {
    cube(rack, 0.16, totalHeight + 0.3, 0.54, '#353a37', x, 0, 0.03);
    cube(
      rack,
      0.035,
      totalHeight + 0.3,
      0.58,
      '#a3a18a',
      x + (x < 0 ? 0.11 : -0.11),
      0,
      0.13,
    );
  }
  cube(
    rack,
    5.2,
    0.18,
    cabinetDepth,
    '#3e423b',
    0,
    totalHeight / 2 + 0.08,
    cabinetCentreZ,
  );
  cube(
    rack,
    5.2,
    0.18,
    cabinetDepth,
    '#30332f',
    0,
    -totalHeight / 2 - 0.08,
    cabinetCentreZ,
  );
  const antennaX = -1.55;
  const antennaBaseY = totalHeight / 2 + 0.17;
  cube(rack, 0.35, 0.12, 0.32, '#d0c49c', antennaX, antennaBaseY, 0);
  const mast = new Mesh(
    new CylinderGeometry(0.045, 0.07, 0.85, 7),
    material('#b6bbb0'),
  );
  mast.position.set(antennaX, antennaBaseY + 0.47, 0);
  rack.add(mast);
  cube(rack, 0.72, 0.045, 0.045, '#c0c4b8', antennaX, antennaBaseY + 0.65, 0);
  for (const x of [antennaX - 0.38, antennaX + 0.38]) {
    cube(rack, 0.04, 0.18, 0.04, '#c0c4b8', x, antennaBaseY + 0.65, 0);
  }
  disc(rack, 0.085, '#e4b775', antennaX, antennaBaseY + 0.92, 0.035);

  const addGauge = (
    panel: Group,
    x: number,
    y: number,
    reading: () => number,
    caption: string,
  ) => {
    const dial = createDialTexture();
    textures.push(dial);
    const face = new Mesh(
      new PlaneGeometry(0.69, 0.69),
      createPs1Material({ map: dial }, true),
    );
    materials.push(face.material);
    face.position.set(x, y, 0.29);
    panel.add(face);
    const needle = cube(panel, 0.018, 0.28, 0.012, '#a63425', x, y, 0.31);
    needle.geometry.translate(0, 0.13, 0);
    dynamic.push(() => {
      needle.rotation.z =
        Math.PI * (0.75 - Math.max(0, Math.min(1, reading())) * 1.5);
    });
    label(panel, caption, x, y - 0.47, 0.27, 9);
  };

  let top = totalHeight / 2 - 0.2;
  let band = 2;
  const bands = ['A', 'B', 'C', 'D', 'E', 'Ω'];
  for (const [moduleIndex, module] of modules.entries()) {
    const h = module.units * U;
    const y = top - h / 2;
    const panel = new Group();
    panel.position.y = y;
    rack.add(panel);
    cube(panel, panelWidth, h - 0.055, 0.27, module.finish, 0, 0, 0.04);
    const livery = createPanelLivery(module.maker, module.finish, module.units);
    textures.push(livery);
    const faceplate = new Mesh(
      new PlaneGeometry(panelWidth - 0.22, h - 0.055),
      createPs1Material({ map: livery }, true),
    );
    materials.push(faceplate.material);
    faceplate.position.z = 0.182;
    panel.add(faceplate);
    cube(panel, 4.1, 0.025, 0.015, '#adb0a0', 0, h / 2 - 0.1, 0.19);
    for (const x of [-2.1, 2.1]) {
      cube(panel, 0.2, h - 0.04, 0.32, '#6c7169', x, 0, 0.1);
      for (const screwY of [-h / 2 + 0.16, h / 2 - 0.16]) {
        disc(panel, 0.055, '#bcaa81', x, screwY, 0.27);
        cube(panel, 0.068, 0.01, 0.008, '#514936', x, screwY, 0.279);
      }
      if (module.units >= 4) {
        cube(
          panel,
          0.065,
          0.65,
          0.16,
          '#252825',
          x + (x < 0 ? 0.16 : -0.16),
          0,
          0.29,
        );
      }
    }
    const header = createPanelHeader(module.maker, module.title);
    textures.push(header);
    const headerPlate = new Mesh(
      new PlaneGeometry(4.05, 0.3),
      createPs1Material({ map: header }, true),
    );
    materials.push(headerPlate.material);
    headerPlate.position.set(0, h / 2 - 0.27, 0.235);
    panel.add(headerPlate);
    label(
      panel,
      module.id.toUpperCase(),
      1.51,
      -h / 2 + 0.17,
      0.235,
      8,
      '#342d20',
      '#c6b68e',
    );
    for (let vent = 0; vent < 5; vent++)
      cube(
        panel,
        0.29,
        0.025,
        0.015,
        '#1d2423',
        1.4 + vent * 0.1,
        h / 2 - 0.55,
        0.215,
      );

    if (module.id.startsWith('valves')) {
      const tubeSwitches = ['aux1', 'xtalA', 'xtalB', 'xtalC'] as const;
      for (const [index, x] of [-1.35, -0.55, 0.25, 1.05].entries()) {
        cube(panel, 0.28, 0.07, 0.19, '#252823', x, 0.09, 0.31);
        const glassMaterial = material('#40342b');
        const glass = new Mesh(
          new CylinderGeometry(0.1, 0.1, 0.2, 8),
          glassMaterial,
        );
        glass.position.set(x, 0.22, 0.34);
        panel.add(glass);
        const filament = cube(
          panel,
          0.065,
          0.17,
          0.025,
          '#4f2f19',
          x,
          0.37,
          0.46,
        );
        const filamentMaterial = filament.material as ReturnType<
          typeof material
        >;
        let glowLevel = 0;
        dynamic.push(() => {
          const target =
            rig.heater *
            (settings.toggles.ht ? 1 : 0.03) *
            (settings.toggles[tubeSwitches[index]] ? 1 : 0.08);
          glowLevel += (target - glowLevel) * 0.075;
          const time = performance.now() * 0.001;
          const flutter =
            0.86 +
            0.1 * Math.sin(time * (9.7 + index * 1.4) + index * 2.1) +
            0.04 * Math.sin(time * (31 + index * 3.3));
          const brightness = Math.max(0, glowLevel * flutter);
          filamentMaterial.color.setRGB(
            0.2 + brightness * 0.8,
            0.1 + brightness * 0.36,
            0.04 + brightness * 0.08,
          );
          glassMaterial.color.setRGB(
            0.24 + brightness * 0.19,
            0.19 + brightness * 0.09,
            0.14 + brightness * 0.025,
          );
        });
      }
    }

    for (const control of module.controls) {
      const x = control.x;
      const cy = module.units >= 4 ? -0.28 : -0.2;
      if (control.kind === 'knob' || control.kind === 'selector') {
        disc(panel, 0.26, '#1e2422', x, cy, 0.25);
        const knob = new Mesh(
          new CylinderGeometry(0.18, 0.2, 0.13, 12),
          material(control.kind === 'selector' ? '#8b7853' : '#252928'),
        );
        knob.rotation.x = Math.PI / 2;
        knob.position.set(x, cy, 0.35);
        panel.add(knob);
        const mark = cube(
          panel,
          0.025,
          0.12,
          0.012,
          '#e7d6ad',
          x,
          cy + 0.11,
          0.43,
        );
        const id = control.kind === 'knob' ? control.id : null;
        const update = () => {
          mark.rotation.z = -((id ? settings.knobs[id] : band / 5) - 0.5) * 4.4;
        };
        dynamic.push(update);
        bind(knob, () => {
          if (id) {
            settings.knobs[id] = (settings.knobs[id] + 0.1) % 1.01;
            applyRack(settings, rig.controls);
            audio.play('knob');
            write(knobLine(id, settings.knobs[id]));
          } else {
            band = (band + 1) % bands.length;
            settings.knobs.ratio = band / 5;
            audio.play('selector');
            write(`Band ${bands[band]} selected.`);
          }
        });
      } else if (control.kind === 'button') {
        disc(panel, 0.24, '#202521', x, cy, 0.25);
        const color =
          control.id === 'reset'
            ? '#638960'
            : control.id === 'purge'
              ? '#b29952'
              : '#ad5946';
        const button = cube(panel, 0.26, 0.2, 0.12, color, x, cy, 0.35);
        bind(button, () => {
          audio.play('button');
          if (control.id === 'reset') {
            Object.assign(rig, createRig());
            applyRack(settings, rig.controls);
            write('RESET pressed. Rig reset, mostly.');
          } else if (control.id === 'purge') {
            rig.strain = Math.max(0, rig.strain - 0.35);
            rig.drift *= 0.5;
            audio.play('purge');
            write('PURGE pressed. Hiss from behind the wall.');
          } else {
            if (rig.controls.mains) rig.strain = Math.min(1, rig.strain + 0.15);
            audio.play('spark');
            write('Pressed DO NOT. The annotation was unspecific.');
          }
        });
      } else {
        const id = control.kind === 'toggle' ? control.id : null;
        const isOn = () => (id ? settings.toggles[id] : rig.controls.mains);
        disc(panel, 0.2, '#1e2220', x, cy, 0.25);
        const switchBody = cube(
          panel,
          0.18,
          0.26,
          0.15,
          control.kind === 'mains' ? '#ab4933' : '#c5bda5',
          x,
          cy,
          0.36,
        );
        const indicator = disc(panel, 0.05, '#473829', x, cy + 0.3, 0.28);
        dynamic.push(() => {
          switchBody.rotation.x = isOn() ? -0.45 : 0.45;
          (indicator.material as ReturnType<typeof material>).color.set(
            isOn() && rig.heater > 0 ? '#f7a344' : '#473829',
          );
        });
        bind(switchBody, () => {
          if (id) {
            settings.toggles[id] = !settings.toggles[id];
            applyRack(settings, rig.controls);
            audio.play(settings.toggles[id] ? 'toggle-up' : 'toggle-down');
            write(toggleLine(id, settings.toggles[id]));
          } else {
            rig.controls.mains = !rig.controls.mains;
            audio.play(rig.controls.mains ? 'breaker-on' : 'breaker-off');
            if (rig.controls.mains)
              window.setTimeout(() => audio.play('relay'), 110);
            write(
              rig.controls.mains
                ? 'Mains closed. Heaters warming.'
                : 'Mains opened. Rig settling. Ticking noises.',
            );
          }
        });
      }
      label(panel, control.label, x, cy - 0.38, 0.28, 9);
    }
    const instrumentY = module.units >= 4 ? 0.15 : -0.05;
    for (const [index, instrument] of module.instruments.entries()) {
      const x =
        module.instruments.length === 1
          ? 1.17
          : Math.min(instrumentSafeRight - 0.38, 0.8 + index * 0.58);
      if (instrument === 'scope') {
        const scope = createScopeScreen(96, 64);
        textures.push(scope.texture);
        const screen = new Mesh(
          new PlaneGeometry(1.15, 0.77),
          createPs1Material({ map: scope.texture }, true),
        );
        materials.push(screen.material);
        screen.position.set(1.1, instrumentY, 0.29);
        panel.add(screen);
        dynamic.push(() => {
          const points: [number, number][] = Array.from(
            { length: 40 },
            (_, i) => [
              i / 39,
              0.5 +
                Math.sin(
                  i * (0.45 + settings.knobs.ratio) + performance.now() * 0.003,
                ) *
                  rig.field *
                  (0.08 + settings.knobs.gain * 0.2 + rig.instability * 0.15),
            ],
          );
          scope.draw(points, rig.controls.mains);
        });
      } else if (instrument === 'nixie') {
        const nixie = createNixieScreen();
        textures.push(nixie.texture);
        const screen = new Mesh(
          new PlaneGeometry(1.15, 0.3),
          createPs1Material({ map: nixie.texture }, true),
        );
        materials.push(screen.material);
        screen.position.set(1.1, instrumentY - 0.75, 0.29);
        panel.add(screen);
        dynamic.push(() =>
          nixie.draw(
            String(
              Math.round(
                module.id.startsWith('monitor')
                  ? 38 + rig.instability * 400
                  : rig.spindle * 3600,
              ),
            ).padStart(6, '0'),
            rig.controls.mains,
          ),
        );
      } else {
        const reading =
          instrument === 'heater'
            ? () => rig.heater
            : instrument === 'spindle'
              ? () => rig.spindle
              : instrument === 'field'
                ? () => rig.field
                : () => rig.instability;
        addGauge(panel, x, instrumentY, reading, instrument.toUpperCase());
      }
    }
    top -= h + 0.045;
    if (moduleIndex !== 4) continue;
    const bayHeight = inspectionBayUnits * U;
    const bayY = top - bayHeight / 2;
    const bay = new Group();
    bay.position.y = bayY;
    rack.add(bay);
    cube(bay, panelWidth, bayHeight - 0.055, 0.08, '#202924', 0, 0, -0.03);
    for (const x of [-2.12, 2.12]) {
      cube(bay, 0.17, bayHeight - 0.04, 0.27, '#6c7169', x, 0, 0.08);
      for (const y of [-bayHeight / 2 + 0.16, bayHeight / 2 - 0.16])
        disc(bay, 0.055, '#bcaa81', x, y, 0.27);
    }
    // A removed inspection panel reveals a dense loom and live field taps.
    cube(bay, 3.8, bayHeight - 0.22, 0.03, '#0b1517', 0, 0, -0.01);
    for (let i = 0; i < 13; i++) {
      const x = -1.7 + i * 0.28;
      const wire = new Mesh(
        new TubeGeometry(
          new CatmullRomCurve3([
            new Vector3(x, bayHeight / 2 - 0.15, 0.08),
            new Vector3(x + Math.sin(i * 2.7) * 0.45, 0.25, 0.18),
            new Vector3(x + Math.cos(i * 1.9) * 0.5, -0.25, 0.12),
            new Vector3(
              x + Math.sin(i * 3.1) * 0.3,
              -bayHeight / 2 + 0.15,
              0.07,
            ),
          ]),
          18,
          0.025 + (i % 3) * 0.007,
          5,
          false,
        ),
        material(['#bc604a', '#d1aa54', '#5c8584', '#aca68c'][i % 4]),
      );
      bay.add(wire);
    }
    for (const x of [-1.38, 0.18, 1.42]) {
      const glow = material('#354846', true);
      const node = new Mesh(new CircleGeometry(0.13, 8), glow);
      node.position.set(x, -0.25 + x * 0.17, 0.23);
      bay.add(node);
      dynamic.push(() => {
        const pulse = (Math.sin(performance.now() / 580 + x * 3) + 1) / 2;
        glow.color.set(rig.controls.mains ? '#3fe8c3' : '#354846');
        glow.color.multiplyScalar(
          rig.controls.mains ? 0.45 + pulse * 0.55 : 0.6 + pulse * 0.18,
        );
      });
    }
    label(bay, 'FIELD BUS / PANEL REMOVED', 0, bayHeight / 2 - 0.17, 0.23, 8);
    top -= bayHeight + 0.045;
  }

  const overlay = document.createElement('div');
  overlay.className = 'rack-ui';
  overlay.innerHTML = `<div class="rack-heading"><strong>VX3 / FULL RIG</strong><small>EARLY-1970s ANALOGUE APPARATUS</small><span id="rig-status">RIG COLD</span><span id="delta-readout">δ 0.000 / 0.880</span></div><div class="view-switch" role="group" aria-label="Camera view"><button type="button" data-view="perspective" aria-pressed="true">PERSPECTIVE</button><button type="button" data-view="isometric" aria-pressed="false">ISOMETRIC</button></div><div class="sound-controls"><button type="button" id="mute-sound" aria-pressed="false">SOUND ON</button><label for="sound-volume">VOL</label><input type="range" id="sound-volume" min="0" max="100" value="55" aria-label="Sound volume"></div><div class="rack-nav" role="group" aria-label="Pan and zoom"><button type="button" data-pan="left" aria-label="Pan left">◀</button><button type="button" data-pan="up" aria-label="Pan up">▲</button><span id="unit-readout"></span><button type="button" data-pan="down" aria-label="Pan down">▼</button><button type="button" data-pan="right" aria-label="Pan right">▶</button><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="in" aria-label="Zoom in">＋</button></div><aside class="logbook"><div class="logbook-head"><strong>OPERATOR'S LOG</strong><button type="button" id="close-log" aria-label="Put the logbook away">×</button></div><ol id="log-entries"></ol></aside><button type="button" class="notebook-tab" id="open-log" hidden>▤ LOG <span id="unread-count"></span></button><p class="rack-help">CLICK: MOUSE LOOK · WASD: WALK · SHIFT: RUN · C: CROUCH · CLICK / E: USE · WHEEL: ZOOM · ESC: CURSOR</p><div class="crosshair" aria-hidden="true" hidden></div>`;
  const manualSheet = document.createElement('aside');
  manualSheet.className = 'manual-sheet';
  manualSheet.hidden = true;
  manualSheet.innerHTML = `<div class="manual-head"><strong id="manual-title"></strong><button type="button" aria-label="Close reference sheet">×</button></div><pre id="manual-content"></pre><small>VX3 WORKSTATION RECONSTRUCTION · FOR EDUCATIONAL USE ONLY</small>`;
  overlay.append(manualSheet);
  canvas.parentElement?.append(overlay);
  const manualPages = [
    {
      title: 'OPERATING GUIDE / VX3',
      content:
        '1  Close the varistance-isolated mains breaker.\n2  Allow the valve heaters to reach temperature.\n3  Start the Encabulator and advance drive gradually.\n4  Raise the Holtzmann coil field; trim for a steady Delta.\n5  Observe the Baltovsky chamber and ferrocore drum.\n6  Open the breaker if the retrocheck warns of strain.',
    },
    {
      title: 'INSTRUCTION MANUAL / CORE HANDLING',
      content:
        'SIX-STATION FERROCORE DRUM\n\nFit four to six ceramic-collared cores before excitation. Keep the drum guard shut in motion. A bright yellow Baltovsky chamber may indicate a spent core. Do not exchange cores under load. Record the core position and varistor reading after each run.',
    },
    {
      title: 'CIRCUIT DIAGRAM / SIGNAL PATH',
      content:
        'MAINS\n  |\nVARISTANCE ISOLATOR -- HEATER SUPPLY\n  |                         |\nFERROCORE BANK ----> ENCABULATOR DRIVE\n  |                         |\n  +----> HOLTZMANN COIL ----+\n                |\n      BALTOVSKY CHAMBER\n                |\n       FROMITZ DETECTOR\n                |\n      MAIN BUS CONTROLLER\n\nSIDE RACK: BETAFORM AMP / FLUX EMITTER / B-E RADIATOR',
    },
  ];
  const manualTitle = manualSheet.querySelector<HTMLElement>('#manual-title')!;
  const manualContent =
    manualSheet.querySelector<HTMLElement>('#manual-content')!;
  showManual = (index) => {
    manualTitle.textContent = manualPages[index].title;
    manualContent.textContent = manualPages[index].content;
    manualSheet.hidden = false;
  };
  manualSheet.querySelector('button')!.addEventListener('click', () => {
    audio.play('paper');
    manualSheet.hidden = true;
    openDrawer = -1;
    drawers.forEach((drawer) => (drawer.position.z = 0));
  });
  const status = overlay.querySelector<HTMLElement>('#rig-status')!;
  const deltaReadout = overlay.querySelector<HTMLElement>('#delta-readout')!;
  const entries = overlay.querySelector<HTMLOListElement>('#log-entries')!;
  const unitReadout = overlay.querySelector<HTMLElement>('#unit-readout')!;
  const logbook = overlay.querySelector<HTMLElement>('.logbook')!;
  const tab = overlay.querySelector<HTMLButtonElement>('#open-log')!;
  const unread = overlay.querySelector<HTMLElement>('#unread-count')!;
  const muteButton = overlay.querySelector<HTMLButtonElement>('#mute-sound')!;
  const volumeInput = overlay.querySelector<HTMLInputElement>('#sound-volume')!;
  let soundVolume = 0.55;
  let soundMuted = false;
  try {
    const stored = JSON.parse(localStorage.getItem('vx3-sound') ?? 'null') as {
      volume?: number;
      muted?: boolean;
    } | null;
    if (typeof stored?.volume === 'number' && Number.isFinite(stored.volume))
      soundVolume = Math.max(0, Math.min(1, stored.volume));
    if (typeof stored?.muted === 'boolean') soundMuted = stored.muted;
  } catch {
    /* Private browsing may deny storage. */
  }
  const refreshSoundUi = () => {
    muteButton.textContent = soundMuted ? 'SOUND OFF' : 'SOUND ON';
    muteButton.setAttribute('aria-pressed', String(soundMuted));
    volumeInput.value = String(Math.round(soundVolume * 100));
    audio.setMix(soundVolume, soundMuted);
  };
  const saveSound = () => {
    try {
      localStorage.setItem(
        'vx3-sound',
        JSON.stringify({ volume: soundVolume, muted: soundMuted }),
      );
    } catch {
      /* The current session still keeps the selected mix. */
    }
  };
  refreshSoundUi();
  muteButton.addEventListener('click', () => {
    if (!soundMuted) audio.play('button');
    soundMuted = !soundMuted;
    refreshSoundUi();
    if (!soundMuted) audio.play('button');
    saveSound();
  });
  let lastVolumeClick = 0;
  volumeInput.addEventListener('input', () => {
    soundVolume = Number(volumeInput.value) / 100;
    refreshSoundUi();
    const now = performance.now();
    if (now - lastVolumeClick > 70) {
      audio.play('knob');
      lastVolumeClick = now;
    }
    saveSound();
  });
  let interacted = false;
  const gesture = () => {
    interacted = true;
    void audio.unlock();
  };
  overlay.addEventListener('pointerdown', gesture);
  canvas.addEventListener('pointerdown', gesture);
  document.addEventListener('keydown', gesture);
  const visibility = () => audio.setVisible(!document.hidden);
  document.addEventListener('visibilitychange', visibility);
  let logOpen = true;
  let unseen = 0;
  const write = (line: string) => {
    const item = document.createElement('li');
    item.textContent = `${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}  ${line}`;
    entries.prepend(item);
    if (interacted) audio.play('pencil');
    while (entries.children.length > 25) entries.lastElementChild?.remove();
    if (!logOpen) {
      unseen++;
      unread.textContent = String(unseen);
      tab.setAttribute('aria-label', `Open logbook, ${unseen} new entries`);
    }
  };
  write('Rack opened. Historical full VX3 cold. For educational use only.');
  overlay.querySelector('#close-log')!.addEventListener('click', () => {
    audio.play('paper');
    logOpen = false;
    logbook.hidden = true;
    tab.hidden = false;
  });
  tab.addEventListener('click', () => {
    audio.play('paper');
    logOpen = true;
    logbook.hidden = false;
    tab.hidden = true;
    unseen = 0;
    unread.textContent = '';
  });
  for (const button of overlay.querySelectorAll<HTMLButtonElement>(
    '[data-view]',
  )) {
    button.addEventListener('click', () => {
      audio.play('selector');
      view = button.dataset.view === 'isometric' ? 'isometric' : 'perspective';
      if (view === 'isometric' && locked()) document.exitPointerLock();
      overlay.dataset.view = view;
      refreshHelp();
      keys.clear();
      sticks.reset();
      for (const option of overlay.querySelectorAll<HTMLButtonElement>(
        '[data-view]',
      )) {
        option.setAttribute('aria-pressed', String(option === button));
      }
    });
  }

  const halfTravel = Math.max(0, (totalHeight - 3.2) / 2);
  const eyeY = floorY + 1.8034 * worldUnitsPerMetre;
  let pan = eyeY - 0.22;
  let panX = 0;
  let cameraZoom = 1;
  let unitLabel = '';
  const zoomTo = (value: number) => {
    cameraZoom = Math.max(0.65, Math.min(1.8, value));
    isometricCamera.zoom = cameraZoom;
    isometricCamera.updateProjectionMatrix();
  };
  const panTo = (value: number) => {
    pan = Math.max(-halfTravel, Math.min(halfTravel, value));
    unitLabel = `U ${String(Math.min(rackUnits, Math.max(1, Math.floor((halfTravel - pan) / U) + 1))).padStart(2, '0')} / ${rackUnits}`;
  };
  panTo(pan);
  overlay.querySelector('[data-pan="up"]')!.addEventListener('click', () => {
    if (view === 'perspective') nudge.forward += 0.6 * worldUnitsPerMetre;
    else panTo(pan + 1.5);
  });
  overlay.querySelector('[data-pan="down"]')!.addEventListener('click', () => {
    if (view === 'perspective') nudge.forward -= 0.6 * worldUnitsPerMetre;
    else panTo(pan - 1.5);
  });
  overlay.querySelector('[data-pan="left"]')!.addEventListener('click', () => {
    if (view === 'perspective') nudge.right -= 0.6 * worldUnitsPerMetre;
    else panX = Math.max(-6.5, panX - 0.75);
  });
  overlay.querySelector('[data-pan="right"]')!.addEventListener('click', () => {
    if (view === 'perspective') nudge.right += 0.6 * worldUnitsPerMetre;
    else panX = Math.min(9.5, panX + 0.75);
  });
  overlay.querySelector('[data-zoom="in"]')!.addEventListener('click', () => {
    zoomTo(cameraZoom + 0.15);
  });
  overlay.querySelector('[data-zoom="out"]')!.addEventListener('click', () => {
    zoomTo(cameraZoom - 0.15);
  });
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
    panX = Math.max(-6.5, Math.min(9.5, panX + event.deltaX * scale * 0.005));
    if (event.altKey) panTo(pan - event.deltaY * scale * 0.004);
    else zoomTo(cameraZoom - event.deltaY * scale * 0.002);
  };
  canvas.addEventListener('wheel', wheel, { passive: false });
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let orbitYaw = 0;
  let orbitPitch = 0;

  // First-person walking, as in any PC shooter: click to capture the mouse
  // and look around, WASD or the arrow keys to walk, Shift to run, C to
  // crouch, click or E to use whatever is under the crosshair, Esc to get the
  // cursor back. Touch screens drag to look and tap to use.
  const metre = worldUnitsPerMetre;
  const walkerRadius = 0.25 * metre;
  const walker = {
    x: corridor.spawn.x,
    z: corridor.spawn.z,
    crouched: false,
    crouch: 0,
    stride: 0,
  };
  const keys = new Set<string>();
  const nudge = { forward: 0, right: 0 };
  // Development builds expose the walker so browser checks can place the
  // camera without a captured mouse.
  if (import.meta.env.DEV)
    Object.assign(window, {
      vx3Walker: {
        walker,
        look(yaw: number, pitch = 0) {
          orbitYaw = yaw;
          orbitPitch = pitch;
        },
        toolRack: () => toolRack.group.getWorldPosition(new Vector3()),
      },
    });
  let footprints: Footprint[] | null = null;
  // Everything solid between knee and head height blocks the walker. The
  // door is handled separately because it moves, and hoses and cables on
  // the floor are stepped over.
  const collectFootprints = () => {
    scene.updateMatrixWorld(true);
    const low = floorY + 0.3 * metre;
    const high = floorY + 1.7 * metre;
    const bounds = new Box3();
    const result: Footprint[] = [];
    scene.traverseVisible((object) => {
      if (!(object instanceof Mesh) || doorParts.has(object)) return;
      if (object.geometry instanceof TubeGeometry) return;
      bounds.setFromObject(object);
      if (bounds.isEmpty() || bounds.max.y < low || bounds.min.y > high) return;
      result.push({
        minX: bounds.min.x,
        maxX: bounds.max.x,
        minZ: bounds.min.z,
        maxZ: bounds.max.z,
      });
    });
    return result;
  };
  const locked = () => document.pointerLockElement === canvas;
  const help = overlay.querySelector<HTMLElement>('.rack-help')!;
  const refreshHelp = () => {
    const touch = overlay.dataset.input === 'touch';
    help.textContent =
      view === 'isometric'
        ? touch
          ? 'DRAG: ORBIT · TAP: USE · − / +: ZOOM'
          : 'WHEEL: ZOOM · ALT+WHEEL: HEIGHT · DRAG: ORBIT · CLICK: USE'
        : touch
          ? 'LEFT STICK: WALK (PUSH FULLY TO RUN) · RIGHT STICK: LOOK · TAP: USE'
          : 'CLICK: MOUSE LOOK · WASD: WALK · SHIFT: RUN · C: CROUCH · CLICK / E: USE · WHEEL: ZOOM · ESC: CURSOR';
  };
  const crosshair = overlay.querySelector<HTMLElement>('.crosshair')!;
  const target = (x = 0, y = 0) => {
    pointer.set(x, y);
    raycaster.setFromCamera(pointer, camera());
    const hit = raycaster.intersectObjects(interactive, false)[0];
    if (!hit) return undefined;
    if (doorParts.has(hit.object) && hit.distance > doorReach) return undefined;
    return hit.object;
  };
  const use = (x = 0, y = 0) => {
    const object = target(x, y);
    if (object) actions.get(object.id)?.();
  };
  const typing = (event: Event) =>
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.target instanceof HTMLSelectElement;
  const walkKeys = new Set([
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ShiftLeft',
    'ShiftRight',
  ]);
  const keydown = (event: KeyboardEvent) => {
    if (view !== 'perspective' || typing(event)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (walkKeys.has(event.code)) {
      keys.add(event.code);
      if (event.code.startsWith('Arrow')) event.preventDefault();
    }
    if (event.repeat) return;
    if (event.code === 'KeyC') walker.crouched = !walker.crouched;
    if (event.code === 'KeyE') use();
  };
  const keyup = (event: KeyboardEvent) => keys.delete(event.code);
  const forget = () => keys.clear();
  document.addEventListener('keydown', keydown);
  document.addEventListener('keyup', keyup);
  window.addEventListener('blur', forget);
  const look = (event: MouseEvent) => {
    if (!locked()) return;
    orbitYaw += event.movementX * 0.0022;
    orbitPitch = Math.max(
      -1.45,
      Math.min(1.45, orbitPitch - event.movementY * 0.0022),
    );
  };
  document.addEventListener('mousemove', look);
  const lockChange = () => {
    crosshair.hidden = !locked();
    if (!locked()) keys.clear();
  };
  document.addEventListener('pointerlockchange', lockChange);
  // Where the browser refuses to capture the mouse, dragging looks around
  // and clicking uses what is under the cursor instead.
  let lockRefused = false;
  const refuseLock = () => {
    lockRefused = true;
  };
  document.addEventListener('pointerlockerror', refuseLock);

  // Touch screens get twin thumbsticks in the first-person view: the left
  // walks, the right looks, and a tap anywhere else uses the apparatus.
  // The overlay follows whichever kind of pointer was used last, so the
  // sticks and help line appear only for touch.
  const sticks = createTouchSticks(overlay);
  const setInput = (mode: 'touch' | 'mouse') => {
    if (overlay.dataset.input === mode) return;
    overlay.dataset.input = mode;
    if (mode === 'mouse') sticks.reset();
    refreshHelp();
  };
  const notePointer = (event: PointerEvent) => {
    if (event.pointerType === 'touch') setInput('touch');
    else if (event.pointerType === 'mouse') setInput('mouse');
  };
  window.addEventListener('pointerdown', notePointer, true);
  setInput(window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse');
  overlay.dataset.view = view;

  let drag: {
    x: number;
    y: number;
    yaw: number;
    pitch: number;
    moved: boolean;
    /** False for a touch in first person, which only ever taps. */
    look: boolean;
  } | null = null;
  const down = (event: PointerEvent) => {
    if (
      view === 'perspective' &&
      event.pointerType === 'mouse' &&
      !lockRefused
    ) {
      if (event.button !== 0) return;
      if (locked()) use();
      else void Promise.resolve(canvas.requestPointerLock()).catch(refuseLock);
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    drag = {
      x: event.clientX,
      y: event.clientY,
      yaw: orbitYaw,
      pitch: orbitPitch,
      moved: false,
      look: !(view === 'perspective' && event.pointerType === 'touch'),
    };
  };
  const move = (event: PointerEvent) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const slop = event.pointerType === 'touch' ? 12 : 5;
    if (Math.abs(dx) > slop || Math.abs(dy) > slop) drag.moved = true;
    if (drag.moved && drag.look) {
      // Drag the view: turn all the way round, look up to the ceiling or
      // down toward the floor.
      orbitYaw = drag.yaw - dx * 0.004;
      orbitPitch = Math.max(-1.2, Math.min(1.2, drag.pitch + dy * 0.003));
    }
  };
  const up = (event: PointerEvent) => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (moved) return;
    const rect = canvas.getBoundingClientRect();
    use(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);

  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const scale = Math.min(640 / width, 480 / height, 1);
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    renderer.setSize(w, h, false);
    ps1Uniforms.resolution.value.set(w, h);
    perspectiveCamera.aspect = width / height;
    perspectiveCamera.updateProjectionMatrix();
    isometricCamera.left = -6.5 * (width / height);
    isometricCamera.right = 6.5 * (width / height);
    isometricCamera.top = 6.5;
    isometricCamera.bottom = -6.5;
    isometricCamera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let last = 0;
  renderer.setAnimationLoop((time) => {
    const delta = last ? Math.min(0.1, (time - last) / 1000) : 0;
    last = time;
    for (const event of stepRig(rig, delta)) {
      if (event.kind === 'warmed') {
        audio.play('relay');
        write('Heaters at temperature. The cabinet smells like dust.');
      }
      if (event.kind === 'field-locked') {
        audio.play('field-locked');
        write('H-B field locked. Lovely hum.');
      }
      if (event.kind === 'warning') {
        audio.play('warning');
        write('H-B field wandering. Strain rising.');
      }
      if (event.kind === 'incident') {
        audio.play('incident');
        window.setTimeout(() => audio.play('breaker-off'), 180);
        write(event.text);
      }
    }
    stepSafetyTelltales(telltales, rig, settings, delta);
    audio.update(rig, settings, reducedMotion.matches);
    if (!reducedMotion.matches) carousel.rotation.z -= rig.spindle * delta * 4;
    status.textContent = !rig.controls.mains
      ? 'RIG COLD'
      : rig.instability > 0.55
        ? 'FIELD UNSTABLE'
        : rig.field > 0.2 && rig.instability < 0.1
          ? 'FIELD LOCKED'
          : rig.field > 0.1
            ? 'FIELD WANDERING'
            : 'HEATERS / NO FIELD';
    status.dataset.alert = rig.instability > 0.55 ? 'true' : 'false';
    deltaReadout.textContent = `δ ${deltaScore(rig).toFixed(3)} / 0.880`;
    for (const update of dynamic) update();
    if (view === 'perspective') {
      footprints ??= collectFootprints();
      const held = (...codes: string[]) => codes.some((code) => keys.has(code));
      // Keys give a full step; the left stick walks at its deflection and
      // runs when pushed to the rim.
      const ahead =
        (held('KeyW', 'ArrowUp') ? 1 : 0) -
        (held('KeyS', 'ArrowDown') ? 1 : 0) -
        sticks.move.y;
      const aside =
        (held('KeyD', 'ArrowRight') ? 1 : 0) -
        (held('KeyA', 'ArrowLeft') ? 1 : 0) +
        sticks.move.x;
      const push = Math.hypot(sticks.move.x, sticks.move.y);
      const length = Math.max(1, Math.hypot(ahead, aside));
      const speed =
        (held('ShiftLeft', 'ShiftRight') || push > 0.92 ? 4.2 : 2) *
        metre *
        (walker.crouched ? 0.5 : 1) *
        delta;
      // The right stick turns faster the further it is pushed.
      orbitYaw += sticks.look.x * Math.abs(sticks.look.x) * 2.4 * delta;
      orbitPitch = Math.max(
        -1.45,
        Math.min(
          1.45,
          orbitPitch - sticks.look.y * Math.abs(sticks.look.y) * 1.8 * delta,
        ),
      );
      const forward = (ahead / length) * speed + nudge.forward;
      const right = (aside / length) * speed + nudge.right;
      nudge.forward = 0;
      nudge.right = 0;
      const solid = labRoom.door.blocking
        ? [...footprints, labRoom.door.footprint]
        : footprints;
      const next = slide(
        solid,
        walker.x,
        walker.z,
        Math.sin(orbitYaw) * forward + Math.cos(orbitYaw) * right,
        -Math.cos(orbitYaw) * forward + Math.sin(orbitYaw) * right,
        walkerRadius,
      );
      walker.stride += Math.hypot(next.x - walker.x, next.z - walker.z);
      walker.x = next.x;
      walker.z = next.z;
      walker.crouch +=
        ((walker.crouched ? 1 : 0) - walker.crouch) * Math.min(1, delta * 10);
      const bob = reducedMotion.matches
        ? 0
        : Math.sin((walker.stride / metre) * Math.PI * 1.6) * 0.02 * metre;
      const eye = new Vector3(
        walker.x,
        eyeY - walker.crouch * 0.65 * metre + bob,
        walker.z,
      );
      perspectiveCamera.position.copy(eye);
      perspectiveCamera.lookAt(
        eye.x + Math.sin(orbitYaw) * Math.cos(orbitPitch),
        eye.y + Math.sin(orbitPitch),
        eye.z - Math.cos(orbitYaw) * Math.cos(orbitPitch),
      );
      const fov = 52 / cameraZoom;
      if (perspectiveCamera.fov !== fov) {
        perspectiveCamera.fov = fov;
        perspectiveCamera.updateProjectionMatrix();
      }
      if (locked()) crosshair.dataset.hot = String(Boolean(target()));
      unitReadout.textContent =
        walker.z > room.maxZ ? 'CORRIDOR · EBENE −2' : 'VX3 LAB · RAUM −2.17';
    } else unitReadout.textContent = unitLabel;
    scene.fog = view === 'perspective' ? basementFog : null;
    scene.background = view === 'perspective' ? basementFog.color : roomTone;
    // The isometric view keeps its bounded orbit outside the action.
    const isoYaw = Math.max(-1.15, Math.min(1.15, orbitYaw));
    const isoPitch = Math.max(-0.35, Math.min(0.65, orbitPitch));
    isometricCamera.position.set(
      panX + Math.sin(0.63 + isoYaw) * 9.3,
      Math.max(
        floorY + 0.6,
        Math.min(room.ceilingY - 0.6, pan + 3.5 + Math.sin(isoPitch) * 9.3),
      ),
      Math.cos(0.63 + isoYaw) * 9.3,
    );
    isometricCamera.lookAt(panX, pan, 0);
    labRoom.roof.visible = view === 'perspective';
    ps1Uniforms.snapPixels.value = reducedMotion.matches ? 0 : 1;
    renderer.render(scene, camera());
  });
  return () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    canvas.removeEventListener('wheel', wheel);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointerdown', gesture);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    document.removeEventListener('keydown', keydown);
    document.removeEventListener('keyup', keyup);
    window.removeEventListener('blur', forget);
    window.removeEventListener('pointerdown', notePointer, true);
    sticks.dispose();
    document.removeEventListener('mousemove', look);
    document.removeEventListener('pointerlockchange', lockChange);
    document.removeEventListener('pointerlockerror', refuseLock);
    if (locked()) document.exitPointerLock();
    document.removeEventListener('keydown', gesture);
    document.removeEventListener('visibilitychange', visibility);
    audio.dispose();
    ashtray.dispose();
    xenon.dispose();
    hotline.dispose();
    labRoom.dispose();
    corridor.dispose();
    toolRack.dispose();
    workbench.dispose();
    teleprinter.dispose();
    overlay.remove();
    scene.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    for (const item of materials) item.dispose();
    for (const item of textures) item.dispose();
    renderer.dispose();
  };
}
