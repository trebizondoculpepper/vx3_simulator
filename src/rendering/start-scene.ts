import { createMachineActionLog } from '../game/machine-action-log';
import { DEV_DOOR_WIDTH, DEV_DOOR_HEIGHT } from '../game/dev-room-links';
import { createDevDoorways } from '../scene/dev-doorways';
import { MAX_ZOOM, MIN_ZOOM, wheelZoom } from './first-person';
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  DirectionalLight,
  Fog,
  Group,
  MeshBasicMaterial,
  Mesh,
  NearestFilter,
  OctahedronGeometry,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Raycaster,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type {
  Intersection,
  Material,
  MeshStandardMaterial,
  Object3D,
  Texture,
} from 'three';
import { createSoundEngine } from '../audio/sound-engine';
import type { SoundCue, SoundSource } from '../audio/sound-engine';
import type { Emitter } from '../audio/spatial-mix';
import { roomAt, transmission } from '../game/sound-rooms';
import {
  auditParts,
  designate,
  designationOf,
  fixtureOf,
  markFixture,
  partInventory,
} from '../game/machine-parts';
import { PANEL_WIDTH } from '../game/rack-layout';
import {
  applyRack,
  createRackControls,
  toggleLine,
} from '../game/rack-controls';
import type { ToggleId } from '../game/rack-controls';
import { createRig, stepRig } from '../game/rig';
import { redlineFraction } from '../game/redlines';
import { createOverheatState, stepOverheat } from '../game/overheat';
import {
  createFireIncident,
  pressFireCall,
  resetFirePanel,
  stepFireIncident,
} from '../game/fire-incident';
import {
  acknowledge,
  boardHandles,
  boardReadings,
  boardView,
  createBoard,
  latchFault,
  pressHandle,
  startLampTest,
  stepBoard,
} from '../game/control-board';
import {
  createSafetyTelltales,
  stepTelltaleOutputs,
} from '../game/safety-telltales';
import { createCanvasTexture, createLabelTexture } from '../scene/screens';
import { createWorldMapTexture } from '../scene/world-map';
import { createCubMonitor } from '../scene/cub-monitor';
import { createOfficeChair } from '../scene/office-chair';
import { createFerrocoreColumnRig } from '../scene/ferrocore-column-rig';
import {
  AMBIENT,
  MAXIMUM,
  acknowledge as acknowledgeColumn,
  isSealed,
} from '../game/column-prep';
import {
  feedFromLine,
  gen2Activity,
  gen2PowerKw,
  gen2Powered,
} from '../game/gen2-wiring';
import { createBbcMicro } from '../scene/bbc-micro';
import { createBbcDiskDrive } from '../scene/bbc-disk-drive';
import { createBbcUserGuide } from '../scene/bbc-user-guide';
import { createAshtray } from '../scene/ashtray';
import { createSmokeEmitter } from '../scene/smoke-emitter';
import { createSprinklerSpray } from '../scene/sprinkler-spray';
import { createXenonCylinders } from '../scene/xenon-cylinders';
import { createXenonRecirculator } from '../scene/xenon-recirculator';
import { createCheatBoard, createTestingBoard } from '../scene/cheat-board';
import { visibleRooms } from '../game/room-visibility';
import { tripClues } from '../game/trip-report';
import { createHotlinePhone } from '../scene/hotline-phone';
import { createLabRoom } from '../scene/lab-room';
import { createCorridor } from '../scene/corridor';
import { createPlantRoom } from '../scene/plant-room';
import { createMercuryRectifier } from '../scene/mercury-rectifier';
import {
  GEN1_RACK_Z,
  GEN1_SIDE_CABINET,
  GEN1_TOTAL_HEIGHT,
} from '../scene/gen1-vx3';
import { knobDirection } from '../scene/rotary-knob';
import {
  XENON_HAZARD_STRAIN_PER_SECOND,
  xenonHazard,
  xenonReady,
} from '../game/xenon-supply';
import { benchScreen, createBenchComputer } from '../game/bench-monitor';
import { anomalyEffects, anomalyStage } from '../game/ferrocore-anomaly';
import { createCrystalSparkles } from '../scene/crystal-sparkles';
import { createToolRack } from '../scene/tool-rack';
import { createWestWorkbench } from '../scene/west-workbench';
import {
  benchContraptionLayout,
  contraptionNames,
  contraptionNotes,
  createBenchContraptions,
} from '../scene/bench-contraptions';
import { createEastControlPanel } from '../scene/east-control-panel';
import { createTouchSticks } from '../ui/touch-sticks';
import { slide } from '../game/walk-collision';
import type { Footprint } from '../game/walk-collision';
import { createTeleprinter } from '../scene/teleprinter';
import { createPs1Material, dimPrintedWith, ps1Uniforms } from './ps1-material';

// The 19-inch panel sets the world's scale.
const panelWidth = PANEL_WIDTH;
const worldUnitsPerMetre = panelWidth / 0.4826;

export function startScene(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: false });
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(1);
  const perspectiveCamera = new PerspectiveCamera(52, 1, 0.1, 150);
  const scene = new Scene();
  // Two floors underground the corridor fades into darkness either way.
  const basementFog = new Fog('#0d0c0a', 55, 148);
  scene.background = basementFog.color;
  scene.fog = basementFog;
  // The fill lights stand in for the lab's fluorescent tubes and follow
  // the light switch.
  const fill = new AmbientLight('#fff0d7', 1.5);
  scene.add(fill);
  const lamp = new DirectionalLight('#ffe4ad', 2.1);
  lamp.position.set(-3, 5, 7);
  scene.add(lamp);
  const rim = new DirectionalLight('#829a98', 0.7);
  rim.position.set(3, -1, 2);
  scene.add(rim);

  const materials: Material[] = [];
  const textures: Texture[] = [];
  const interactive: Object3D[] = [];
  const actions = new Map<number, (hit: Intersection) => void>();
  const dynamic: Array<() => void> = [];
  const rig = createRig();
  // The room's state near the ferrocores: colour, π, space and sparks.
  let anomaly = anomalyEffects(0, 0, false);
  let anomalyLevel = 0;
  const telltales = createSafetyTelltales();
  const overheat = createOverheatState();
  const fire = createFireIncident();
  const settings = createRackControls();
  const audio = createSoundEngine();
  // The room was built round the first VX3's rack, which has since gone to
  // the developers' museum (src/scene/gen1-vx3.ts); its height is still
  // the lab's datum.
  const totalHeight = GEN1_TOTAL_HEIGHT;
  const material = (color: string, unlit = false, glow = false) => {
    const result = createPs1Material({ color }, unlit, glow);
    materials.push(result);
    return result;
  };
  // Indicator lamps glow in their own colour: bright when lit, all but
  // black when not, so they read in the dark.
  const lamps: MeshStandardMaterial[] = [];
  const glows = <T extends Mesh>(mesh: T) => {
    lamps.push(mesh.material as MeshStandardMaterial);
    return mesh;
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
    return mesh;
  };
  const machineActions = createMachineActionLog(
    () =>
      JSON.stringify({
        column: gen2.prep,
        columnPower: gen2.running,
        rack: settings,
        plantPower: plantRoom.powered,
        xenonValve: xenon.setting,
        recirculator: recirculator.enabled,
        alarms: board.alarms,
        fire,
      }),
    (line) => teleprinter.record(line),
    (label) => write(`${label} operated.`),
  );
  const bind = (object: Object3D, action: (hit: Intersection) => void) => {
    interactive.push(object);
    actions.set(object.id, (hit) => {
      const part = object.userData.machinePart as
        { machine: string; name: string } | undefined;
      const label = part
        ? `${part.machine}: ${part.name}`
        : String(object.userData.fixture ?? 'Machine control');
      machineActions.run(label, () => action(hit));
    });
  };
  // Everything fitted to a machine is an input (worked by the operator) or
  // an indicator (driven by the machine); see src/game/machine-parts.ts.
  // Clickable things that belong to the room are fixtures.
  const input = (
    object: Object3D,
    machine: string,
    name: string,
    action: (hit: Intersection) => void,
  ) => {
    designate(object, { machine, name, role: 'input' });
    bind(object, (hit) => {
      if (!fire.ruinCause) action(hit);
    });
  };
  const indicator = <T extends Object3D>(
    object: T,
    machine: string,
    name: string,
  ) => {
    designate(object, { machine, name, role: 'indicator' });
    return object;
  };
  const fixture = (object: Object3D, name: string, action: () => void) => {
    markFixture(object, name);
    bind(object, () => {
      if (
        !fire.ruinCause ||
        name.includes('door') ||
        name === 'Xenon cage gate'
      )
        action();
    });
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
  const wallThickness = 0.3 * worldUnitsPerMetre;
  // Doors take the corridor's light only while the viewer is out there.
  const inCorridor = () => walker.z > room.maxZ + wallThickness;
  // The scene's fill lights stand in for whichever room the viewer is in:
  // the plant room's tubes in there, the lab's everywhere else. Rooms out
  // of sight are not drawn, so only one room's lighting is ever on show.
  const fillLevel = () =>
    roomAt(roomPlan, walker.x, walker.z) === 'plant'
      ? plantRoom.lightLevel
      : labRoom.lights.level;
  /** Room light for the signs on the plant-room door, set each frame. */
  const plantDoorLight = { value: 1 };
  const backWallHeight = room.ceilingY - floorY;
  cube(
    lab,
    room.maxX - room.minX,
    backWallHeight,
    wallThickness,
    '#626f68',
    0,
    floorY + backWallHeight / 2,
    room.minZ - wallThickness / 2,
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
    labRoom.update(
      performance.now() / 1000,
      reducedMotion.matches,
      inCorridor(),
    ),
  );
  // Outside the door: the long basement corridor of the Helmholtz-Bau.
  const plantRoom = createPlantRoom({
    floorY,
    worldUnitsPerMetre,
    minX: room.minX - 4.5 * worldUnitsPerMetre - wallThickness,
    maxX: room.minX - wallThickness,
    minZ: room.minZ,
    maxZ: room.maxZ,
  });
  scene.add(plantRoom.group);
  const rectifier = createMercuryRectifier(worldUnitsPerMetre);
  rectifier.group.position.set(
    plantRoom.rectifierPosition.x,
    floorY,
    plantRoom.rectifierPosition.z,
  );
  rectifier.group.rotation.y = -Math.PI / 2;
  scene.add(rectifier.group);
  const recirculator = createXenonRecirculator(worldUnitsPerMetre);
  recirculator.group.position.set(
    plantRoom.bounds.minX + 3.0 * worldUnitsPerMetre,
    floorY,
    plantRoom.bounds.minZ + 0.4 * worldUnitsPerMetre,
  );
  scene.add(recirculator.group);
  let recirculatorLastSeconds = performance.now() / 1000;
  dynamic.push(() => {
    const seconds = performance.now() / 1000;
    recirculator.update(
      plantRoom.powered,
      Math.min(0.1, seconds - recirculatorLastSeconds),
      reducedMotion.matches,
    );
    recirculatorLastSeconds = seconds;
  });
  const devEntry = {
    x: labRoom.door.handle.x + 4.8 * worldUnitsPerMetre,
    z: room.maxZ + wallThickness + 2.4 * worldUnitsPerMetre,
  };
  const devPassages = createDevDoorways(
    'corridor',
    [{ to: 'dev', side: 'south', ...devEntry }],
    floorY,
    worldUnitsPerMetre,
  );
  scene.add(devPassages.group);
  const corridor = createCorridor({
    floorY,
    worldUnitsPerMetre,
    northZ: room.maxZ + wallThickness,
    labMinX: room.minX - wallThickness,
    labMaxX: room.maxX + wallThickness,
    doorX: labRoom.door.handle.x,
    doorWidth: labRoom.door.width,
    doorHeight: labRoom.door.height,
    plantDoor: plantRoom.doorway,
    devDoor: {
      x: devEntry.x,
      width: DEV_DOOR_WIDTH * worldUnitsPerMetre,
      height: DEV_DOOR_HEIGHT * worldUnitsPerMetre,
    },
  });
  scene.add(corridor.group);
  // Independent fire circuit: a lab call point and a reset on the corridor side.
  const firePaint = (color: string, level: number) => {
    const finish = createPs1Material({ color }, true);
    finish.userData.ps1Room = { value: level };
    materials.push(finish);
    return finish;
  };
  const fireBox = (
    parent: Group,
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
    level: number,
  ) => {
    const part = new Mesh(new BoxGeometry(w, h, d), firePaint(color, level));
    part.position.set(x, y, z);
    parent.add(part);
    return part;
  };
  const firePoint = new Group();
  firePoint.position.set(
    labRoom.door.handle.x - labRoom.door.width / 2 - 1.05 * worldUnitsPerMetre,
    floorY + 1.35 * worldUnitsPerMetre,
    room.maxZ - 0.18,
  );
  firePoint.rotation.y = Math.PI;
  firePoint.scale.setScalar(worldUnitsPerMetre);
  lab.add(firePoint);
  fireBox(firePoint, 0.24, 0.32, 0.09, '#9e1e1b', 0, 0, 0, 0.65);
  const callArt = createCanvasTexture(256, 320);
  textures.push(callArt.texture);
  const callInk = callArt.context;
  callInk.fillStyle = '#ed3034';
  callInk.fillRect(0, 0, 256, 320);
  callInk.fillStyle = '#f5e8e3';
  callInk.beginPath();
  callInk.arc(20, 18, 7, 0, Math.PI * 2);
  callInk.arc(236, 18, 7, 0, Math.PI * 2);
  callInk.fill();
  callInk.textAlign = 'center';
  callInk.fillStyle = '#fff8f4';
  callInk.font = 'bold 53px Arial, sans-serif';
  callInk.fillText('FEUER', 128, 76);
  callInk.fillStyle = '#bc2628';
  callInk.fillRect(23, 100, 210, 185);
  callInk.fillStyle = '#f6efea';
  callInk.fillRect(30, 107, 196, 171);
  callInk.fillStyle = '#253130';
  callInk.font = 'bold 22px Arial, sans-serif';
  callInk.fillText('SCHEIBE', 128, 145);
  callInk.fillText('EINSCHLAGEN', 128, 172);
  callInk.font = 'bold 39px Arial, sans-serif';
  callInk.fillText('➜  ●  ⬅', 128, 223);
  callInk.font = 'bold 21px Arial, sans-serif';
  callInk.fillText('HIER DRÜCKEN', 128, 259);
  callArt.texture.needsUpdate = true;
  const callFaceMaterial = createPs1Material({ map: callArt.texture }, true);
  callFaceMaterial.userData.ps1Room = { value: 0.85 };
  materials.push(callFaceMaterial);
  const callFace = new Mesh(new PlaneGeometry(0.225, 0.305), callFaceMaterial);
  callFace.position.z = 0.048;
  firePoint.add(callFace);
  input(callFace, 'Fire circuit', 'Handfeuermelder', () => {
    audio.play('fire-call');
    if (pressFireCall(fire)) {
      latchFault(board);
      audio.play('warning');
      write('FEUERALARM: Handmelder betätigt. Räumung einleiten.');
    }
  });

  const firePanel = new Group();
  firePanel.position.set(
    labRoom.door.handle.x - labRoom.door.width / 2 - 0.4 * worldUnitsPerMetre,
    floorY + 1.35 * worldUnitsPerMetre,
    room.maxZ + wallThickness + 0.18,
  );
  firePanel.scale.setScalar(0.7 * worldUnitsPerMetre);
  scene.add(firePanel);
  // Red steel enclosure with a pale inset, recessed annunciator and small
  // green display, in the style of the owner's RP-2002 reference photograph.
  fireBox(firePanel, 0.7, 0.72, 0.14, '#61201d', 0.025, 0, -0.055, 0.72);
  fireBox(firePanel, 0.68, 0.7, 0.04, '#ae3029', 0, 0, 0.03, 0.72);
  fireBox(firePanel, 0.52, 0.34, 0.018, '#d8d8d0', 0, 0.045, 0.062, 0.8);
  fireBox(firePanel, 0.31, 0.29, 0.023, '#191d1b', 0, 0.045, 0.079, 0.75);
  fireBox(firePanel, 0.235, 0.2, 0.01, '#3b403c', 0, 0.04, 0.095, 0.72);
  const fireScreen = fireBox(
    firePanel,
    0.14,
    0.055,
    0.007,
    '#65a76b',
    0,
    0.095,
    0.103,
    0.9,
  );
  for (const x of [-0.055, 0, 0.055])
    fireBox(firePanel, 0.035, 0.013, 0.006, '#b5b6a9', x, -0.025, 0.105, 0.85);
  const panelTitle = label(
    firePanel,
    'BRANDMELDERZENTRALE',
    0,
    0.29,
    0.058,
    7,
    '#f0d6c3',
    '#ae3029',
  );
  panelTitle.scale.setScalar(0.34);
  panelTitle.material.userData.ps1Room = { value: 0.8 };
  const panelBrand = label(
    firePanel,
    'SYNCLEX · BZ-3',
    0,
    -0.09,
    0.073,
    7,
    '#272c28',
    '#d8d8d0',
  );
  panelBrand.scale.setScalar(0.25);
  panelBrand.material.userData.ps1Room = { value: 0.8 };
  const panelReset = fireBox(
    firePanel,
    0.1,
    0.07,
    0.025,
    '#242723',
    0,
    -0.24,
    0.068,
    0.72,
  );
  const resetLabel = label(
    firePanel,
    'RÜCKSTELLEN',
    0,
    -0.32,
    0.059,
    7,
    '#f3e6d7',
    '#ae3029',
  );
  resetLabel.scale.setScalar(0.29);
  resetLabel.material.userData.ps1Room = { value: 0.72 };
  input(panelReset, 'Fire circuit', 'RÜCKSTELLEN', () => {
    audio.play('button');
    write(
      resetFirePanel(fire, overheat.roomSmoke)
        ? 'Brandmelderzentrale: zurückgestellt. Sprinkler geschlossen.'
        : 'Brandmelderzentrale: Rückstellung verweigert; Brand oder Rauch vorhanden.',
    );
  });
  const labBeacon = new PointLight('#ee3020', 0, 12, 2);
  labBeacon.position.set(0, room.ceilingY - 0.65, room.maxZ - 1.1);
  lab.add(labBeacon);
  const hallBeacon = new PointLight('#ee3020', 0, 12, 2);
  hallBeacon.position.set(
    firePanel.position.x,
    firePanel.position.y + 0.5,
    firePanel.position.z,
  );
  scene.add(hallBeacon);
  const puddleMaterial = new MeshBasicMaterial({
    color: '#5e97a3',
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  materials.push(puddleMaterial);
  scene.updateMatrixWorld(true);
  const sprinklerEffects = labRoom.sprinklerHeads.map((head, index) => {
    const origin = head.getWorldPosition(new Vector3());
    const spray = createSprinklerSpray(
      worldUnitsPerMetre,
      origin.y - floorY - 0.03 * worldUnitsPerMetre,
      index,
    );
    head.add(spray.group);
    const puddle = new Mesh(
      new CircleGeometry(0.72 * worldUnitsPerMetre, 12),
      puddleMaterial,
    );
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(origin.x, floorY + 0.025, origin.z);
    puddle.scale.setScalar(0.001);
    puddle.userData.noCollision = true;
    lab.add(puddle);
    return { spray, puddle };
  });
  dynamic.push(() =>
    corridor.update(
      performance.now() / 1000,
      reducedMotion.matches,
      1 - fillLevel(),
    ),
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
    for (const part of item.parts)
      fixture(part, 'Tool board', () => write(item.note));
  // A long workbench along the west wall, with the sink in the south-west
  // corner. It starts clear of the xenon bank.
  const workbench = createWestWorkbench({
    floorY,
    worldUnitsPerMetre,
    wallX: room.minX,
    fromZ: room.minZ + 1.4 * worldUnitsPerMetre,
    toZ: room.maxZ,
  });
  lab.add(workbench.group);
  // Three baffling machines on the clear stretch of worktop between the
  // vice at the north end and the cassette player near the sink, each
  // plugged into the socket trunking behind it.
  const contraptions = createBenchContraptions(
    worldUnitsPerMetre,
    benchContraptionLayout,
  );
  contraptions.group.position.set(
    room.minX,
    floorY + 0.9 * worldUnitsPerMetre,
    room.minZ + 1.4 * worldUnitsPerMetre,
  );
  lab.add(contraptions.group);
  dynamic.push(() =>
    contraptions.update(performance.now() / 1000, reducedMotion.matches),
  );
  const contraptionVisits = [0, 0, 0];
  for (const [i, parts] of contraptions.parts.entries())
    for (const part of parts)
      fixture(part, 'Bench apparatus', () => {
        const on = contraptions.toggle(i);
        audio.play(on ? 'toggle-up' : 'toggle-down');
        const notes = contraptionNotes[i];
        write(
          on
            ? notes[contraptionVisits[i]++ % notes.length]
            : `Switched the ${contraptionNames[i]} off. It took a moment to agree.`,
        );
      });
  const eastControlPanel = createEastControlPanel(worldUnitsPerMetre);
  eastControlPanel.group.position.set(
    room.maxX - 0.025 * worldUnitsPerMetre,
    floorY,
    room.minZ + 2.65 * worldUnitsPerMetre,
  );
  eastControlPanel.group.rotation.y = -Math.PI / 2;
  lab.add(eastControlPanel.group);

  // The second-generation VX3, the ferrocore column, stands in the bay the
  // first rig left, its back to the north wall, beside the computer desk.
  // It is built in metres. Its supply comes through the plant room's
  // master and the east board's NETZ contactor, its xenon from the plant
  // room's cylinder bank (see src/game/gen2-wiring.ts).
  const gen2 = createFerrocoreColumnRig({ log: (text) => write(text) });
  gen2.group.scale.setScalar(worldUnitsPerMetre);
  gen2.group.position.set(4.6, floorY, room.minZ + 0.52 * worldUnitsPerMetre);
  lab.add(gen2.group);
  let gen2On = false;
  // The column's supply isolator is not on the machine here but on the west
  // wall, at shoulder height between the Volt Xoccula advertisement and the
  // computer desk, in PVC trunking: one run up to the ceiling for the
  // incoming supply, one along the wall, down the corner and along the
  // north skirting to the column's grey cabinet.
  {
    const M = worldUnitsPerMetre;
    const wallX = room.minX;
    const isolatorY = floorY + 1.45 * M;
    const isolatorZ = room.minZ + 1.2 * M;
    gen2.isolator.plate.removeFromParent();
    const mount = new Group();
    mount.position.set(wallX, isolatorY, isolatorZ);
    mount.rotation.y = Math.PI / 2;
    mount.scale.setScalar(M);
    lab.add(mount);
    cube(mount, 0.16, 0.22, 0.012, '#8f9483', 0, 0, 0.006);
    gen2.isolator.switch.position.set(0, 0, 0.012);
    gen2.isolator.switch.rotation.set(0, 0, 0);
    mount.add(gen2.isolator.switch);
    const trunking = '#cfcfc4';
    /** A straight run of trunking between two points, 60 by 40 mm. */
    const run = (
      from: [number, number, number],
      to: [number, number, number],
    ) => {
      const [x0, y0, z0] = from;
      const [x1, y1, z1] = to;
      cube(
        lab,
        Math.max(0.06 * M, Math.abs(x1 - x0)),
        Math.max(0.06 * M, Math.abs(y1 - y0)),
        Math.max(0.06 * M, Math.abs(z1 - z0)),
        trunking,
        (x0 + x1) / 2,
        (y0 + y1) / 2,
        (z0 + z1) / 2,
      );
    };
    const onWall = wallX + 0.03 * M;
    const top = isolatorY + 0.11 * M;
    run([onWall, top, isolatorZ], [onWall, room.ceilingY, isolatorZ]);
    // Out of the isolator's north side, along the wall to the corner.
    const corner = room.minZ + 0.1 * M;
    run([onWall, isolatorY, isolatorZ - 0.08 * M], [onWall, isolatorY, corner]);
    const skirting = floorY + 0.12 * M;
    run([onWall, isolatorY, corner], [onWall, skirting, corner]);
    // Along the north skirting, behind the desk, to the grey cabinet.
    const north = room.minZ + 0.03 * M;
    const cabinetX = gen2.group.position.x - 0.66 * M;
    run([onWall, skirting, north], [cabinetX, skirting, north]);
    run([onWall, skirting, corner], [onWall, skirting, north]);
    // Up the wall behind the cabinet, and a gland into its back.
    const gland = floorY + 0.5 * M;
    run([cabinetX, skirting, north], [cabinetX, gland, north]);
    run([cabinetX, gland, north], [cabinetX, gland, room.minZ + 0.16 * M]);
  }
  // The lab's own sound cues for each kind of control on the column.
  const gen2Cue = (object: Object3D): SoundCue => {
    for (let o: Object3D | null = object; o; o = o.parent) {
      const kind = o.userData.sound as string | undefined;
      if (kind === 'knob' || kind === 'handwheel') return 'knob';
      if (kind === 'selector') return 'selector';
      if (kind === 'isolator') return 'breaker-on';
      if (kind === 'toggle' || kind === 'rocker' || kind === 'slide')
        return 'toggle-up';
      if (kind) return 'button';
    }
    return 'button';
  };
  // The lab's pointer tests meshes, not groups, so every mesh of each
  // control is registered with the control's action.
  for (const control of gen2.clickables)
    control.object.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      input(part, 'VX3 gen2', control.name, (hit) => {
        control.use(
          knobDirection(control.object, hit.point, perspectiveCamera),
        );
        audio.play(gen2Cue(hit.object));
      });
    });

  // Switch actions shared by the rack and the east board, which works the
  // rack remotely. Lines from the board are signed so the log says where.
  const flipToggle = (id: ToggleId, from = '') => {
    settings.toggles[id] = !settings.toggles[id];
    applyRack(settings, rig.controls);
    audio.play(settings.toggles[id] ? 'toggle-up' : 'toggle-down');
    write(from + toggleLine(id, settings.toggles[id]));
  };
  // NETZ is the contactor feeding the column; it only closes with the
  // plant room's master supply on.
  const flipMains = (from = '') => {
    settings.mains = !settings.mains;
    if (!settings.mains) {
      audio.play('breaker-off');
      write(`${from}Column supply off.`);
      return;
    }
    if (!plantRoom.powered) {
      // The lever springs back open, so it never shows a start that failed.
      settings.mains = false;
      audio.play('warning');
      write(
        `${from}Start refused: plant-room master supply is off. Close HAUPTSCHALTER beside the rectifier.`,
      );
      return;
    }
    audio.play('breaker-on');
    window.setTimeout(() => audio.play('relay'), 110);
    write(
      `${from}Column supply on.${gen2.running ? '' : ' The column itself is switched off at its own NETZ or isolator.'}`,
    );
  };
  // RÜCKS. changes a failed core for a fresh one and tops up the buffer;
  // SPÜLEN opens or shuts the column's outlet to the pump.
  const resetRig = (from = '') => {
    acknowledgeColumn(gen2.prep);
    write(`${from}RESET pressed. Fresh core fitted, buffer topped up.`);
  };
  const purge = (from = '') => {
    gen2.prep.outletOpen = !gen2.prep.outletOpen;
    audio.play('purge');
    write(
      `${from}${gen2.prep.outletOpen ? 'Outlet to the pump open. Hiss from behind the wall.' : 'Outlet to the pump shut.'}`,
    );
  };

  const board = createBoard();
  const boardInputs = {
    rig,
    controls: settings,
    telltales,
    get gen2() {
      return { prep: gen2.prep, powered: gen2On };
    },
    get xenonFlowSlpm() {
      return xenon.flowSlpm;
    },
    get plantPowered() {
      return plantRoom.powered;
    },
    get recirculatorWorking() {
      return recirculator.working;
    },
  };
  const fromBoard = 'East board: ';
  for (const [index, parts] of eastControlPanel.handles.entries()) {
    const { action, label: name } = boardHandles[index];
    for (const part of parts)
      input(part, 'East board', `${name} handle`, () => {
        if (action.kind === 'toggle') flipToggle(action.id, fromBoard);
        else if (action.kind === 'mains') flipMains(fromBoard);
        else {
          pressHandle(board, index);
          audio.play('selector');
          if (action.kind === 'emergency-stop') {
            const wasRunning = settings.mains;
            settings.mains = false;
            if (wasRunning) audio.play('breaker-off');
            write(
              `${fromBoard}NOT-AUS. Column supply off. The clock kept going.`,
            );
          } else if (action.kind === 'acknowledge') {
            write(
              acknowledge(board, boardInputs)
                ? `${fromBoard}QUITT. Alarms acknowledged.`
                : `${fromBoard}QUITT. Nothing to acknowledge.`,
            );
          } else if (action.kind === 'lamp-test') {
            startLampTest(board);
            write(`${fromBoard}Lamp test. Every bulb answers.`);
          } else if (action.kind === 'purge') purge(fromBoard);
          else if (action.kind === 'reset') resetRig(fromBoard);
          else write(`${fromBoard}${name}.`);
        }
      });
  }
  // The tap still drips, silently: the sound was too much.
  dynamic.push(() => {
    workbench.update(performance.now() / 1000, reducedMotion.matches);
  });
  for (const part of workbench.tapParts)
    fixture(part, 'Sink tap', () =>
      write(
        workbench.toggleTap()
          ? 'Sink tap on. The pipes knock twice, then think better of it.'
          : 'Sink tap off.',
      ),
    );
  for (const control of workbench.cassette.controls)
    for (const part of control.parts)
      fixture(part, `Cassette player ${control.name}`, () => {
        workbench.cassette.press(control.name);
        void audio.playCassetteButton(control.name);
        write(
          control.name === 'play'
            ? 'Kassettenspieler: Wiedergabe.'
            : control.name === 'stop'
              ? 'Kassettenspieler: Stopp.'
              : 'Kassettenspieler: Schneller Vorlauf.',
        );
      });
  // The door is used from within arm's reach, from either side.
  const doorReach = 2.8 * worldUnitsPerMetre;
  const doorParts = new Set<Object3D>(labRoom.door.parts);
  for (const [part, toggle] of devPassages.uses) {
    doorParts.add(part);
    fixture(part, 'Development wing door', () => {
      toggle();
      audio.play('toggle-up');
    });
  }
  for (const part of plantRoom.gateParts) doorParts.add(part);
  for (const part of plantRoom.entryParts) doorParts.add(part);
  const withinReach = new Set<Object3D>([
    ...labRoom.door.parts,
    ...labRoom.lights.switchParts,
  ]);
  for (const part of labRoom.lights.switchParts)
    fixture(part, 'Light switch', () => {
      if (fire.ruinCause) return;
      const on = labRoom.lights.toggle();
      audio.play(on ? 'toggle-up' : 'toggle-down');
      write(
        on ? 'Lights on. The tubes take their time about it.' : 'Lights off.',
      );
    });
  dynamic.push(() => {
    const level = fillLevel();
    fill.intensity = 1.5 * (0.02 + 0.98 * level);
    lamp.intensity = 2.1 * level;
    rim.intensity = 0.7 * level;
    ps1Uniforms.roomLight.value = 0.03 + 0.97 * labRoom.lights.level;
    ps1Uniforms.plantLight.value = 0.03 + 0.97 * plantRoom.lightLevel;
    plantDoorLight.value = inCorridor() ? 1 : ps1Uniforms.plantLight.value;
    for (const item of lamps)
      item.emissive.copy(item.color).multiply(item.color);
  });
  for (const part of labRoom.door.parts)
    fixture(part, 'Lab door', () => {
      const open = labRoom.door.toggle();
      audio.play(open ? 'relay' : 'breaker-off');
      write(open ? 'Lab door opened.' : 'Lab door closed.');
    });
  // Steel document cabinet for the operating papers.
  const fileCabinet = new Group();
  // South-east corner, clear of the process board; drawers face the aisle.
  fileCabinet.position.set(
    room.maxX - 0.33 * worldUnitsPerMetre,
    floorY + 4.57,
    room.maxZ - 0.5 * worldUnitsPerMetre,
  );
  fileCabinet.rotation.y = -Math.PI / 2;
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
    fixture(front, 'Reference drawer', () => {
      openDrawer = openDrawer === index ? -1 : index;
      drawers.forEach((item, itemIndex) => {
        item.position.z = itemIndex === openDrawer ? 0.2 : 0;
      });
      audio.play('paper');
      if (openDrawer >= 0) showManual(openDrawer);
    });
  }
  label(fileCabinet, 'VX3 REFERENCE FILES', 0, 1.36, 0.44, 10);
  // The safety notices hang on the north wall left of the computer desk,
  // as far into the corner as the west wall allows.
  const pinBoard = new Group();
  pinBoard.position.set(
    room.minX + 0.3 * worldUnitsPerMetre,
    floorY + 13.05,
    -3.55,
  );
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
    const frame = new Group();
    frame.position.set(
      room.minX + 0.035 * worldUnitsPerMetre,
      floorY + 1.47 * worldUnitsPerMetre,
      room.minZ + (1.9 + index * 0.85) * worldUnitsPerMetre,
    );
    frame.rotation.y = Math.PI / 2;
    frame.scale.setScalar(worldUnitsPerMetre);
    lab.add(frame);
    cube(frame, 0.46, 0.67, 0.012, '#4b3e31', 0, 0, 0);
    const poster = posterLoader.load(`/posters/${name}.png`);
    poster.colorSpace = SRGBColorSpace;
    poster.magFilter = NearestFilter;
    textures.push(poster);
    const printedFace = new Mesh(
      new PlaneGeometry(0.42, 0.63),
      createPs1Material({ map: poster }, true),
    );
    materials.push(printedFace.material);
    printedFace.position.z = 0.007;
    frame.add(printedFace);
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
      (-((now.getHours() % 12) + now.getMinutes() / 60) * anomaly.pi) / 6;
    minuteHand.rotation.z =
      (-(now.getMinutes() + now.getSeconds() / 60) * anomaly.pi) / 30;
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
    const light = indicator(
      glows(disc(lab, 0.038, '#f0b85b', x, y, -3.53)),
      'Flux correlation map',
      'Pin light',
    );
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
  // The red sector begins at the same 6.5 kW limit used by the heat model.
  for (let mark = 0; mark <= 9; mark++) {
    const fraction =
      redlineFraction('load') + (1 - redlineFraction('load')) * (mark / 9);
    const angle = -Math.PI * 0.75 + fraction * Math.PI * 1.5;
    disc(
      lab,
      0.018,
      '#c43a22',
      wallDisplayX - 0.69 + Math.sin(angle) * 0.41,
      meterY - 0.06 + Math.cos(angle) * 0.41,
      -3.23,
    );
  }
  label(lab, 'GRENZE 6,5 kW', wallDisplayX - 0.69, meterY - 0.68, -3.22, 7);
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
  indicator(loadNeedle, 'Wall load meter', 'Load kW needle');
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
  lab.add(indicator(registerFace, 'Wall load meter', 'kWh register'));
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

  // Prismatic tell-tale for fully operational ferrocores: dark until ready,
  // then glowing and sparkling. It is built here facing +z around its backing
  // board's centre, and hung above the teleprinter once that is placed.
  const crystalUnit = new Group();
  cube(crystalUnit, 1.82, 1.62, 0.13, '#495a55', 0, 0, 0);
  cube(crystalUnit, 1.58, 1.38, 0.028, '#263d3e', 0, 0, 0.08);
  label(crystalUnit, 'TIME DILATION', 0, 0.62, 0.115, 12);
  disc(crystalUnit, 0.48, '#657873', 0, -0.11, 0.13);
  disc(crystalUnit, 0.4, '#172f36', 0, -0.11, 0.15);
  const crystalMaterial = material('#467888');
  const crystal = new Mesh(new OctahedronGeometry(0.4, 0), crystalMaterial);
  crystal.scale.set(0.72, 1.28, 0.56);
  crystal.rotation.z = 0.24;
  crystal.position.set(0, -0.11, 0.37);
  crystalUnit.add(indicator(crystal, 'Time Dilation tell-tale', 'Crystal'));
  const sparkles = createCrystalSparkles();
  sparkles.group.position.copy(crystal.position);
  crystalUnit.add(sparkles.group);
  const crystalLamp = indicator(
    glows(disc(crystalUnit, 0.09, '#425c5c', 0.61, -0.5, 0.12)),
    'Time Dilation tell-tale',
    'Pulse lamp',
  );
  dynamic.push(() => {
    const pulse = telltales.crystalPulse;
    const glow = telltales.dilationActivity;
    crystalMaterial.color.setRGB(
      0.08 + glow * 0.4,
      0.14 + glow * 0.6,
      0.2 + glow * 0.7,
    );
    (crystalMaterial as MeshStandardMaterial).emissive.setRGB(
      glow * 0.2,
      glow * 0.65,
      glow * 0.9,
    );
    (crystalLamp.material as ReturnType<typeof material>).color.setRGB(
      0.03 + glow * 0.4 + pulse * 0.2,
      0.05 + glow * 0.5 + pulse * 0.2,
      0.06 + glow * 0.6 + pulse * 0.2,
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

  // A workbench with the BBC computer, disk drive and its user guide.
  const bench = new Group();
  bench.position.set(-7.9 - 0.3 * worldUnitsPerMetre, floorY, -0.8);
  bench.scale.set(3.7, 5.7, 4.5);
  lab.add(bench);
  cube(bench, 2.8, 0.18, 1.35, '#896e50', 0, 1.24, 0);
  cube(bench, 2.85, 0.035, 1.4, '#c3a477', 0, 1.36, 0);
  for (const x of [-1.25, 1.25]) {
    for (const z of [-0.5, 0.5])
      cube(bench, 0.13, 1.2, 0.13, '#3c453e', x, 0.61, z);
  }
  // A Microvitec Cub on the bench, kept out of the bench's stretched
  // scale so its proportions stay true.
  const cub = createCubMonitor(worldUnitsPerMetre);
  const bbc = createBbcMicro(worldUnitsPerMetre);
  bbc.group.position.set(
    bench.position.x + 0.42 * bench.scale.x,
    floorY + 1.3775 * bench.scale.y,
    0.35,
  );
  lab.add(bbc.group);
  cub.group.position.set(
    bbc.group.position.x,
    bbc.group.position.y + bbc.monitorHeight,
    bbc.group.position.z - 0.23 * worldUnitsPerMetre,
  );
  lab.add(cub.group);
  const diskDrive = createBbcDiskDrive(worldUnitsPerMetre);
  diskDrive.group.position.set(
    bbc.group.position.x - 0.31 * worldUnitsPerMetre,
    bbc.group.position.y,
    bbc.group.position.z - 0.04 * worldUnitsPerMetre,
  );
  lab.add(diskDrive.group);
  const userGuide = createBbcUserGuide(worldUnitsPerMetre);
  userGuide.group.position.set(
    diskDrive.group.position.x - 0.235 * worldUnitsPerMetre,
    diskDrive.group.position.y,
    diskDrive.group.position.z,
  );
  lab.add(userGuide.group);
  const diskCable = new Mesh(
    new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(-0.31, 0.025, -0.185),
        new Vector3(-0.31, 0.025, -0.215),
        new Vector3(-0.16, 0.025, -0.215),
        new Vector3(-0.08, 0.042, -0.174),
      ]),
      20,
      0.0035,
      6,
      false,
    ),
    material('#333830'),
  );
  diskCable.scale.setScalar(worldUnitsPerMetre);
  diskCable.position.copy(bbc.group.position);
  lab.add(diskCable);
  // An office chair pulled up to the bench. Clicking it sits the operator
  // down in it, eyes level with the Cub and looking straight at its screen.
  const chair = createOfficeChair(worldUnitsPerMetre);
  chair.group.position.set(
    bbc.group.position.x,
    floorY,
    bench.position.z + 0.7 * bench.scale.z + 0.42 * worldUnitsPerMetre,
  );
  chair.group.rotation.y = 0.12;
  lab.add(chair.group);
  const sitAtComputer = () => {
    walker.x = chair.group.position.x;
    walker.z = chair.group.position.z - 0.04 * worldUnitsPerMetre;
    // Seated, the eye is as low as a crouch puts it.
    walker.crouched = true;
    walker.lowCrouched = false;
    walker.crouch = 1;
    eyeOffset = 0;
    cameraZoom = 1;
    const eye = new Vector3(
      walker.x,
      eyeY - 0.65 * worldUnitsPerMetre,
      walker.z,
    );
    const target = cub.screen.getWorldPosition(new Vector3());
    orbitYaw = Math.atan2(target.x - eye.x, -(target.z - eye.z));
    orbitPitch = Math.atan2(
      target.y - eye.y,
      Math.hypot(target.x - eye.x, target.z - eye.z),
    );
    write('Sat down at the BBC. C to stand up.');
  };
  for (const part of chair.parts) fixture(part, 'Office chair', sitAtComputer);
  const benchComputer = createBenchComputer();
  let benchLastSeconds = performance.now() / 1000;
  let benchDescription = '';
  input(bbc.resetTarget, 'Bench computer', 'Computer restart', () => {
    benchComputer.reset();
    benchLastSeconds = performance.now() / 1000;
    cub.update(benchLastSeconds, [], false);
    void audio.playComputerBoot();
    write('BBC Micro: Neustart. Betriebsdiagnose wird geladen.');
  });
  withinReach.add(bbc.resetTarget);
  dynamic.push(() => {
    const seconds = performance.now() / 1000;
    benchComputer.step(Math.min(0.1, seconds - benchLastSeconds));
    benchLastSeconds = seconds;
    const screen = benchScreen(
      {
        rig,
        xenonFlowSlpm: xenon.flowSlpm,
        plantPowered: plantRoom.powered,
        rack: settings,
      },
      seconds % 1 < 0.67,
      benchComputer.elapsed,
    );
    cub.update(seconds, screen.lines, screen.cursor, screen.page);
    diskDrive.update(benchComputer.elapsed, reducedMotion.matches);
    const description = screen.page
      ? screen.lines
          .slice(4, 10)
          .map(([text]) => text)
          .filter(Boolean)
          .join(' ')
      : 'Startvorgang';
    if (description !== benchDescription) {
      benchDescription = description;
      canvas.setAttribute(
        'aria-label',
        `VX3 laboratory. BBC Micro: ${description}`,
      );
    }
  });

  // A small glass ashtray near the sink, forward of the cassette player.
  const ashtray = createAshtray();
  ashtray.group.position.set(
    room.minX + 0.61 * worldUnitsPerMetre,
    floorY + 0.9 * worldUnitsPerMetre,
    room.maxZ - 0.85 * worldUnitsPerMetre,
  );
  ashtray.group.scale.setScalar(0.375 * worldUnitsPerMetre);
  lab.add(ashtray.group);
  dynamic.push(() =>
    ashtray.update(performance.now() / 1000, reducedMotion.matches),
  );
  const heatSmoke = {
    spindle: createSmokeEmitter(),
    field: createSmokeEmitter(),
    load: createSmokeEmitter(),
  };
  const flames = {} as Record<
    'spindle' | 'field' | 'load',
    { flame: Mesh; light: PointLight }
  >;
  for (const [channel, x, z] of [
    ['spindle', -1.1, GEN1_RACK_Z + 0.35],
    ['field', 1.05, GEN1_RACK_Z + 0.35],
    ['load', GEN1_SIDE_CABINET.x, GEN1_SIDE_CABINET.z + 0.45],
  ] as const) {
    const plume = heatSmoke[channel];
    plume.group.position.set(x, floorY + 1.8 * worldUnitsPerMetre, z);
    plume.group.scale.setScalar(0.65 * worldUnitsPerMetre);
    scene.add(plume.group);
    const flame = new Mesh(
      new OctahedronGeometry(0.22 * worldUnitsPerMetre, 0),
      material('#ff7519', true, true),
    );
    flame.position.copy(plume.group.position);
    flame.visible = false;
    flame.userData.noCollision = true;
    scene.add(flame);
    const light = new PointLight('#ff6a17', 0, 4 * worldUnitsPerMetre, 2);
    light.position.copy(flame.position);
    scene.add(light);
    flames[channel] = { flame, light };
  }
  const discharge = new PointLight('#78d7ff', 0, 5 * worldUnitsPerMetre, 2);
  discharge.position.set(
    0,
    floorY + 1.6 * worldUnitsPerMetre,
    GEN1_RACK_Z + 0.4,
  );
  scene.add(discharge);

  // Caged plant-room xenon bank; flexible hose terminates at the wall port.
  const xenonFloor = floorY + 0.05;
  const xenon = createXenonCylinders({
    floorY,
    x: plantRoom.bank.x,
    z: plantRoom.bank.z,
    hoseVia: [
      new Vector3(
        plantRoom.port.x - 0.2 * worldUnitsPerMetre,
        xenonFloor,
        plantRoom.port.z,
      ),
    ],
    hoseEnd: new Vector3(plantRoom.port.x, plantRoom.port.y, plantRoom.port.z),
  });
  scene.add(xenon.group);
  // Signs, labels and dial faces inside the plant room follow its own
  // switch; those on the corridor side of its wall keep the corridor's.
  // Signs on the door itself follow whichever side the viewer is on.
  const entryParts = new Set<Object3D>(plantRoom.entryParts);
  dimPrintedWith(plantRoom.entryParts, plantDoorLight);
  dimPrintedWith(
    [plantRoom.group, rectifier.group, recirculator.group, xenon.group],
    ps1Uniforms.plantLight,
    (mesh) =>
      entryParts.has(mesh) ||
      new Vector3().setFromMatrixPosition(mesh.matrixWorld).z >
        plantRoom.bounds.maxZ - 0.01,
  );
  for (const part of plantRoom.entryParts) {
    withinReach.add(part);
    fixture(part, 'Plant room door', () => {
      const open = plantRoom.toggleEntry();
      audio.play('selector');
      write(open ? 'Plant-room door opening.' : 'Plant-room door closing.');
    });
  }
  for (const part of plantRoom.powerParts) {
    withinReach.add(part);
    input(part, 'Plant-room supply', 'HAUPTSCHALTER', () => {
      const on = plantRoom.togglePower();
      // The switch is beside the rectifier, so it sounds from there.
      audio.play(on ? 'breaker-on' : 'breaker-off', 'rectifier');
      write(
        on
          ? 'Plant master supply on. Mercury arc struck.'
          : 'Plant master supply off. Room lighting is independent.',
      );
    });
  }
  for (const part of plantRoom.lightSwitchParts) {
    withinReach.add(part);
    fixture(part, 'Plant-room light switch', () => {
      const on = plantRoom.toggleLights();
      audio.play(on ? 'toggle-up' : 'toggle-down');
      write(on ? 'Technikraum: Licht an.' : 'Technikraum: Licht aus.');
    });
  }
  for (const part of recirculator.switchParts) {
    withinReach.add(part);
    input(part, 'Xenon recirculator', 'KREISLAUF switch', () => {
      const enabled = recirculator.toggle();
      audio.play(enabled ? 'toggle-up' : 'toggle-down', 'rectifier');
      write(
        enabled
          ? 'Xenon return-loop cooler selected. It runs with plant supply.'
          : 'Xenon return-loop cooler stopped.',
      );
    });
  }
  for (const part of plantRoom.gateParts) {
    withinReach.add(part);
    fixture(part, 'Xenon cage gate', () => {
      const open = plantRoom.toggle();
      audio.play('selector');
      write(
        open
          ? 'Plant room: xenon cage opening. Set flow to at least 2 SLPM.'
          : 'Plant room: xenon cage closed.',
      );
    });
  }
  dynamic.push(() =>
    xenon.update(performance.now() / 1000, reducedMotion.matches),
  );
  const turnRegulator = (hit: Intersection) => {
    if (!plantRoom.open) {
      write('Open the xenon cage before operating the flow valve.');
      return;
    }
    const setting = xenon.stepRegulator(
      knobDirection(xenon.regulatorPivot, hit.point, perspectiveCamera),
    );
    audio.play('knob');
    write(
      setting === 0
        ? 'Xenon regulator wound shut.'
        : `Xenon regulator to ${(setting * 4).toFixed(1)} bar; flow settling toward ${(setting * 10).toFixed(1)} SLPM.`,
    );
  };
  for (const part of xenon.regulatorParts)
    input(part, 'Xenon supply', 'Flow regulator', turnRegulator);
  for (const part of xenon.regulatorParts) withinReach.add(part);

  // A testing aid on the corridor wall right of the door plate: buttons that
  // set the xenon flowing and the rectifier running without the walk.
  const cheats = createCheatBoard(worldUnitsPerMetre);
  cheats.group.position.set(
    labRoom.door.handle.x + labRoom.door.width / 2 + 1.15 * worldUnitsPerMetre,
    floorY + 1.4 * worldUnitsPerMetre,
    room.maxZ + wallThickness + 0.035,
  );
  lab.add(cheats.group);
  fixture(cheats.xenonButton, 'Cheat: xenon on', () => {
    plantRoom.openGate();
    if (xenon.setting < 0.5) xenon.setRegulator(0.5);
    audio.play('selector');
    write('Cheat: xenon cage open, regulator set for 5 SLPM.');
  });
  fixture(cheats.rectifierButton, 'Cheat: mercury arc rectifier on', () => {
    if (!plantRoom.powered) plantRoom.togglePower();
    audio.play('breaker-on', 'rectifier');
    write('Cheat: plant master supply on. Mercury arc struck.');
  });
  dynamic.push(() =>
    cheats.update({
      xenon: xenonReady(xenon.flowSlpm),
      rectifier: plantRoom.powered,
    }),
  );

  // Corridor side of the lab entrance, left of the door so the room's door
  // plate on the right stays clear.
  const hotline = createHotlinePhone();
  hotline.group.position.set(
    labRoom.door.handle.x - labRoom.door.width / 2 - 0.95 * worldUnitsPerMetre,
    floorY + 1.4 * worldUnitsPerMetre,
    room.maxZ + wallThickness + 0.035,
  );
  hotline.group.rotation.y = 0;
  // A roughly 18 cm wide wall telephone with a legible hazard sign.
  hotline.group.scale.setScalar(3.5);
  lab.add(hotline.group);

  const teleprinter = createTeleprinter();
  const printerY = floorY + 0.95 * worldUnitsPerMetre;
  // Keep an 80 mm gap between the printer casing and the adjacent console.
  const printerZ =
    eastControlPanel.group.position.z -
    1.125 * worldUnitsPerMetre -
    (2.34 * 2.5) / 2 -
    0.08 * worldUnitsPerMetre;
  teleprinter.group.position.set(room.maxX - 0.42, printerY, printerZ);
  teleprinter.group.scale.setScalar(2.5);
  teleprinter.group.rotation.y = -Math.PI / 2;
  teleprinter.outputPile.position.y = (floorY - printerY) / 2.5 + 0.08;
  for (const y of [printerY - 1.4, printerY + 0.9])
    cube(lab, 0.94, 0.09, 0.12, '#67736c', room.maxX - 0.38, y, printerZ);
  lab.add(teleprinter.group);
  // The time-dilation tell-tale hangs on the east wall just above the
  // teleprinter, at the size it had on the wall display, facing the room.
  {
    const scale = 1.8;
    teleprinter.group.updateMatrixWorld(true);
    const printerTop = new Box3().setFromObject(teleprinter.group).max.y;
    crystalUnit.scale.setScalar(scale);
    crystalUnit.rotation.y = -Math.PI / 2;
    crystalUnit.position.set(
      room.maxX - (0.13 / 2) * scale,
      Math.max(printerTop, printerY + 0.9) +
        0.12 * worldUnitsPerMetre +
        (1.62 / 2) * scale,
      printerZ,
    );
    lab.add(crystalUnit);
  }

  scene.traverse((object) => {
    if (object instanceof Mesh) object.receiveShadow = true;
  });
  scene.updateMatrixWorld(true);
  // Each sound comes from what makes it. The machine's sources (supply,
  // valves, spindle, field, monitors, service) are on the second-generation
  // VX3 now: its grey cabinet, the column and its olive cabinet. Many cues
  // default to them (relay, breakers, warnings, sparks, purge), so without
  // them those would be silent.
  const gen2At = (x: number, y: number, z = 0.4) => ({
    x: gen2.group.position.x + x * worldUnitsPerMetre,
    y: floorY + y * worldUnitsPerMetre,
    z: gen2.group.position.z + z * worldUnitsPerMetre,
  });
  const soundSources = [
    { id: 'supply', ...gen2At(-0.66, 0.4) },
    { id: 'valves', ...gen2At(-0.66, 1.2) },
    { id: 'spindle', ...gen2At(0, 1.0) },
    { id: 'field', ...gen2At(0, 0.7) },
    { id: 'monitor', ...gen2At(0.69, 1.5) },
    { id: 'service', ...gen2At(0.69, 0.6) },
    {
      id: 'printer',
      x: teleprinter.group.position.x,
      y: teleprinter.group.position.y,
      z: teleprinter.group.position.z,
    },
    {
      id: 'computer',
      x: bbc.group.position.x,
      y: bbc.group.position.y + 0.04 * worldUnitsPerMetre,
      z: bbc.group.position.z,
    },
    {
      id: 'cassette',
      x: workbench.cassette.group.position.x,
      y: workbench.cassette.group.position.y + 0.16 * worldUnitsPerMetre,
      z: workbench.cassette.group.position.z,
    },
    {
      id: 'sink',
      x: room.minX + 0.325 * worldUnitsPerMetre,
      y: floorY + 0.52 * worldUnitsPerMetre,
      z: room.maxZ - 0.395 * worldUnitsPerMetre,
    },
    {
      id: 'sprinkler',
      x: 0,
      y: room.ceilingY - 0.5 * worldUnitsPerMetre,
      z: (room.minZ + room.maxZ) / 2,
    },
    {
      id: 'rectifier',
      x: rectifier.group.position.x,
      y: floorY + worldUnitsPerMetre,
      z: rectifier.group.position.z,
    },
  ] satisfies Array<Emitter & { id: SoundSource }>;
  // Shut doors stop sound between the lab, the plant room and the corridor.
  const roomPlan = { lab: room, plant: plantRoom.bounds };
  // Rooms are culled whole: everything in the lab hangs under `lab`, and
  // the plant room is these four groups. The lab pieces placed straight in
  // the scene move under it, keeping their world positions.
  for (const object of [
    discharge,
    ...Object.values(heatSmoke).map((plume) => plume.group),
    ...Object.values(flames).flatMap(({ flame, light }) => [flame, light]),
  ])
    lab.attach(object);
  const plantGroups = [
    plantRoom.group,
    rectifier.group,
    recirculator.group,
    xenon.group,
  ];
  const soundRooms = soundSources.map(
    (source) => [source.id, roomAt(roomPlan, source.x, source.z)] as const,
  );
  audio.setSources(soundSources, {
    reference: 1.5 * worldUnitsPerMetre,
    cutoff: 25 * worldUnitsPerMetre,
    maxGain: 2,
    moveThreshold: 0.05 * worldUnitsPerMetre,
  });
  const ear = new Vector3();
  const facing = new Vector3();

  const overlay = document.createElement('div');
  overlay.className = 'rack-ui';
  overlay.innerHTML = `<div class="sound-controls"><button type="button" id="mute-sound" aria-pressed="false">SOUND ON</button><label for="sound-volume">VOL</label><input type="range" id="sound-volume" min="0" max="100" value="55" aria-label="Sound volume"></div><div class="rack-nav" role="group" aria-label="Movement and zoom"><button type="button" data-pan="left" aria-label="Step left">◀</button><button type="button" data-pan="up" aria-label="Step forward">▲</button><span id="unit-readout"></span><button type="button" data-pan="down" aria-label="Step back">▼</button><button type="button" data-pan="right" aria-label="Step right">▶</button><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="in" aria-label="Zoom in">＋</button></div><aside class="logbook" hidden><div class="logbook-head"><strong>OPERATOR'S LOG</strong><button type="button" id="close-log" aria-label="Put the logbook away">×</button></div><ol id="log-entries"></ol></aside><button type="button" class="notebook-tab" id="open-log">▤ LOG <span id="unread-count"></span></button><p class="rack-help">CLICK: MOUSE LOOK · WASD: WALK · SHIFT: RUN · C: CROUCH · V: LOWER CROUCH · CLICK / E: USE · WHEEL: ZOOM · ALT+WHEEL: HEIGHT · ESC: CURSOR</p><div class="crosshair" aria-hidden="true" hidden></div>`;
  const fireStatus = document.createElement('div');
  fireStatus.style.cssText =
    'position:absolute;left:50%;top:16%;transform:translateX(-50%);z-index:10;text-align:center;color:#ffd6b1;background:#420b08dd;padding:12px 20px;font:700 22px monospace;letter-spacing:2px;pointer-events:auto';
  fireStatus.hidden = true;
  const ruinTitle = document.createElement('div');
  ruinTitle.textContent = 'VX LAB IS RUINED';
  const freshRun = document.createElement('button');
  freshRun.textContent = 'RESET';
  freshRun.hidden = true;
  fireStatus.append(ruinTitle, freshRun);
  overlay.append(fireStatus);
  freshRun.addEventListener('click', () => {
    if (!fire.ruinCause || fire.ruinAge < 20) return;
    Object.assign(fire, createFireIncident());
    Object.assign(overheat, createOverheatState());
    Object.assign(telltales, createSafetyTelltales());
    Object.assign(board, createBoard());
    Object.assign(settings, createRackControls());
    resetRig();
    if (labRoom.lights.on) labRoom.lights.toggle();
    fireStatus.hidden = true;
    freshRun.hidden = true;
    write('Incident cleared. New cold run authorised.');
  });
  const manualSheet = document.createElement('aside');
  manualSheet.className = 'manual-sheet';
  manualSheet.hidden = true;
  manualSheet.innerHTML = `<div class="manual-head"><strong id="manual-title"></strong><button type="button" aria-label="Close reference sheet">×</button></div><pre id="manual-content"></pre><small>UNIVERSITÄT LEIPZIG · VX3-LABOR RAUM −2.17 · FOR EDUCATIONAL USE ONLY</small>`;
  overlay.append(manualSheet);
  canvas.parentElement?.append(overlay);
  const manualPages = [
    {
      title: 'OPERATING GUIDE / VX3 GEN. 2 COLD START',
      content:
        'TECHNIKRAUM\n1  HAUPTSCHALTER closed.\n2  Xenon cage open; regulator to 2 SLPM or more.\nEAST BOARD\n3  NETZ handle on.\nCOLUMN\n4  Isolator (west wall, by the desk) ON,\n   NETZ button (foot of grey cabinet) lit.\n5  SÄULE: SENKEN. Wait for UNTEN steady.\n6  SPANNEN. DICHT lamp lit.\n7  XE EIN, and open the outlet handwheel\n   (or SPÜLEN). Purge until O2 = 0 lights.\n8  Shut the outlet. KAMMERDRUCK above 1.2 bar.\n9  KERN: AKTIVIERUNG up. 800 K glow,\n   3200 K full power.\n\nNEVER heat an open or unpurged chamber.\nNEVER leave the outlet open on a hot core.\nQUITT or RÜCKS. fits a fresh core.',
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
    if (canvas.parentElement?.hidden) return;
    interacted = true;
    void audio.unlock();
  };
  overlay.addEventListener('pointerdown', gesture);
  canvas.addEventListener('pointerdown', gesture);
  document.addEventListener('keydown', gesture);
  const visibility = () =>
    audio.setVisible(!document.hidden && !canvas.parentElement?.hidden);
  document.addEventListener('visibilitychange', visibility);
  // The logbook starts put away; its tab counts what has been written.
  let logOpen = false;
  let unseen = 0;
  const write = (line: string) => {
    const item = document.createElement('li');
    item.textContent = `${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}  ${line}`;
    entries.prepend(item);
    machineActions.record(item.textContent);
    if (interacted) audio.play('pencil');
    while (entries.children.length > 25) entries.lastElementChild?.remove();
    if (!logOpen) {
      unseen++;
      unread.textContent = String(unseen);
      tab.setAttribute('aria-label', `Open logbook, ${unseen} new entries`);
    }
  };
  write('Rack opened. Original full VX3 cold. For educational use only.');
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
  const eyeY = floorY + 1.8034 * worldUnitsPerMetre;
  let eyeOffset = 0;
  let cameraZoom = 1;
  const zoomTo = (value: number) => {
    cameraZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
  };
  overlay.querySelector('[data-pan="up"]')!.addEventListener('click', () => {
    nudge.forward += 0.6 * worldUnitsPerMetre;
  });
  overlay.querySelector('[data-pan="down"]')!.addEventListener('click', () => {
    nudge.forward -= 0.6 * worldUnitsPerMetre;
  });
  overlay.querySelector('[data-pan="left"]')!.addEventListener('click', () => {
    nudge.right -= 0.6 * worldUnitsPerMetre;
  });
  overlay.querySelector('[data-pan="right"]')!.addEventListener('click', () => {
    nudge.right += 0.6 * worldUnitsPerMetre;
  });
  overlay.querySelector('[data-zoom="in"]')!.addEventListener('click', () => {
    zoomTo(cameraZoom + 0.15);
  });
  overlay.querySelector('[data-zoom="out"]')!.addEventListener('click', () => {
    zoomTo(cameraZoom - 0.15);
  });
  // The wheel zooms, as in the developer room (see first-person.ts).
  // Alt+wheel raises and lowers the eye, a clearly sideways swipe steps
  // sideways, and a trackpad pinch (Ctrl+wheel) zooms too.
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
    if (event.altKey) {
      eyeOffset = Math.max(
        -1.1 * worldUnitsPerMetre,
        Math.min(
          0.7 * worldUnitsPerMetre,
          eyeOffset - event.deltaY * scale * 0.004 * worldUnitsPerMetre,
        ),
      );
      return;
    }
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) * 2) {
      nudge.right += event.deltaX * scale * 0.005 * worldUnitsPerMetre;
      return;
    }
    cameraZoom = wheelZoom(cameraZoom, event.deltaY, event.deltaMode);
  };
  canvas.addEventListener('wheel', wheel, { passive: false });
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let orbitYaw = 0;
  let orbitPitch = 0;

  // First-person walking, as in any PC shooter: click to capture the mouse
  // and look around, WASD or the arrow keys to walk, Shift to run, C to
  // crouch, V to crouch lower, click or E to use the crosshair target, Esc to get the
  // cursor back. Touch screens drag to look and tap to use.
  const metre = worldUnitsPerMetre;
  const walkerRadius = 0.25 * metre;
  const walker = {
    x: corridor.spawn.x,
    z: corridor.spawn.z,
    crouched: false,
    lowCrouched: false,
    crouch: 0,
    stride: 0,
  };
  // A shareable inspection view for the east-wall installation.
  const inspectionParams = new URLSearchParams(window.location.search);
  // Inspection views (?view=…), each standing the walker in front of one
  // installation in the game. Only views of dev-only spaces carry a dev_
  // prefix; these are all part of the real game, so none does.
  const inspectionView = inspectionParams.get('view');
  if (inspectionParams.get('lights') === 'on') {
    labRoom.lights.toggle();
    plantRoom.toggleLights();
  }
  // Named viewpoints: shareable inspection links (?view=rack) and the
  // teleport board's destinations.
  const viewpoints: Record<string, () => void> = {
    'control-panel': () => {
      walker.x = room.maxX - 2.8 * metre;
      walker.z = eastControlPanel.group.position.z;
      orbitYaw = Math.PI / 2;
      orbitPitch = -0.16;
    },
    rack: () => {
      walker.x = 0;
      walker.z = GEN1_RACK_Z + 2.05 * metre;
      orbitYaw = 0;
      orbitPitch = -0.26;
    },
    workbench: () => {
      walker.x = room.minX + 2.8 * metre;
      walker.z = room.minZ + 2.75 * metre;
      orbitYaw = -Math.PI / 2;
      orbitPitch = -0.16;
    },
    computer: () => {
      walker.x = bbc.group.position.x - 0.4 * worldUnitsPerMetre;
      walker.z = bbc.group.position.z + 0.95 * worldUnitsPerMetre;
      orbitYaw = 0.4;
      orbitPitch = -0.65;
      cameraZoom = 1.2;
    },
    xenon: () => {
      walker.x = plantRoom.bank.x;
      walker.z = plantRoom.bank.z + 1.65 * worldUnitsPerMetre;
      orbitYaw = 0;
      orbitPitch = -0.305;
    },
    recirculator: () => {
      walker.x = recirculator.group.position.x;
      walker.z = recirculator.group.position.z + 1.6 * worldUnitsPerMetre;
      orbitYaw = 0;
      orbitPitch = -0.2;
    },
    'plant-room': () => {
      walker.x = plantRoom.doorway.x;
      walker.z = room.maxZ + 2.25 * worldUnitsPerMetre;
      orbitYaw = 0;
      orbitPitch = -0.05;
    },
    printer: () => {
      walker.x = room.maxX - 2.2 * metre;
      walker.z = printerZ;
      orbitYaw = Math.PI / 2;
      orbitPitch = -0.35;
    },
    rectifier: () => {
      walker.x = plantRoom.rectifierPosition.x - 1.45 * worldUnitsPerMetre;
      walker.z = plantRoom.rectifierPosition.z + 0.75 * worldUnitsPerMetre;
      orbitYaw = Math.PI / 2;
      orbitPitch = -0.28;
    },
    'fire-call': () => {
      walker.x = firePoint.position.x;
      walker.z = firePoint.position.z - 1.55 * worldUnitsPerMetre;
      orbitYaw = Math.PI;
      orbitPitch = -0.23;
    },
    'fire-reset': () => {
      walker.x = firePanel.position.x;
      walker.z = firePanel.position.z + 1.55 * worldUnitsPerMetre;
      orbitYaw = 0;
      orbitPitch = -0.23;
    },
    corridor: () => {
      walker.x = corridor.spawn.x;
      walker.z = corridor.spawn.z;
      orbitYaw = 0;
      orbitPitch = 0;
    },
  };
  /** Stand at a named viewpoint, as if teleported there. */
  const goTo = (view: string) => {
    const place = viewpoints[view];
    if (!place) return false;
    walker.crouched = false;
    walker.lowCrouched = false;
    cameraZoom = 1;
    place();
    return true;
  };
  if (inspectionView) goTo(inspectionView);
  const devArrival = devPassages.arrival(inspectionParams.get('from'));
  if (devArrival) {
    walker.x = devArrival.x;
    walker.z = devArrival.z;
    orbitYaw = devArrival.yaw;
    orbitPitch = 0;
  }

  // A second testing board, right of the cheat board: teleports. Each
  // button puts the visitor straight at a viewpoint; the last one used
  // keeps its lamp lit. The developer room is another page.
  const destinations: [string, string][] = [
    ['LAB · RACK', 'rack'],
    ['LAB · CONSOLE', 'control-panel'],
    ['LAB · BENCH', 'workbench'],
    ['LAB · BBC MICRO', 'computer'],
    ['LAB · PRINTER', 'printer'],
    ['XENON BANK', 'xenon'],
    ['RECTIFIER', 'rectifier'],
    ['RECIRCULATOR', 'recirculator'],
    ['CORRIDOR', 'corridor'],
    ['DEVELOPER ROOM', 'developer-room'],
  ];
  const teleports = createTestingBoard(
    worldUnitsPerMetre,
    destinations.map(([caption]) => caption),
    {
      title: 'TELEPORTS',
      titleColour: '#2f5f9a',
      footer: 'TESTING ONLY · MOVES YOU',
      rowHeight: 40,
      buttonColour: '#d9a02a',
    },
  );
  teleports.group.name = 'TeleportBoard';
  teleports.group.position.set(
    labRoom.door.handle.x + labRoom.door.width / 2 + 1.7 * worldUnitsPerMetre,
    floorY + 1.4 * worldUnitsPerMetre,
    room.maxZ + wallThickness + 0.035,
  );
  lab.add(teleports.group);
  destinations.forEach(([caption, view], index) => {
    teleports.show(index, false);
    fixture(teleports.buttons[index], `Teleport: ${caption}`, () => {
      audio.play('selector');
      if (view === 'developer-room') {
        write('Teleport: to the developer room.');
        window.location.assign('/?room=dev');
        return;
      }
      destinations.forEach((_, i) => teleports.show(i, i === index));
      goTo(view);
      write(`Teleport: ${caption.toLowerCase()}.`);
    });
  });
  const keys = new Set<string>();
  const nudge = { forward: 0, right: 0 };
  // Development builds expose the walker so browser checks can place the
  // camera without a captured mouse.
  // In development, check that every clickable thing is an input or a room
  // fixture, that every input works and that no indicator can be operated.
  const partsInScene = () => {
    const objects: Array<{
      userData: Object3D['userData'];
      clickable: boolean;
    }> = [];
    scene.traverse((object) => {
      if (designationOf(object) || fixtureOf(object) || actions.has(object.id))
        objects.push({
          userData: object.userData,
          clickable: actions.has(object.id),
        });
    });
    return objects;
  };
  if (import.meta.env.DEV) {
    const problems = auditParts(partsInScene());
    if (problems.length)
      console.error(`Machine part designations:\n${problems.join('\n')}`);
  }
  if (import.meta.env.DEV)
    Object.assign(window, {
      vx3Walker: {
        walker,
        /** Stand at a named viewpoint, as the teleport board does. */
        goTo,
        /** The last frame's draw calls and triangles, and what the GPU holds. */
        stats: () => ({
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          programs: renderer.info.programs?.length ?? 0,
        }),
        look(yaw: number, pitch = 0) {
          orbitYaw = yaw;
          orbitPitch = pitch;
        },
        toolRack: () => toolRack.group.getWorldPosition(new Vector3()),
        /** The second-generation VX3 and the xenon bank that feeds it. */
        gen2,
        xenon,
        /** Close or open the east board's NETZ contactor. */
        netz: () => flipMains('Test: '),
        /** Sit in the chair at the BBC, as clicking it does. */
        sit: sitAtComputer,
        chair: () => chair.group.position.clone(),
        rig,
        lights: labRoom.lights,
        plantRoom,
        contraptions,
        /** Every machine with its inputs and indicators, and any problems. */
        parts: () => ({
          machines: Object.fromEntries(partInventory(partsInScene())),
          problems: auditParts(partsInScene()),
        }),
        controlPanel: () => ({
          x: eastControlPanel.group.position.x,
          z: eastControlPanel.group.position.z,
          metre: worldUnitsPerMetre,
        }),
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
      if (
        !(object instanceof Mesh) ||
        doorParts.has(object) ||
        object.userData.noCollision
      )
        return;
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
    help.textContent = touch
      ? 'LEFT STICK: WALK (PUSH FULLY TO RUN) · RIGHT STICK: LOOK · TAP: USE · PINCH: ZOOM'
      : 'CLICK: MOUSE LOOK · WASD: WALK · SHIFT: RUN · C: CROUCH · V: LOWER CROUCH · CLICK / E: USE · WHEEL: ZOOM · ALT+WHEEL: HEIGHT · ESC: CURSOR';
  };
  const crosshair = overlay.querySelector<HTMLElement>('.crosshair')!;
  const target = (x = 0, y = 0) => {
    pointer.set(x, y);
    raycaster.setFromCamera(pointer, perspectiveCamera);
    const hit = raycaster.intersectObjects(interactive, false)[0];
    if (!hit) return undefined;
    if (withinReach.has(hit.object) && hit.distance > doorReach)
      return undefined;
    return hit;
  };
  const use = (x = 0, y = 0) => {
    const hit = target(x, y);
    if (hit) actions.get(hit.object.id)?.(hit);
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
    if (canvas.parentElement?.hidden) return;
    if (typing(event)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (walkKeys.has(event.code)) {
      keys.add(event.code);
      if (event.code.startsWith('Arrow')) event.preventDefault();
    }
    if (event.repeat) return;
    if (event.code === 'KeyC') {
      walker.crouched = walker.lowCrouched || !walker.crouched;
      walker.lowCrouched = false;
    }
    if (event.code === 'KeyV') {
      walker.crouched = true;
      walker.lowCrouched = !walker.lowCrouched;
    }
    if (event.code === 'KeyE') use();
  };
  const keyup = (event: KeyboardEvent) => keys.delete(event.code);
  const forget = () => keys.clear();
  document.addEventListener('keydown', keydown);
  document.addEventListener('keyup', keyup);
  window.addEventListener('blur', forget);
  const look = (event: MouseEvent) => {
    if (!locked()) return;
    // Looking slows as the view zooms in, so small controls stay easy to aim at.
    const rate = 0.0022 / cameraZoom;
    orbitYaw += event.movementX * rate;
    orbitPitch = Math.max(
      -1.45,
      Math.min(1.45, orbitPitch - event.movementY * rate),
    );
  };
  document.addEventListener('mousemove', look);
  const lockChange = () => {
    crosshair.hidden = !locked();
    document.body.classList.toggle('mouse-look', locked());
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
    if (canvas.parentElement?.hidden) return;
    if (event.pointerType === 'touch') setInput('touch');
    else if (event.pointerType === 'mouse') setInput('mouse');
  };
  window.addEventListener('pointerdown', notePointer, true);
  setInput(window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse');

  let drag: {
    x: number;
    y: number;
    yaw: number;
    pitch: number;
    moved: boolean;
    /** False for a touch in first person, which only ever taps. */
    look: boolean;
  } | null = null;
  // Two fingers on the canvas pinch to zoom. A pinch never
  // ends in a tap: taps wait until every finger has lifted.
  const touches = new Map<number, { x: number; y: number }>();
  let pinch: { distance: number; zoom: number } | null = null;
  let pinched = false;
  const spread = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  };
  const down = (event: PointerEvent) => {
    if (event.pointerType === 'touch') {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size === 2) {
        pinch = { distance: spread(), zoom: cameraZoom };
        pinched = true;
        drag = null;
      }
      if (touches.size > 1) {
        canvas.setPointerCapture(event.pointerId);
        return;
      }
    }
    if (event.pointerType === 'mouse' && !lockRefused) {
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
      look: event.pointerType !== 'touch',
    };
  };
  const move = (event: PointerEvent) => {
    const touch = touches.get(event.pointerId);
    if (touch) {
      touch.x = event.clientX;
      touch.y = event.clientY;
      if (pinch && touches.size >= 2) {
        zoomTo(pinch.zoom * (spread() / pinch.distance));
        return;
      }
    }
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const slop = event.pointerType === 'touch' ? 12 : 5;
    if (Math.abs(dx) > slop || Math.abs(dy) > slop) drag.moved = true;
    if (drag.moved && drag.look) {
      // Drag the view: turn all the way round, look up to the ceiling or
      // down toward the floor.
      orbitYaw = drag.yaw - (dx * 0.004) / cameraZoom;
      orbitPitch = Math.max(
        -1.2,
        Math.min(1.2, drag.pitch + (dy * 0.003) / cameraZoom),
      );
    }
  };
  const lift = (event: PointerEvent) => {
    if (!touches.delete(event.pointerId)) return;
    if (touches.size < 2) pinch = null;
    if (touches.size === 0) pinched = false;
  };
  const up = (event: PointerEvent) => {
    const wasPinched = pinched;
    lift(event);
    if (wasPinched) {
      drag = null;
      return;
    }
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
  canvas.addEventListener('pointercancel', lift);

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
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let last = 0;
  let xenonWarned = false;
  let nextFireCue = 0;
  renderer.setAnimationLoop((time) => {
    if (canvas.parentElement?.hidden) {
      last = 0;
      return;
    }
    const delta = last ? Math.min(0.1, (time - last) / 1000) : 0;
    last = time;
    plantRoom.update(
      delta,
      reducedMotion.matches,
      telltales.powerKw,
      inCorridor() ? 1 - labRoom.lights.level : 0,
    );
    rectifier.update(plantRoom.powered, time / 1000, reducedMotion.matches);
    audio.setPlantPower(plantRoom.powered);
    // The column: xenon from the plant room's line, power through the
    // plant master, the east board's contactor and its own switches.
    if (settings.mains && !plantRoom.powered) {
      settings.mains = false;
      audio.play('breaker-off');
      write(
        'Plant master supply disconnected. Column off; lighting unchanged.',
      );
    }
    feedFromLine(gen2.prep, xenon.flowSlpm, delta);
    gen2On = gen2Powered({
      plantPowered: plantRoom.powered,
      rigOn: gen2.running,
      remoteMains: settings.mains,
    });
    gen2.drive.power = gen2On;
    gen2.update(time / 1000, delta, reducedMotion.matches);
    if (rig.controls.mains && !plantRoom.powered) {
      rig.controls.mains = false;
      audio.play('breaker-off');
      write(
        'Plant master supply disconnected. Machinery off; lighting unchanged.',
      );
    }
    // Xenon is needed for safe running, but nothing stops anyone running
    // without it: past the spindle limit the bench monitor flashes a
    // warning and strain creeps up until something gives.
    const unsafe =
      rig.controls.mains && xenonHazard(rig.spindle, xenon.flowSlpm);
    if (unsafe && !xenonWarned) {
      audio.play('warning');
      write('Monitor: XENON CIRCUIT NOT PRESSURISED. Carrying on.');
    }
    xenonWarned = unsafe;
    for (const event of stepRig(
      rig,
      delta,
      Math.random,
      unsafe ? XENON_HAZARD_STRAIN_PER_SECOND : 0,
    )) {
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
        latchFault(board);
        audio.play('incident');
        window.setTimeout(() => audio.play('breaker-off'), 180);
        // The fault printout first, with clues to what went wrong, then the
        // operator's own note of what it did to the room.
        for (const line of tripClues(event.report, {
          xenonFlowSlpm: xenon.flowSlpm,
        }))
          write(line);
        write(event.text);
      }
    }
    // The wall meter shows the column's load; the crystal wakes with an
    // active core, sealed in, powered and on the xenon line.
    stepTelltaleOutputs(
      telltales,
      {
        powerKw: gen2PowerKw(gen2.prep, gen2On),
        dilationActivity:
          gen2On && isSealed(gen2.prep) && xenonReady(xenon.flowSlpm)
            ? gen2Activity(gen2.prep)
            : 0,
      },
      delta,
    );
    const startedSmoking = stepOverheat(
      overheat,
      {
        spindle: rig.spindle,
        field: rig.field,
        load: telltales.powerKw,
      },
      delta,
    );
    for (const channel of startedSmoking)
      write(
        channel === 'spindle'
          ? 'Encabulator drive smoking. Smells like a warm toaster. Carrying on.'
          : channel === 'field'
            ? 'H-B coil insulation smoking. Field still holds.'
            : 'Betaform amplifier smoking. The load meter agrees.',
      );
    for (const channel of ['spindle', 'field', 'load'] as const)
      heatSmoke[channel].update(
        time / 1000,
        overheat.smoke[channel],
        reducedMotion.matches,
      );
    for (const channel of ['spindle', 'field', 'load'] as const) {
      const { flame, light } = flames[channel];
      flame.visible = fire.burning[channel];
      flame.scale.setScalar(
        reducedMotion.matches ? 1 : 0.85 + 0.25 * Math.sin(time * 0.019),
      );
      light.intensity = fire.burning[channel]
        ? 9 + 3 * Math.sin(time * 0.013)
        : 0;
    }
    for (const event of stepFireIncident(
      fire,
      overheat,
      rig.controls.mains,
      delta,
    )) {
      if (event === 'alarm') {
        latchFault(board);
        audio.play('warning');
        write('Rauchmelder: FEUERALARM. Labor räumen; Hauptschalter öffnen.');
      } else if (event === 'water') {
        audio.play('relay', 'sprinkler');
        write('Sprinkler geöffnet. Wasser auf dem Laborboden.');
      } else if (event === 'water-stopped') {
        audio.play('relay', 'sprinkler');
        write('Sprinklerzufuhr nach 45 Sekunden automatisch geschlossen.');
      } else if (event === 'fire') {
        audio.play('incident');
        write('Gerätebrand festgestellt. Stromversorgung sofort trennen.');
      } else if (event === 'ruined-fire' || event === 'ruined-short') {
        rig.controls.mains = false;
        settings.mains = false;
        applyRack(settings, rig.controls);
        if (labRoom.lights.on) labRoom.lights.toggle();
        audio.play('incident');
        write(
          event === 'ruined-fire'
            ? 'ABSCHLUSSBERICHT: Labor durch Gerätebrand zerstört.'
            : 'ABSCHLUSSBERICHT: Wasser auf spannungsführender Anlage. Labor zerstört.',
        );
      }
    }
    const beaconPulse = fire.alarm && Math.sin(time * 0.006) > 0;
    labRoom.setFireAlarm(fire.alarm);
    fireScreen.material.color.set(fire.alarm ? '#df552f' : '#65a76b');
    labBeacon.intensity = beaconPulse ? 20 : 0;
    hallBeacon.intensity = beaconPulse ? 14 : 0;
    discharge.intensity =
      fire.water &&
      (rig.controls.mains || fire.ruinCause === 'short') &&
      Math.sin(time * 0.035) > 0.7
        ? 30
        : 0;
    if (fire.alarm && time >= nextFireCue) {
      audio.play('warning');
      if (fire.water && (rig.controls.mains || fire.ruinCause === 'short'))
        audio.play('spark');
      nextFireCue = time + 1500;
    }
    audio.setSprinklers(fire.water);
    for (const { spray, puddle } of sprinklerEffects) {
      spray.update(time / 1000, fire.water, reducedMotion.matches);
      puddle.scale.setScalar(Math.max(0.001, fire.puddle));
    }
    fireStatus.hidden =
      !fire.ruinCause || (fire.ruinAge >= 8 && fire.ruinAge < 20);
    if (fire.ruinCause) {
      ruinTitle.hidden = fire.ruinAge >= 8;
      freshRun.hidden = fire.ruinAge < 20;
    }
    // Running ferrocores bend the room: colour, π, space and sparks.
    const activity = gen2Activity(gen2.prep);
    anomaly = anomalyEffects(activity, time / 1000, reducedMotion.matches);
    ps1Uniforms.channels.value.set(...anomaly.channels);
    ps1Uniforms.warp.value = anomaly.warp;
    ps1Uniforms.time.value = time / 1000;
    sparkles.group.visible = !reducedMotion.matches;
    sparkles.update(
      delta,
      reducedMotion.matches || telltales.dilationActivity === 0
        ? 0
        : 6 + telltales.dilationActivity * 30,
      1.2,
    );
    const level = anomalyStage(activity);
    if (level > anomalyLevel)
      write(
        level === 1
          ? 'Ferrocores active. The colours in the room have started breathing, slightly out of step.'
          : 'Ferrocores strongly active. Measured π twice and got two answers. The far wall is closer than it was.',
      );
    else if (level === 0 && anomalyLevel > 0)
      write(
        'Ferrocores quiet. The room is the right shape again, as far as I can tell.',
      );
    anomalyLevel = level;
    stepBoard(board, boardInputs, delta);
    eastControlPanel.update({
      view: boardView(board, boardInputs),
      readings: boardReadings(boardInputs),
      // SOLL is the core's set point, IST its temperature.
      trimSet: (gen2.prep.temperature - AMBIENT) / (MAXIMUM - AMBIENT),
      trimIdeal: (gen2.prep.setpoint - AMBIENT) / (MAXIMUM - AMBIENT),
      powerKw: telltales.powerKw,
      energyKwh: telltales.energyKwh,
      delta: gen2.prep.xenon,
      ferrocoreRadiansPerSecond: gen2.prep.spinRate * Math.PI * 2,
      ferrocoreActivity: activity,
      seconds: delta,
    });
    audio.update(rig, settings, reducedMotion.matches);
    if (teleprinter.update(delta, reducedMotion.matches)) audio.play('printer');
    for (const update of dynamic) update();
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
      (walker.lowCrouched ? 0.3 : walker.crouched ? 0.5 : 1) *
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
    const solid = [
      ...footprints,
      ...devPassages.solids(),
      ...(labRoom.door.blocking ? [labRoom.door.footprint] : []),
      ...(plantRoom.blocking ? [plantRoom.gateFootprint] : []),
      ...(plantRoom.entryBlocking ? [plantRoom.entryFootprint] : []),
    ];
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
    devPassages.update(delta, walker.x, walker.z);
    walker.crouch +=
      ((walker.lowCrouched ? 1.85 : walker.crouched ? 1 : 0) - walker.crouch) *
      Math.min(1, delta * 10);
    const bob = reducedMotion.matches
      ? 0
      : Math.sin((walker.stride / metre) * Math.PI * 1.6) * 0.02 * metre;
    const eye = new Vector3(
      walker.x,
      eyeY + eyeOffset - walker.crouch * 0.65 * metre + bob,
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
      walker.z > room.maxZ
        ? 'CORRIDOR · EBENE −2'
        : walker.x < room.minX
          ? 'TECHNIKRAUM · XENON'
          : 'VX3 LAB · RAUM −2.17';
    ps1Uniforms.snapPixels.value = reducedMotion.matches ? 0 : 1;
    const viewer = perspectiveCamera;
    viewer.getWorldPosition(ear);
    viewer.getWorldDirection(facing);
    audio.listen(ear.x, ear.y, ear.z, Math.atan2(facing.x, -facing.z));
    const listenerRoom = roomAt(roomPlan, ear.x, ear.z);
    // Draw only the rooms that can be seen from here. Collision was taken
    // from the whole scene on the first frame, before anything was hidden.
    const shown = visibleRooms(listenerRoom);
    lab.visible = shown.lab;
    for (const group of plantGroups) group.visible = shown.plant;
    const doorOpenings = {
      lab: labRoom.door.amount,
      plant: plantRoom.entryAmount,
    };
    for (const [source, sourceRoom] of soundRooms)
      audio.setTransmission(
        source,
        // The teleprinter is heard only by someone in the lab with it.
        source === 'printer'
          ? listenerRoom === sourceRoom
            ? 1
            : 0
          : transmission(
              sourceRoom,
              listenerRoom,
              doorOpenings,
              source === 'sink',
            ),
      );
    renderer.render(scene, viewer);
  });
  const dispose = () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    canvas.removeEventListener('wheel', wheel);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointerdown', gesture);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', lift);
    document.removeEventListener('keydown', keydown);
    document.removeEventListener('keyup', keyup);
    window.removeEventListener('blur', forget);
    window.removeEventListener('pointerdown', notePointer, true);
    sticks.dispose();
    document.removeEventListener('mousemove', look);
    document.removeEventListener('pointerlockchange', lockChange);
    document.removeEventListener('pointerlockerror', refuseLock);
    document.body.classList.remove('mouse-look');
    if (locked()) document.exitPointerLock();
    document.removeEventListener('keydown', gesture);
    document.removeEventListener('visibilitychange', visibility);
    audio.dispose();
    ashtray.dispose();
    for (const plume of Object.values(heatSmoke)) plume.dispose();
    for (const { spray } of sprinklerEffects) spray.dispose();
    xenon.dispose();
    contraptions.dispose();
    recirculator.dispose();
    sparkles.dispose();
    plantRoom.dispose();
    rectifier.dispose();
    cheats.dispose();
    teleports.dispose();
    hotline.dispose();
    labRoom.dispose();
    devPassages.dispose();
    corridor.dispose();
    toolRack.dispose();
    cub.dispose();
    bbc.dispose();
    chair.dispose();
    gen2.dispose();
    diskDrive.dispose();
    userGuide.dispose();
    workbench.dispose();
    eastControlPanel.dispose();
    teleprinter.dispose();
    overlay.remove();
    scene.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    for (const item of materials) item.dispose();
    for (const item of textures) item.dispose();
    renderer.dispose();
  };
  return Object.assign(dispose, {
    suspend() {
      audio.setVisible(false);
      keys.clear();
      document.body.classList.remove('mouse-look');
    },
    resume() {
      visibility();
    },
    enter(previous: string | null) {
      const pose = devPassages.arrival(previous);
      if (pose) {
        walker.x = pose.x;
        walker.z = pose.z;
        orbitYaw = pose.yaw;
        orbitPitch = 0;
        walker.crouched = false;
        walker.lowCrouched = false;
      }
    },
  });
}
