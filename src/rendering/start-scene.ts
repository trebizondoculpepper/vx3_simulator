import { createRenderer, renderScale, useEnvironment } from './render-style';
import {
  coldStart as coldStartSteps,
  overdrive,
  play,
  prepareVessel,
} from '../game/world/scenarios';
import { createPrintedImageTexture } from '../scene/printed-image';
import { defaultControlRecording } from '../audio/control-sound-defaults';
import type { ControlSound } from '../audio/rig-sounds';
import { describeMachineChange } from '../game/machine-change';
import { createDelayedPrinter } from '../game/delayed-printer';
import { createMachineActionLog } from '../game/machine-action-log';
import { DEV_DOOR_WIDTH, DEV_DOOR_HEIGHT } from '../game/dev-room-links';
import { createDevDoorways } from '../scene/dev-doorways';
import { createMuseumGallery } from '../scene/museum-gallery';
import { MAX_ZOOM, MIN_ZOOM, wheelZoom } from './first-person';
import { createRoomLighting } from './room-lighting';
import { createAgedWallMap } from './aged-wall';
import { createWorld } from '../game/world/world';
import {
  divergencePulse,
  effectFrame,
  settingsForMachine,
} from '../game/effect-settings';
import {
  applyEffectFrame,
  exemptFromEffects,
  stillFrame,
} from './apply-effects';
import { createChromaticDivergence } from './chromatic-divergence';
import type { World, WorldEvent } from '../game/world/world';
import { createAutoStart } from '../game/world/auto-start';
import type { AutoStart } from '../game/world/auto-start';
import { createCircuitBoard } from '../scene/circuit-board';
import {
  createEightiesButton,
  createMicroLabel,
  createPanelKit,
  disposeKit,
} from '../scene/eighties-controls';
import type { CapColour } from '../scene/eighties-controls';
import { createEmbers } from '../scene/embers';
import { createElectricArcs } from '../scene/electric-arcs';
import { createSmokeStains } from '../scene/smoke-stains';
import { createFlamePlume } from '../scene/flame-plume';
import {
  Box3,
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Fog,
  Group,
  MeshBasicMaterial,
  Mesh,
  OctahedronGeometry,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Raycaster,
  Scene,
  TubeGeometry,
  Vector2,
  Vector3,
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
import { createRackControls, knobLine } from '../game/rack-controls';
import type { KnobId } from '../game/rack-controls';
import { createRig } from '../game/rig';
import { redlineFraction } from '../game/redlines';
import { createOverheatState } from '../game/overheat';
import { createFireIncident } from '../game/fire-incident';
import { annunciators, createBoard } from '../game/control-board';
import { createSafetyTelltales } from '../game/safety-telltales';
import { createCanvasTexture, createLabelTexture } from '../scene/screens';
import { createWorldMapTexture } from '../scene/world-map';
import { createCubMonitor } from '../scene/cub-monitor';
import { createOfficeChair } from '../scene/office-chair';
import { createFerrocoreColumnRig } from '../scene/ferrocore-column-rig';
import type { RigClickable } from '../scene/ferrocore-column-rig';
import { atmospherePermit, lineFlow } from '../game/gen2-wiring';
import { driveBrightness, driveTemperature } from '../game/cold-start';
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
import { createHotlinePhone } from '../scene/hotline-phone';
import { createLabRoom } from '../scene/lab-room';
import { createCorridor } from '../scene/corridor';
import { createPlantRoom } from '../scene/plant-room';
import { createMercuryRectifier } from '../scene/mercury-rectifier';
import { GEN1_RACK_Z, GEN1_TOTAL_HEIGHT } from '../scene/gen1-vx3';
import { knobDirection } from '../scene/rotary-knob';
import { xenonReady } from '../game/xenon-supply';
import { benchScreen, createBenchComputer } from '../game/bench-monitor';
import {
  anomalyEffects,
  anomalyStage,
  ferrocoreActivity,
} from '../game/ferrocore-anomaly';
import { createCrystalSparkles } from '../scene/crystal-sparkles';
import { createToolRack } from '../scene/tool-rack';
import { createWestWorkbench } from '../scene/west-workbench';
import { createTouchSticks } from '../ui/touch-sticks';
import { slide } from '../game/walk-collision';
import type { Footprint } from '../game/walk-collision';
import { createTeleprinter } from '../scene/teleprinter';
import { createPs1Material, ps1Uniforms } from './ps1-material';

// The 19-inch panel sets the world's scale.
const panelWidth = PANEL_WIDTH;
const worldUnitsPerMetre = panelWidth / 0.4826;

export function startScene(canvas: HTMLCanvasElement) {
  const renderer = createRenderer(canvas);
  renderer.shadowMap.enabled = true;
  const perspectiveCamera = new PerspectiveCamera(52, 1, 0.1, 150);
  const scene = new Scene();
  // Realistic style: soft light and reflections from every side.
  const freeEnvironment = useEnvironment(renderer, scene, 0.9);
  // Two floors underground the corridor fades into darkness either way.
  const basementFog = new Fog('#0d0c0a', 55, 148);
  scene.background = basementFog.color;
  scene.fog = basementFog;

  const materials: Material[] = [];
  const textures: Texture[] = [];
  const interactive: Object3D[] = [];
  const actions = new Map<number, (hit: Intersection) => void>();
  const dynamic: Array<() => void> = [];
  let world = createWorld();
  // The cheats in the circuit board's southern cupboard: an automatic
  // cold start in progress, and whether TRIMM is kept on SOLL for the
  // player (until they turn it themselves).
  let autoStart: AutoStart | null = null;
  let followTrim = false;
  const rig = createRig();
  // The room's state near the ferrocores: colour, π, space and sparks.
  let anomaly = anomalyEffects(0, 0, false);
  // The machine's effects on the room, staged as in dev0: mild precision
  // and divergence near activation, the walls breathing as it overheats.
  let effectSeconds = 0;
  let fullActivation = 0;
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
  /** The control being worked, whose name heads the next log line. */
  let pressed: string | null = null;
  /** Set while a room fitting is worked: it writes nothing to the log. */
  let quiet = false;
  const teleprinterLines: string[] = [];
  const delayedPrinter = createDelayedPrinter((line) => {
    teleprinterLines.push(line);
    teleprinter.record(line);
  });
  const machineActions = createMachineActionLog(
    () =>
      JSON.stringify({
        // The machine's state, without the board's own bookkeeping (alarm
        // phases, handle springs, its clock), which is not the machine.
        world: Object.fromEntries(
          Object.entries(world.snapshot()).filter(
            ([id]) => !id.startsWith('board.'),
          ),
        ),
        powerSelections: gen2.powerSelections,
        column: gen2.prep,
        columnPower: gen2.running,
        rack: settings,
        plantPower: plantRoom.powered,
        xenonValve: xenon.setting,
        recirculator: recirculator.enabled,
        alarms: board.alarms,
        fire,
      }),
    (line) => delayedPrinter.queue(line),
    (label, before, after) =>
      write(describeMachineChange(label, before, after)),
  );
  const bind = (
    object: Object3D,
    action: (hit: Intersection) => void,
    /** A machine control, whose changes the teletype records. */
    machine = true,
  ) => {
    interactive.push(object);
    actions.set(object.id, (hit) => {
      if (!machine) {
        action(hit);
        return;
      }
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
      if (fire.ruinCause) return;
      // The operator's log names the control exactly, for debugging: the
      // first line the action writes is prefixed with it. Unlogged state
      // changes are described by the transaction fallback.
      pressed = `${machine}: ${name}`;
      action(hit);
      pressed = null;
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
    bind(
      object,
      () => {
        // Room fittings (lights, doors, taps, drawers, the chair, the
        // cheats) are not the machine: they work even with it ruined, and
        // stay out of the operator's log and off the teletype.
        quiet = true;
        try {
          action();
        } finally {
          quiet = false;
        }
      },
      false,
    );
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
  const backWallHeight = room.ceilingY - floorY;
  const northWall = cube(
    lab,
    room.maxX - room.minX,
    backWallHeight,
    wallThickness,
    '#626f68',
    0,
    floorY + backWallHeight / 2,
    room.minZ - wallThickness / 2,
  );
  const northDado = cube(
    lab,
    room.maxX - room.minX,
    3.4,
    0.2,
    '#3d5750',
    0,
    floorY + 1.7,
    -3.79,
  );
  for (const [wall, height, base, seed, dado] of [
    [northWall, backWallHeight, '#626f68', 810, false],
    [northDado, 3.4, '#3d5750', 811, true],
  ] as const) {
    const map = createAgedWallMap({
      width: (room.maxX - room.minX) / worldUnitsPerMetre,
      height: height / worldUnitsPerMetre,
      base,
      seed,
      dado,
    });
    textures.push(map);
    const finish = createPs1Material({
      color: '#ffffff',
      map,
      roughness: 0.96,
    });
    materials.push(finish);
    wall.material = finish;
  }
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
    // The recirculator's pump runs on the mains; the rectifier only feeds
    // the direct-current equipment.
    recirculator.update(
      true,
      Math.min(0.1, seconds - recirculatorLastSeconds),
      reducedMotion.matches,
    );
    recirculatorLastSeconds = seconds;
  });
  const devEntry = {
    x: labRoom.door.handle.x + 9.5 * worldUnitsPerMetre,
    z: room.maxZ + wallThickness + 2.4 * worldUnitsPerMetre,
  };
  const devPassages = createDevDoorways(
    'corridor',
    [{ to: 'dev0', side: 'south', ...devEntry }],
    floorY,
    worldUnitsPerMetre,
  );
  scene.add(devPassages.group);
  const museumEntry = {
    x: labRoom.door.handle.x - 2.475 * worldUnitsPerMetre,
    z: devEntry.z,
  };
  const museum = createMuseumGallery(
    worldUnitsPerMetre,
    floorY,
    labRoom.door.handle.x,
    museumEntry.z + wallThickness,
  );
  scene.add(museum.group);
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
    museumDoor: {
      x: museumEntry.x,
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
    if (world.work('fire.Handfeuermelder')) {
      audio.play('warning');
      write('FIRE ALARM: call point pressed. Evacuate the lab.');
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
    0.19,
    0.07,
    0.007,
    '#65a76b',
    0,
    0.095,
    0.103,
    0.9,
  );
  const fireLcd = createCanvasTexture(384, 128);
  textures.push(fireLcd.texture);
  fireScreen.material.map = fireLcd.texture;
  fireScreen.material.color.set('#ffffff');
  fireScreen.material.needsUpdate = true;
  let fireLcdState = '';
  const showFireLcd = (state: 'normal' | 'alarm' | 'extinguished') => {
    if (state === fireLcdState) return;
    fireLcdState = state;
    const c = fireLcd.context;
    c.fillStyle = state === 'alarm' ? '#4a2616' : '#243c2b';
    c.fillRect(0, 0, 384, 128);
    c.fillStyle = 'rgba(0,0,0,0.13)';
    for (let y = 0; y < 128; y += 7) c.fillRect(0, y, 384, 2);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = state === 'alarm' ? '#ffbd77' : '#a9e7a7';
    c.font = 'bold 35px monospace';
    c.fillText(
      state === 'normal'
        ? 'SYSTEM NORMAL'
        : state === 'alarm'
          ? 'FEUERALARM'
          : 'BRAND GELÖSCHT',
      192,
      48,
      370,
    );
    c.font = 'bold 24px monospace';
    c.fillText(
      state === 'normal'
        ? 'KEIN ALARM'
        : state === 'alarm'
          ? 'LABOR RÄUMEN'
          : 'ANLAGE AUS',
      192,
      91,
      370,
    );
    fireLcd.texture.needsUpdate = true;
  };
  showFireLcd('normal');
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
      world.work('fire.RÜCKSTELLEN')
        ? 'Fire panel: reset. Sprinklers shut.'
        : 'Fire panel: reset refused; fire or smoke still present.',
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
  const boardKit = createPanelKit();
  const circuitBoard = createCircuitBoard(boardKit, () => world, {
    log: (message) => write(message),
    // The southern bay's cupboard holds the cheats, not relays.
    emptyCompartments: ['XENON'],
  });
  circuitBoard.group.scale.setScalar(worldUnitsPerMetre);
  circuitBoard.group.position.set(
    room.maxX - 0.025 * worldUnitsPerMetre,
    floorY,
    room.minZ + 2.65 * worldUnitsPerMetre,
  );
  circuitBoard.group.rotation.y = -Math.PI / 2;
  lab.add(circuitBoard.group);
  // The board is a tool: it stays whole while the room around it bends.
  exemptFromEffects(circuitBoard.group);
  const divergence = createChromaticDivergence(renderer, worldUnitsPerMetre);

  // The VX3's ferrocore column and its two cabinets stand in the bay the
  // first rig left, its back to the north wall, beside the computer desk.
  // It is built in metres. Its supply comes through the plant room's
  // master and the east board's NETZ contactor, its xenon from the plant
  // room's cylinder bank (see src/game/gen2-wiring.ts).
  // The column's panels work the ferrocore drive (the drive model, `rig`,
  // through the rack controls `settings`): DREHZAHL, FELD, TRIMM and
  // UNTERSETZUNG, the heater switches and ZÜND, the SCHWEBUNG band, the
  // trips and the remote xenon regulator.
  const driveDial = (id: KnobId) => ({
    get: () => world.read<number>(`drive.${id}`),
    set: (value: number) => {
      // Turning TRIMM by hand takes it back from the cheats.
      if (id === 'trim') followTrim = false;
      world.work(`drive.${id}`, value);
      write(knobLine(id, value));
    },
  });
  const gen2 = createFerrocoreColumnRig({
    // The column's supply switches (the isolator on the west wall, its NETZ
    // button and the cabinet rocker) all start switched off.
    switchedOn: false,
    // The column's equipment is fed from the plant room's mercury arc
    // rectifier; the east board and the ceiling lights are on the mains.
    supplied: () => world.read<boolean>('plant.powered'),
    log: (text) => write(text),
    onEvent: (event) => {
      if (event.kind !== 'catastrophe') return;
      // The world model owns the trip; this is its local sound.
      audio.play('incident');
      window.setTimeout(() => audio.play('breaker-off'), 180);
    },
    drive: {
      dials: {
        spindle: driveDial('spindle'),
        field: driveDial('field'),
        trim: driveDial('trim'),
        ratio: driveDial('ratio'),
      },
      heaters: {
        get: (id) => world.read<boolean>(`drive.${id}`),
        flip: (id) => void world.work(`drive.${id}`),
      },
      ignite: () => void world.work('column.ZÜND'),
      band: {
        get: () => world.read<number>('drive.insulationBand'),
        set: (value) => void world.work('drive.insulationBand', value),
      },
      trip: (source) => {
        world.work(
          source === 'STRAHL STOP' ? 'column.STRAHL STOP' : 'column.AUS',
        );
        write(`${source}: drive tripped. Column supply off.`);
      },
      regulator: (direction) => {
        const next = Math.max(
          0,
          Math.min(
            1,
            Math.round(
              (world.read<number>('xenon.regulator') +
                Math.sign(direction) / 10) *
                10,
            ) / 10,
          ),
        );
        world.work('xenon.regulator', next);
        write(
          `XE-REGLER ${direction < 0 ? 'down' : 'up'}: ${(next * 10).toFixed(1)} SLPM selected.`,
        );
      },
    },
  });
  gen2.drive.hold = true;
  gen2.group.scale.setScalar(worldUnitsPerMetre);
  gen2.group.position.set(4.6, floorY, room.minZ + 0.52 * worldUnitsPerMetre);
  lab.add(gen2.group);
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
      const recording = kind
        ? defaultControlRecording(kind as ControlSound)
        : undefined;
      if (recording) return recording;
      if (kind === 'knob' || kind === 'handwheel') return 'knob';
      if (kind === 'selector') return 'selector';
      if (kind === 'isolator') return 'breaker-on';
      if (kind === 'toggle' || kind === 'rocker' || kind === 'slide')
        return 'toggle-up';
      if (kind) return 'button';
    }
    return 'button';
  };
  // The column's built-in controls are physical views of the graph world.
  // Their own switches and valves change the display first; translate that
  // movement to one world action, then let the next frame project the answer.
  type Selection = 'isolator' | 'mains' | 'cabinet';
  const worldSelections: Record<Selection, string> = {
    isolator: 'column.isolator',
    mains: 'column.netz',
    cabinet: 'column.rocker',
  };
  const supplySwitches = new Map<Selection, () => void>();
  for (const control of gen2.clickables) {
    if (!/isolator|rocker|NETZ/i.test(control.name)) continue;
    const before = gen2.powerSelections;
    control.use();
    const after = gen2.powerSelections;
    const flipped = (['isolator', 'mains', 'cabinet'] as const).find(
      (key) => before[key] !== after[key],
    );
    control.use();
    if (flipped && !supplySwitches.has(flipped))
      supplySwitches.set(flipped, () => control.use());
  }
  const workedOnColumn = (control: RigClickable) => (direction?: number) => {
    const prep = gen2.prep;
    const read = () => ({
      liftTarget: prep.liftTarget,
      clamped: prep.clamped,
      inletOpen: prep.inletOpen,
      outletOpen: prep.outletOpen,
      failure: prep.failure,
      supply: prep.supply,
      ...gen2.powerSelections,
    });
    const before = read();
    control.use(direction);
    const after = read();
    Object.assign(prep, {
      liftTarget: before.liftTarget,
      clamped: before.clamped,
      inletOpen: before.inletOpen,
      outletOpen: before.outletOpen,
      failure: before.failure,
      supply: before.supply,
    });
    if (after.liftTarget !== before.liftTarget)
      world.work(after.liftTarget === 0 ? 'column.SENKEN' : 'column.HEBEN');
    if (after.clamped !== before.clamped) world.work('column.SPANNEN');
    if (after.inletOpen !== before.inletOpen) world.work('column.XE EIN');
    if (after.outletOpen !== before.outletOpen) world.work('column.outlet');
    if (after.failure !== before.failure || after.supply > before.supply)
      world.work('column.QUITT');
    for (const [key, id] of Object.entries(worldSelections) as [
      Selection,
      string,
    ][])
      if (after[key] !== before[key]) world.work(id);
  };
  for (const control of gen2.clickables) {
    const use = workedOnColumn(control);
    control.object.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      input(part, `VX3 ${control.unit}`, control.name, (hit) => {
        use(knobDirection(control.object, hit.point, perspectiveCamera));
        audio.play(gen2Cue(hit.object));
      });
    });
  }

  const board = createBoard();
  const flipMains = (from = '') => {
    if (world.work('board.NETZ')) write(`${from}NETZ contactor worked.`);
  };
  circuitBoard.onSound((event, sound, kind) => {
    if (sound === null) return;
    const cue =
      sound &&
      [
        'toggle-up',
        'toggle-down',
        'knob',
        'selector',
        'button',
        'key',
        'rocker',
        'breaker-on',
        'breaker-off',
        'door-open',
        'door-close',
      ].includes(sound)
        ? (sound as SoundCue)
        : kind === 'switch' || kind === 'toggle'
          ? event === 'off'
            ? 'toggle-down'
            : 'toggle-up'
          : kind === 'knob'
            ? 'knob'
            : 'button';
    audio.play(cue, 'monitor');
  });
  for (const [object, use] of circuitBoard.uses)
    object.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      input(
        part,
        'Circuit board',
        String(object.name || object.userData.label || 'Control'),
        (hit) => use(knobDirection(object, hit.point, perspectiveCamera)),
      );
    });
  // The board's cupboard doors are fittings, not machine controls.
  for (const [leaf, open] of circuitBoard.hatches)
    fixture(leaf, String(leaf.name), open);

  // CHEATS, inside the southern (XENON) bay's cupboard: open its door.
  // Each replaces the world with one that has played the designed steps
  // up to that point; AUTO plays them one control at a time.
  {
    const replaceWorld = (next: World) => {
      world = next;
      circuitBoard.restarted();
      autoStart = null;
      followTrim = false;
    };
    const cheats: [string, string, CapColour, () => void][] = [
      ['KALT', 'COLD · ALL OFF', 'grey', () => replaceWorld(createWorld())],
      [
        'AUTO',
        'SLOW START',
        'green',
        () => {
          replaceWorld(createWorld());
          autoStart = createAutoStart(coldStartSteps);
        },
      ],
      [
        'KESSEL',
        'VESSEL READY',
        'amber',
        () => replaceWorld(play(prepareVessel).world),
      ],
      [
        'VOLL',
        'FULL OPERATION',
        'blue',
        () => {
          replaceWorld(play(coldStartSteps).world);
          followTrim = true;
        },
      ],
      [
        'HEISS',
        'OVERHEATING',
        'amber',
        () => {
          replaceWorld(
            play([...coldStartSteps, ...overdrive, { id: 'wait', setting: 10 }])
              .world,
          );
          followTrim = true;
        },
      ],
      [
        'BRAND',
        'FIRE · RUINED',
        'red',
        () =>
          replaceWorld(
            play([...coldStartSteps, ...overdrive, { id: 'wait', setting: 40 }])
              .world,
          ),
      ],
    ];
    const plate = circuitBoard.compartment('XENON');
    if (plate) {
      const title = createMicroLabel(boardKit, 'CHEATS · NICHT IM SPIEL', {
        height: 0.018,
        plate: '#e8e2cc',
        ink: '#1f2622',
      });
      title.position.set(0, 0.17, 0.001);
      plate.add(title);
      cheats.forEach(([legend, hint, colour, act], i) => {
        // Two rows of three, to fit the cupboard.
        const x = ((i % 3) - 1) * 0.2;
        const y = i < 3 ? 0.05 : -0.11;
        const made = createEightiesButton(boardKit, legend, colour, {
          latching: false,
          size: 0.024,
        });
        made.group.scale.setScalar(2.4);
        made.group.position.set(x, y, 0);
        made.cap.name = `Cheat: ${hint.toLowerCase()}`;
        plate.add(made.group);
        const caption = createMicroLabel(boardKit, hint, {
          height: 0.011,
          ink: '#ece6d2',
        });
        caption.position.set(x, y - 0.048, 0.001);
        plate.add(caption);
        fixture(made.cap, made.cap.name, () => {
          made.press();
          audio.play('button', 'monitor');
          act();
          delayedPrinter.queue(`${made.cap.name.toUpperCase()}`);
        });
        dynamic.push(() => made.update(1 / 60));
      });
    }
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
        void audio.setTapeTransport(control.name);
        void audio.playCassetteButton(control.name);
        write(
          control.name === 'play'
            ? 'Kassettenspieler: Wiedergabe.'
            : control.name === 'stop'
              ? 'Kassettenspieler: Stopp.'
              : 'Kassettenspieler: Schneller Vorlauf (5×, Viertellautstärke).',
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
  for (const part of museum.doorParts) {
    doorParts.add(part);
    fixture(part, 'VX-Museum entrance', () => {
      museum.toggleDoor();
      audio.play('door-open');
    });
  }
  for (const part of museum.switchParts)
    fixture(part, 'Museum light switch', () => {
      const on = museum.toggleLights();
      audio.play('bakelite-switch');
      if (on) window.setTimeout(() => audio.play('ballast-start'), 90);
    });
  for (const [part, action] of museum.actions)
    fixture(part, 'Museum exhibit', () => {
      action();
      audio.play('button');
      const message = museum.status;
      if (message) write(message);
    });
  for (const part of plantRoom.gateParts) doorParts.add(part);
  for (const part of plantRoom.entryParts) doorParts.add(part);
  const withinReach = new Set<Object3D>([
    ...labRoom.door.parts,
    ...labRoom.lights.switchParts,
  ]);
  for (const part of labRoom.lights.switchParts)
    fixture(part, 'Light switch', () => {
      const on = labRoom.lights.toggle();
      audio.play('bakelite-switch');
      if (on) window.setTimeout(() => audio.play('ballast-start'), 90);
      write(
        on ? 'Lights on. The tubes take their time about it.' : 'Lights off.',
      );
    });
  dynamic.push(() => {
    ps1Uniforms.roomLight.value = 0.03 + 0.97 * labRoom.lights.level;
    ps1Uniforms.plantLight.value = 0.03 + 0.97 * plantRoom.lightLevel;
    for (const item of lamps)
      item.emissive.copy(item.color).multiply(item.color);
  });
  for (const part of labRoom.door.parts)
    fixture(part, 'Lab door', () => {
      const open = labRoom.door.toggle();
      // Just the latch: the recorded hinge creak was too loud and squeaky.
      audio.play('button');
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
  // Safety notices above the west-wall trunking, clear of the cabinet.
  const pinBoard = new Group();
  pinBoard.position.set(
    room.minX + 0.025 * worldUnitsPerMetre,
    floorY + 1.95 * worldUnitsPerMetre,
    room.minZ + 0.65 * worldUnitsPerMetre,
  );
  pinBoard.name = 'Safety pin-board';
  pinBoard.rotation.y = Math.PI / 2;
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
  const posterFrameDepth = 0.012;
  const posterFrameGap = 0.001; // Metres; the frame group scales to world units.
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
    cube(frame, 0.46, 0.67, posterFrameDepth, '#4b3e31', 0, 0, 0);
    const poster = createPrintedImageTexture(`/posters/${name}.webp`);
    textures.push(poster);
    const printedFace = new Mesh(
      new PlaneGeometry(0.42, 0.63),
      createPs1Material(
        {
          map: poster,
          // Keep the printed face ahead of the backing at grazing angles.
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        },
        true,
      ),
    );
    materials.push(printedFace.material);
    printedFace.position.z = posterFrameDepth / 2 + posterFrameGap;
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
  // About 2 cm motes once the unit is hung: big enough to see across the
  // room at full resolution.
  const sparkles = createCrystalSparkles(0.11);
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
  // The BBC starts switched off; its power switch turns the Cub on and off
  // with it. Switched on, it boots and loads the diagnostic disk.
  let benchOn = false;
  cub.power(false);
  input(bbc.resetTarget, 'Bench computer', 'Power switch', () => {
    benchOn = !benchOn;
    cub.power(benchOn);
    benchLastSeconds = performance.now() / 1000;
    cub.update(benchLastSeconds, [], false);
    if (!benchOn) {
      write('BBC Micro: ausgeschaltet.');
      return;
    }
    benchComputer.reset();
    void audio.playComputerBoot();
    write('BBC Micro: eingeschaltet. Betriebsdiagnose wird geladen.');
  });
  withinReach.add(bbc.resetTarget);
  dynamic.push(() => {
    const seconds = performance.now() / 1000;
    if (!benchOn) {
      // Off: a dark tube, and the disk drive's lamp out.
      benchLastSeconds = seconds;
      cub.update(seconds, [], false);
      diskDrive.update(0, reducedMotion.matches);
      return;
    }
    benchComputer.step(Math.min(0.1, seconds - benchLastSeconds));
    benchLastSeconds = seconds;
    const screen = benchScreen(
      {
        rig,
        xenonFlowSlpm: lineFlow(xenon.flowSlpm, recirculator.working),
        plantPowered: plantRoom.powered,
        rack: settings,
        permit: atmospherePermit(gen2.prep, recirculator.working),
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
  // Electrical breakdown lives on the column's face, in its local metres.
  const failureEmbers = [
    [-0.66, 1.45, 0.36],
    [-0.66, 0.85, 0.36],
    [0.69, 1.5, 0.39],
    [0.69, 0.9, 0.39],
  ].map(([x, y, z]) => {
    const effect = createEmbers(48, { spray: true });
    effect.group.position.set(x, y, z);
    effect.group.scale.setScalar(0.6);
    gen2.group.add(effect.group);
    return effect;
  });
  const failureArcs = [
    [-0.66, 1.1, 0.318, 0.44],
    [0.69, 1.15, 0.348, 0.5],
  ].map(([x, y, z, width], index) => {
    const effect = createElectricArcs({
      width,
      height: 1.3,
      arcs: 5,
      seed: index + 3,
    });
    effect.group.position.set(x, y, z);
    gen2.group.add(effect.group);
    return effect;
  });
  const failureStains = [
    [-0.66, 1.04, 0.315, 0.483, 1.74, 2],
    [0.69, 1.1, 0.345, 0.54, 1.84, 5],
  ].map(([x, y, z, width, height, seed]) => {
    const stain = createSmokeStains({ width, height, seed });
    stain.mesh.position.set(x, y, z);
    gen2.group.add(stain.mesh);
    return stain;
  });
  let soot = 0;
  let sootWorld = world;
  let arcStrikes = 0;
  const flames = {} as Record<
    'spindle' | 'field' | 'load',
    { flame: ReturnType<typeof createFlamePlume>; light: PointLight }
  >;
  for (const [channel, x, y, z] of [
    ['spindle', -0.66, 1.35, 0.38],
    ['field', 0.69, 1.4, 0.41],
    ['load', 0, 0.85, 0.66],
  ] as const) {
    const plume = heatSmoke[channel];
    plume.group.position.set(x, y, z);
    plume.group.scale.setScalar(0.65);
    gen2.group.add(plume.group);
    const flame = createFlamePlume();
    flame.group.position.set(x, y, z + 0.04);
    gen2.group.add(flame.group);
    const light = new PointLight('#ff6a17', 0, 4, 2);
    light.position.set(x, y + 0.15, z + 0.2);
    gen2.group.add(light);
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
  for (const part of plantRoom.entryParts) {
    withinReach.add(part);
    fixture(part, 'Plant room door', () => {
      const open = plantRoom.toggleEntry();
      audio.play('button');
      write(open ? 'Plant-room door opening.' : 'Plant-room door closing.');
    });
  }
  for (const part of plantRoom.powerParts) {
    withinReach.add(part);
    input(part, 'Plant-room supply', 'HAUPTSCHALTER', () => {
      if (!world.work('plant.master')) return;
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
      audio.play('bakelite-switch');
      if (on) window.setTimeout(() => audio.play('ballast-start'), 90);
      write(on ? 'Technikraum: Licht an.' : 'Technikraum: Licht aus.');
    });
  }
  for (const part of recirculator.switchParts) {
    withinReach.add(part);
    input(part, 'Xenon recirculator', 'KREISLAUF switch', () => {
      if (!world.work('recirculator.switch')) return;
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
      audio.play('button');
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
    world.work('xenon.regulator', setting);
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
  const enableXenon = () => {
    if (!world.read<boolean>('plant.powered')) world.work('plant.master');
    if (!world.read<boolean>('recirculator.switch'))
      world.work('recirculator.switch');
    if (!plantRoom.powered) plantRoom.togglePower();
    if (!recirculator.enabled) recirculator.toggle();
    plantRoom.openGate();
    if (world.read<number>('xenon.regulator') < 0.5)
      world.work('xenon.regulator', 0.5);
    if (xenon.setting < 0.5) xenon.setRegulator(0.5);
  };
  const enableLights = () => {
    if (!labRoom.lights.on) labRoom.lights.toggle();
    if (!plantRoom.lightsOn) plantRoom.toggleLights();
  };
  fixture(cheats.xenonButton, 'Cheat: xenon on', () => {
    enableXenon();
    audio.play('selector');
    write(
      'Cheat: plant supply on, recirculator switched on, xenon cage open; regulator at least 5 SLPM.',
    );
  });
  fixture(cheats.rectifierButton, 'Cheat: mercury arc rectifier on', () => {
    if (!world.read<boolean>('plant.powered')) world.work('plant.master');
    if (!plantRoom.powered) plantRoom.togglePower();
    audio.play('breaker-on', 'rectifier');
    write('Cheat: plant master supply on. Mercury arc struck.');
  });
  fixture(cheats.stageThreeButton, 'Cheat: Stage 3 complete', () => {
    enableLights();
    world = play(prepareVessel).world;
    circuitBoard.restarted();
    audio.play('button');
  });
  fixture(cheats.lightsButton, 'Cheat: lights on', () => {
    enableLights();
    audio.play('rocker');
  });
  dynamic.push(() =>
    cheats.update({
      xenon: xenonReady(lineFlow(xenon.flowSlpm, recirculator.working)),
      rectifier: plantRoom.powered,
      stageThree:
        gen2.running && atmospherePermit(gen2.prep, recirculator.working),
      lights: labRoom.lights.on && plantRoom.lightsOn,
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
    circuitBoard.group.position.z -
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
  // valves, spindle, field, monitors, service) are on the
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
      id: 'recirculator',
      x: recirculator.group.position.x,
      y: floorY + 0.8 * worldUnitsPerMetre,
      z: recirculator.group.position.z,
    },
    {
      id: 'rectifier',
      x: rectifier.group.position.x,
      y: floorY + worldUnitsPerMetre,
      z: rectifier.group.position.z,
    },
  ] satisfies Array<Emitter & { id: SoundSource }>;
  // Shut doors stop sound between the lab, the plant room and the corridor.
  const roomPlan = {
    lab: room,
    plant: plantRoom.bounds,
    museum: {
      minX: museum.group.position.x - 4.5 * worldUnitsPerMetre,
      maxX: museum.group.position.x + 4.5 * worldUnitsPerMetre,
      minZ: museum.group.position.z,
      maxZ: museum.group.position.z + 7.5 * worldUnitsPerMetre,
    },
  };
  // Rooms are culled whole: everything in the lab hangs under `lab`, and
  // the plant room is these four groups. The lab pieces placed straight in
  // the scene move under it, keeping their world positions.
  for (const object of [discharge]) lab.attach(object);
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
  overlay.innerHTML = `<div class="sound-controls"><button type="button" id="mute-sound" aria-pressed="false">SOUND ON</button><label for="sound-volume">VOL</label><input type="range" id="sound-volume" min="0" max="100" value="55" aria-label="Sound volume"><button type="button" id="reset-simulation" class="reset-simulation" title="Start again: a fresh, cold lab">Reset Simulation</button></div><div class="rack-nav" role="group" aria-label="Movement and zoom"><button type="button" data-pan="left" aria-label="Step left">◀</button><button type="button" data-pan="up" aria-label="Step forward">▲</button><span id="unit-readout"></span><button type="button" data-pan="down" aria-label="Step back">▼</button><button type="button" data-pan="right" aria-label="Step right">▶</button><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="in" aria-label="Zoom in">＋</button></div><aside class="logbook" hidden><div class="logbook-head"><strong>OPERATOR'S LOG</strong><button type="button" id="close-log" aria-label="Put the logbook away">×</button></div><ol id="log-entries"></ol></aside><button type="button" class="notebook-tab" id="open-log">▤ LOG <span id="unread-count"></span></button><p class="rack-help">CLICK: MOUSE LOOK · WASD: WALK · SHIFT: RUN · C: CROUCH · V: LOWER CROUCH · CLICK / E: USE · WHEEL: ZOOM · ALT+WHEEL: HEIGHT · ESC: CURSOR</p><div class="crosshair" aria-hidden="true" hidden></div>`;
  const fireStatus = document.createElement('div');
  fireStatus.style.cssText =
    'position:absolute;left:50%;top:16%;transform:translateX(-50%);z-index:10;text-align:center;color:#ffd6b1;background:#420b08dd;padding:12px 20px;font:700 22px monospace;letter-spacing:2px;pointer-events:auto';
  fireStatus.hidden = true;
  const ruinTitle = document.createElement('div');
  ruinTitle.textContent = 'FIRE OUT · VX3 DESTROYED';
  const ruinHint = document.createElement('div');
  ruinHint.textContent = 'Reset Simulation (top left) to start again.';
  ruinHint.style.cssText =
    'font:400 13px monospace;letter-spacing:1px;margin-top:6px';
  fireStatus.append(ruinTitle, ruinHint);
  overlay.append(fireStatus);
  // Resetting is always by hand: a ruined machine stays ruined until the
  // operator asks for a fresh, cold lab. The room's lights are left alone.
  const resetSimulation = () => {
    world = createWorld();
    circuitBoard.restarted();
    autoStart = null;
    followTrim = false;
    Object.assign(fire, createFireIncident());
    Object.assign(overheat, createOverheatState());
    Object.assign(telltales, createSafetyTelltales());
    Object.assign(board, createBoard());
    Object.assign(settings, createRackControls());
    Object.assign(rig, createRig());
    fireStatus.hidden = true;
    write('Simulation reset. VX3 cold.');
    delayedPrinter.queue('SIMULATION RESET · VX3 COLD');
  };
  overlay
    .querySelector<HTMLButtonElement>('#reset-simulation')!
    .addEventListener('click', resetSimulation);
  const manualSheet = document.createElement('aside');
  manualSheet.className = 'manual-sheet';
  manualSheet.hidden = true;
  manualSheet.innerHTML = `<div class="manual-head"><strong id="manual-title"></strong><button type="button" aria-label="Close reference sheet">×</button></div><pre id="manual-content"></pre><small>UNIVERSITÄT LEIPZIG · VX3-LABOR RAUM −2.17 · FOR EDUCATIONAL USE ONLY</small>`;
  overlay.append(manualSheet);
  canvas.parentElement?.append(overlay);
  const manualPages = [
    {
      title: 'OPERATING GUIDE / VX3 COLD START',
      content:
        'TECHNIKRAUM\n1  HAUPTSCHALTER closed. KREISLAUF on.\n2  Xenon cage open; regulator 2 SLPM or more.\nSUPPLY (each cabinet: power in its base)\n3  Isolator on the west wall ON.\n4  A11 NETZ button. B13 rocker on.\nVESSEL (B11 SÄULE)\n5  SENKEN; wait for UNTEN. SPANNEN.\n6  XE EIN, beam-tube outlet open:\n   purge to O2 = 0. Outlet shut:\n   KAMMERDRUCK over 1.2 bar.\nEAST BOARD\n7  NETZ on. Heaters warm; core glows.\n   If not, read the alarm row.\nDRIVE (B6 ANTRIEB)\n8  DREHZAHL, FELD up; TRIMM to SOLL.\n   Core to full power.\n\nNEVER heat an open or unpurged chamber.\nQUITT (B11) or RÜCKS. fits a fresh core.',
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
  const write = (text: string) => {
    if (quiet) return;
    // Lines written while a control is worked carry its name.
    const line = pressed
      ? text
        ? `${pressed} — ${text}`
        : `${pressed}.`
      : text;
    pressed = null;
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
  write('Lab opened. VX3 cold. For educational use only.');
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
  // The plant room is drawn on layer 1 for its own lighting; the pointer
  // must see it too, or none of its controls can be worked.
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
  // A repeatable development inspection of the real lab's fire effects.
  // Enter the frame at ignition so the sprinklers and final transition can
  // be watched at their actual pace, instead of waiting through cold start.
  if (import.meta.env.DEV && inspectionParams.get('scenario') === 'fire') {
    world = play([...coldStartSteps, ...overdrive]).world;
    for (let i = 0; i < 1200 && !world.read('fire.ruined'); i++)
      world.tick(0.1, () => 0.5);
    circuitBoard.restarted();
  }
  // Inspection views (?view=…), each standing the walker in front of one
  // installation in the game. Only views of dev-only spaces carry a dev_
  // prefix; these are all part of the real game, so none does.
  const inspectionView = inspectionParams.get('view');
  // `lighs` too: an easy slip, and the link still works.
  if (
    inspectionParams.get('lights') === 'on' ||
    inspectionParams.get('lighs') === 'on'
  ) {
    labRoom.lights.toggle();
  }
  // ?slowstart=on: the whole cold start played from cold, one control at
  // a time, as the AUTO cheat does, to watch the full cycle.
  if (inspectionParams.get('slowstart') === 'on') {
    autoStart = createAutoStart(coldStartSteps);
    write('Automatic cold start: one control at a time.');
  }
  if (inspectionParams.get('plant-lights') === 'on') plantRoom.toggleLights();
  if (inspectionParams.get('museum-lights') === 'on') museum.toggleLights();
  // Named viewpoints: shareable inspection links (?view=rack) and the
  // teleport board's destinations.
  const viewpoints: Record<string, () => void> = {
    'museum-north': () => {
      walker.x = museum.group.position.x - 1.0 * metre;
      walker.z = museum.group.position.z + 2.4 * metre;
      orbitYaw = 0;
      orbitPitch = 0;
    },
    'museum-switch': () => {
      walker.x = museum.group.position.x - 3.55 * metre;
      walker.z = museum.group.position.z + 1.2 * metre;
      orbitYaw = 0;
      orbitPitch = -0.32;
    },
    'museum-door': () => {
      walker.x = museumEntry.x;
      walker.z = museumEntry.z - 1.4 * metre;
      orbitYaw = Math.PI;
      orbitPitch = -0.08;
    },
    museum: () => {
      walker.x = museum.group.position.x - 2.475 * metre;
      walker.z = museumEntry.z + 1.35 * metre;
      orbitYaw = Math.PI;
      orbitPitch = -0.05;
    },
    cheats: () => {
      walker.x = cheats.group.position.x - 0.1575 * metre;
      walker.z = cheats.group.position.z + 1.4 * metre;
      orbitYaw = 0;
      orbitPitch = Math.atan2(1.334375 - 1.8034, 1.4);
    },
    'safety-notices': () => {
      walker.x = room.minX + 1.4 * metre;
      walker.z = pinBoard.position.z;
      orbitYaw = -Math.PI / 2;
      orbitPitch = Math.atan2(1.95 - 1.8034, 1.4);
    },
    'control-panel': () => {
      walker.x = room.maxX - 2.8 * metre;
      walker.z = circuitBoard.group.position.z;
      orbitYaw = Math.PI / 2;
      orbitPitch = -0.16;
    },
    column: () => {
      walker.x = gen2.group.position.x;
      walker.z = gen2.group.position.z + 2.4 * metre;
      orbitYaw = 0;
      orbitPitch = -0.2;
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
    cassette: () => {
      walker.x = workbench.cassette.group.position.x + 1.4 * metre;
      walker.z = workbench.cassette.group.position.z + 0.15 * metre;
      orbitYaw = -Math.PI / 2;
      orbitPitch = -Math.atan2(1.8034 - 0.9 - 0.324, 1.4);
    },
    computer: () => {
      walker.x = bbc.group.position.x - 0.4 * worldUnitsPerMetre;
      walker.z = bbc.group.position.z + 0.95 * worldUnitsPerMetre;
      orbitYaw = 0.4;
      orbitPitch = -0.65;
      cameraZoom = 1.2;
    },
    chair: () => {
      walker.x = chair.group.position.x + 0.55 * worldUnitsPerMetre;
      walker.z = chair.group.position.z + 1.25 * worldUnitsPerMetre;
      orbitYaw = -0.42;
      orbitPitch = -0.72;
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
        window.location.assign('/?room=dev0');
        return;
      }
      destinations.forEach((_, i) => teleports.show(i, i === index));
      goTo(view);
      write(`Teleport: ${caption.toLowerCase()}.`);
    });
  });
  const corridorRoots = [
    corridor.group,
    devPassages.group,
    cheats.group,
    teleports.group,
    hotline.group,
    firePanel,
    hallBeacon,
  ];

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
    // Every control on the column needs its own name for the log.
    const names = gen2.clickables.map((c) => `${c.unit}: ${c.name}`);
    const repeated = names.filter((n, i) => names.indexOf(n) !== i);
    if (repeated.length)
      console.error(
        `Repeated control names on the column: ${repeated.join(', ')}`,
      );
    const problems = auditParts(partsInScene());
    if (problems.length)
      console.error(`Machine part designations:\n${problems.join('\n')}`);
  }
  if (import.meta.env.DEV)
    Object.assign(window, {
      vx3Walker: {
        walker,
        /** What the teletype has printed, oldest first. */
        printed: () => [...teleprinterLines],
        /** The world model the lab runs on, for scripts. */
        world: () => world,
        /** How many of the time-dilation crystal's sparks are in the air. */
        sparks: () =>
          sparkles.group.children.filter((child) => child.visible).length,
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
        /** The VX3 (the column and its cabinets) and its xenon bank. */
        gen2,
        xenon,
        recirculator,
        settings,
        board: () => ({
          lit: annunciators
            .filter((_, i) => board.alarms[i] !== 'normal')
            .map((window) => window.label),
        }),
        /** Close or open the east board's NETZ contactor. */
        netz: () => flipMains('Test: '),
        /**
         * Work a control by the name the log gives it ("machine: control"),
         * or a room fitting by its name, as a click on it would.
         */
        press(name: string, direction = 1) {
          let found: Object3D | undefined;
          scene.traverse((object) => {
            if (found || !actions.has(object.id)) return;
            const part = designationOf(object);
            const label = part
              ? `${part.machine}: ${part.name}`
              : fixtureOf(object);
            if (label === name) found = object;
          });
          if (!found) return false;
          // Click on the right half (direction 1) or left half (-1) as seen
          // from the camera, so knobs turn the intended way.
          const at = found
            .getWorldPosition(new Vector3())
            .add(
              new Vector3(
                direction * 0.05 * worldUnitsPerMetre,
                0,
                0,
              ).applyQuaternion(perspectiveCamera.quaternion),
            );
          actions.get(found.id)?.({
            object: found,
            point: at,
            distance: 1,
          } as Intersection);
          return true;
        },
        /**
         * Stand `metres` in front of a control (by its log name or a fixture
         * name), looking straight at it, for screenshots.
         */
        standAt(name: string, metres = 1.2, crouch = false) {
          let found: Object3D | undefined;
          scene.traverse((object) => {
            if (found || !actions.has(object.id)) return;
            const part = designationOf(object);
            const label = part
              ? `${part.machine}: ${part.name}`
              : fixtureOf(object);
            if (label === name) found = object;
          });
          if (!found) return false;
          const at = found.getWorldPosition(new Vector3());
          const out = new Vector3(0, 0, 1)
            .applyQuaternion(found.getWorldQuaternion(new Quaternion()))
            .setY(0)
            .normalize();
          walker.x = at.x + out.x * metres * worldUnitsPerMetre;
          walker.z = at.z + out.z * metres * worldUnitsPerMetre;
          walker.crouched = crouch;
          walker.lowCrouched = false;
          walker.crouch = crouch ? 1 : 0;
          cameraZoom = 1;
          const eye = eyeY - (crouch ? 0.65 * worldUnitsPerMetre : 0);
          orbitYaw = Math.atan2(-out.x, out.z);
          orbitPitch = Math.atan2(at.y - eye, metres * worldUnitsPerMetre);
          return true;
        },
        /** Where a control is, by its log name, in world units. */
        where(name: string) {
          let at: Vector3 | undefined;
          scene.traverse((object) => {
            const part = designationOf(object);
            const label = part
              ? `${part.machine}: ${part.name}`
              : fixtureOf(object);
            if (!at && label === name && actions.has(object.id))
              at = object.getWorldPosition(new Vector3());
          });
          return at;
        },
        /** The world bounds of every registered mesh of a control. */
        bounds(name: string) {
          const out: string[] = [];
          scene.traverse((object) => {
            const part = designationOf(object);
            const label = part
              ? `${part.machine}: ${part.name}`
              : fixtureOf(object);
            if (label !== name || !(object instanceof Mesh)) return;
            const b = new Box3().setFromObject(object);
            out.push(
              `${b.min.toArray().map((v) => v.toFixed(2))} → ${b.max.toArray().map((v) => v.toFixed(2))} ${object.visible} ${interactive.includes(object)}`,
            );
          });
          return out;
        },
        /** Everything the crosshair's ray passes through, nearest first. */
        ray() {
          pointer.set(0, 0);
          raycaster.setFromCamera(pointer, perspectiveCamera);
          return raycaster
            .intersectObjects(scene.children, true)
            .slice(0, 6)
            .map((hit) => ({
              d: +hit.distance.toFixed(2),
              clickable: actions.has(hit.object.id),
              name:
                designationOf(hit.object)?.name ??
                fixtureOf(hit.object) ??
                hit.object.parent?.name ??
                '',
              visible: hit.object.visible,
            }));
        },
        /** What the crosshair would work now, by its log name. */
        aimedAt() {
          const hit = target();
          if (!hit) return null;
          const part = designationOf(hit.object);
          return part ? `${part.machine}: ${part.name}` : fixtureOf(hit.object);
        },
        /** The newest operator's log lines, newest first. */
        log: () =>
          [...entries.children].slice(0, 8).map((item) => item.textContent),
        /** Sit in the chair at the BBC, as clicking it does. */
        sit: sitAtComputer,
        chair: () => chair.group.position.clone(),
        rig,
        lights: labRoom.lights,
        plantRoom,
        /** Every machine with its inputs and indicators, and any problems. */
        parts: () => ({
          machines: Object.fromEntries(partInventory(partsInScene())),
          problems: auditParts(partsInScene()),
        }),
        controlPanel: () => ({
          x: circuitBoard.group.position.x,
          z: circuitBoard.group.position.z,
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
    const scale = renderScale(width, height);
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
  const roomLighting = createRoomLighting();
  // These fittings face the corridor and were parented to the lab for
  // placement convenience. Move them to the scene before declaring rooms.
  for (const root of [cheats.group, teleports.group, hotline.group])
    scene.attach(root);
  const labLighting = roomLighting.defineRoom('lab', ps1Uniforms.roomLight);
  const plantLighting = roomLighting.defineRoom(
    'plant',
    ps1Uniforms.plantLight,
  );
  const corridorLighting = roomLighting.defineRoom('corridor', { value: 1 });
  const museumLighting = roomLighting.defineRoom('museum', museum.lighting);
  roomLighting.registerRoot(labLighting, lab);
  for (const root of plantGroups)
    roomLighting.registerRoot(plantLighting, root);
  for (const root of corridorRoots)
    roomLighting.registerRoot(corridorLighting, root);
  roomLighting.registerRoot(museumLighting, museum.group);
  const roomAudit = roomLighting.audit(scene);
  if (
    import.meta.env.DEV &&
    (roomAudit.unowned.length || roomAudit.multiplyOwned.length)
  )
    console.warn(
      'Room lighting ownership audit',
      roomAudit.unowned.length,
      'unowned:',
      roomAudit.unowned
        .map((mesh) => mesh.name || mesh.parent?.name || '(unnamed)')
        .join(', '),
      roomAudit.multiplyOwned.length,
      'multiply owned:',
      roomAudit.multiplyOwned
        .map((mesh) => mesh.name || mesh.parent?.name || '(unnamed)')
        .join(', '),
    );
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let last = 0;
  let nextFireCue = 0;
  renderer.setAnimationLoop((time) => {
    if (canvas.parentElement?.hidden) {
      last = 0;
      return;
    }
    const delta = last ? Math.min(0.1, (time - last) / 1000) : 0;
    last = time;
    // One graph tick is the machine's only simulation step. The room's
    // objects below are views of its outputs, including the old room fittings.
    // The cheats' automatic start, and TRIMM kept on SOLL after a cheat.
    const extra: WorldEvent[] = [];
    if (autoStart) {
      const step = autoStart.advance(world, delta);
      extra.push(...step.events);
      if (step.line) write(step.line);
      if (autoStart.done) {
        autoStart = null;
        followTrim = true;
      }
    }
    if (followTrim) {
      const want = Math.round(world.read<number>('drive.idealTrim') * 20) / 20;
      if (world.read('drive.trim') !== want) world.work('drive.trim', want);
    }
    const events = [...extra, ...world.tick(delta)];
    const extinguished = world.read<string>('fire.phase') === 'extinguished';
    for (const [key, id] of Object.entries(worldSelections) as [
      Selection,
      string,
    ][])
      if (gen2.powerSelections[key] !== world.read<boolean>(id))
        supplySwitches.get(key)?.();
    const prep = gen2.prep;
    prep.liftTarget = world.read('vessel.liftTarget');
    prep.lift = world.read('vessel.lift');
    prep.clamped = world.read('vessel.clamped');
    prep.inletOpen = world.read('vessel.inletOpen');
    prep.outletOpen = world.read('vessel.outletOpen');
    prep.air = extinguished ? 0 : world.read('vessel.air');
    prep.xenon = extinguished ? 0 : world.read('vessel.xenon');
    prep.supply = extinguished ? 0 : world.read('vessel.supply');
    prep.temperature = extinguished ? 0 : world.read('vessel.temperature');
    prep.failure = world.read('vessel.failure');
    prep.spinRate = extinguished ? 0 : world.read('vessel.spinRate');
    prep.spinAngle = world.read('vessel.spinAngle');
    rig.controls = structuredClone(world.read('drive.controls'));
    rig.heater = world.read('rig.heater');
    rig.spindle = world.read('rig.spindle');
    rig.field = world.read('rig.field');
    rig.drift = world.read('rig.drift');
    rig.instability = world.read('rig.instability');
    rig.strain = world.read('rig.strain');
    rig.strainFrom = structuredClone(world.read('rig.strainFrom'));
    rig.incidents = world.read('rig.incidents');
    prep.setpoint = extinguished ? 0 : Math.min(4000, driveTemperature(rig));
    prep.brightness = extinguished ? 0 : driveBrightness(rig);
    gen2.drive.power = !extinguished && world.read('drive.mains');
    settings.mains = world.read('drive.mains');
    for (const id of [
      'ht',
      'lt',
      'spin',
      'hb',
      'damp',
      'gnd',
      'aux1',
      'aux2',
      'xtalA',
      'xtalB',
      'xtalC',
    ] as const)
      settings.toggles[id] = world.read(`drive.${id}`);
    for (const id of [
      'spindle',
      'field',
      'trim',
      'ratio',
      'insulationBand',
    ] as const)
      settings.knobs[id] = world.read(`drive.${id}`);
    telltales.powerKw = world.read('telltales.powerKw');
    telltales.energyKwh = world.read('telltales.energyKwh');
    telltales.dilationActivity = world.read('telltales.dilation');
    telltales.crystalPulse = world.read('telltales.crystalPulse');
    telltales.pulsePhase = world.read('telltales.pulsePhase');
    Object.assign(overheat, world.read('overheat'));
    Object.assign(fire, world.read('fire'));
    board.alarms = [...world.read<typeof board.alarms>('board.alarms')];
    if (plantRoom.powered !== world.read<boolean>('plant.powered'))
      plantRoom.togglePower();
    if (recirculator.enabled !== world.read<boolean>('recirculator.switch'))
      recirculator.toggle();
    if (xenon.setting !== world.read<number>('xenon.regulator'))
      xenon.setRegulator(world.read('xenon.regulator'));
    plantRoom.update(delta, reducedMotion.matches, telltales.powerKw);
    rectifier.update(plantRoom.powered, time / 1000, reducedMotion.matches);
    gen2.update(time / 1000, delta, reducedMotion.matches);
    audio.updateColumn(prep);
    audio.setPlantPower(plantRoom.powered);
    audio.setRecirculator(recirculator.working);
    for (const channel of ['spindle', 'field', 'load'] as const)
      heatSmoke[channel].update(
        time / 1000,
        overheat.smoke[channel],
        reducedMotion.matches,
      );
    for (const channel of ['spindle', 'field', 'load'] as const) {
      const { flame, light } = flames[channel];
      const burning = fire.burning[channel] && !extinguished;
      flame.update(time / 1000, burning ? 1 : 0, reducedMotion.matches);
      light.intensity = burning ? 9 + 3 * Math.sin(time * 0.013) : 0;
    }
    const hot = Math.max(...Object.values(overheat.smoke));
    const sparking = fire.ruinCause
      ? extinguished
        ? 0
        : 1
      : Math.max(0, Math.min(1, (hot - 0.4) / 0.4));
    for (const effect of failureEmbers)
      effect.update(time / 1000, sparking, reducedMotion.matches);
    const arcing = fire.ruinCause
      ? extinguished
        ? 0
        : Math.max(0, 1 - fire.ruinAge / 3)
      : Math.max(0, Math.min(1, (hot - 0.3) / 0.5));
    let strikes = 0;
    for (const effect of failureArcs) {
      effect.update(delta, arcing, reducedMotion.matches);
      strikes += effect.strikes;
    }
    if (strikes > arcStrikes) audio.play('spark', 'monitor');
    arcStrikes = strikes;
    if (world !== sootWorld) {
      sootWorld = world;
      soot = 0;
    }
    soot = Math.max(soot, fire.ruinCause ? 1 : Math.min(1, hot / 0.8));
    for (const stain of failureStains) stain.set(soot * 0.9);
    // A change in the machine's status: in the log, and on the teletype.
    const status = (text: string) => {
      write(text);
      delayedPrinter.queue(
        `${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}  ${text}`,
      );
    };
    for (const event of events) {
      if (event.source === 'fire') {
        if (event.event === 'alarm') {
          audio.play('warning');
          status('Smoke detector: FIRE ALARM. Evacuate the lab.');
        } else if (event.event === 'water') {
          audio.play('relay', 'sprinkler');
          status('Sprinklers open. Water on the lab floor.');
        } else if (event.event === 'fire') {
          audio.play('incident');
          status('Equipment fire detected. Sprinklers triggered.');
        } else if (event.event === 'extinguished') {
          status('FIRE OUT. Installation destroyed; instruments at zero.');
        } else if (event.event === 'water-stopped') {
          status('Sprinkler supply shut off automatically after 45 seconds.');
        }
      } else if (event.source === 'rig') {
        if (event.event.kind === 'incident') {
          audio.play('incident');
          status(event.event.text);
        } else if (event.event.kind === 'warmed')
          status('Heaters at temperature.');
        else if (event.event.kind === 'field-locked')
          status('H-B field locked.');
        else status('H-B field wandering. Strain rising.');
      } else if (
        event.source === 'vessel' &&
        event.event.kind === 'catastrophe'
      ) {
        audio.play('incident');
        status(`Core catastrophe: ${event.event.cause}.`);
      } else if (event.source === 'breaker') {
        status(`Drive breaker dropped: ${event.event.cause} supply off.`);
      } else if (event.source === 'plant') {
        status('VX3 fully operational.');
      }
    }
    const beaconPulse =
      fire.alarm && !extinguished && Math.sin(time * 0.006) > 0;
    labRoom.setFireAlarm(fire.alarm && !extinguished);
    showFireLcd(
      extinguished ? 'extinguished' : fire.alarm ? 'alarm' : 'normal',
    );
    labBeacon.intensity = beaconPulse ? 20 : 0;
    hallBeacon.intensity = beaconPulse ? 14 : 0;
    discharge.intensity =
      fire.water &&
      (rig.controls.mains || fire.ruinCause === 'short') &&
      Math.sin(time * 0.035) > 0.7
        ? 30
        : 0;
    if (fire.alarm && !extinguished && time >= nextFireCue) {
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
    fireStatus.hidden = !extinguished;
    // The machine's effects on the room, from the world model, as in dev0.
    const activity = ferrocoreActivity(rig);
    effectSeconds += delta;
    const wreckedRun = world.read('fire.ruined') !== null;
    fullActivation = wreckedRun
      ? 0
      : fullActivation +
        ((world.read<boolean>('plant.fullyOperational') ? 1 : 0) -
          fullActivation) *
          Math.min(1, delta / 3);
    let effects = effectFrame(
      settingsForMachine({
        activity: wreckedRun ? 0 : world.read<number>('ferrocore.activity'),
        // From the redline to critical: how hot the drive has got.
        overheat: wreckedRun
          ? 0
          : Math.min(
              1,
              Math.max(
                ...Object.values(
                  world.read<{ heat: Record<string, number> }>('overheat').heat,
                ),
              ) / 0.9,
            ),
        full: fullActivation,
        instability: world.read<number>('rig.instability'),
        // Centred on the column, in metres.
        centreX: gen2.group.position.x / worldUnitsPerMetre,
        centreZ: gen2.group.position.z / worldUnitsPerMetre,
      }),
      effectSeconds,
    );
    if (reducedMotion.matches) effects = stillFrame(effects);
    applyEffectFrame(effects, worldUnitsPerMetre, effectSeconds);
    ps1Uniforms.time.value = effectSeconds;
    anomaly = { ...anomaly, channels: effects.channels, pi: effects.pi };
    sparkles.group.visible = !reducedMotion.matches;
    sparkles.update(
      delta,
      reducedMotion.matches || telltales.dilationActivity === 0
        ? 0
        : 6 + telltales.dilationActivity * 30,
      2.6,
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
    circuitBoard.update(delta);
    audio.update(rig, settings, reducedMotion.matches);
    delayedPrinter.step(delta);
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
      ...museum.solids,
      ...(museum.doorBlocking ? [museum.doorFootprint] : []),
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
    museum.update(delta, time / 1000, reducedMotion.matches);
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
      walker.z > museumEntry.z &&
      walker.x > museum.group.position.x - 4.5 * metre &&
      walker.x < museum.group.position.x + 4.5 * metre
        ? 'VX-MUSEUM · SEKTION PHYSIK'
        : walker.z > room.maxZ
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
    audio.setFluorescent(
      listenerRoom === 'lab'
        ? labRoom.lights.level
        : listenerRoom === 'plant'
          ? plantRoom.lightLevel
          : 0,
    );
    // Draw only the rooms that can be seen from here. Collision was taken
    // from the whole scene on the first frame, before anything was hidden.
    const shown = visibleRooms(listenerRoom, {
      lab: labRoom.door.amount,
      plant: plantRoom.entryAmount,
      museum: museum.doorAmount,
    });
    lab.visible = shown.lab;
    for (const group of plantGroups) group.visible = shown.plant;
    museum.group.visible = shown.museum;
    const doorOpenings = {
      lab: labRoom.door.amount,
      plant: plantRoom.entryAmount,
      museum: museum.doorAmount,
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
    // Red and blue disagree as the machine nears activation, swelling and
    // falling away; set in PS1 pixels, scaled to what is drawn.
    const split =
      (renderer.domElement.width / 640) * divergencePulse(effectSeconds);
    const diverged = {
      ...effects.divergence,
      horizontalPx: effects.divergence.horizontalPx * split,
      verticalPx: effects.divergence.verticalPx * split,
      parallax: effects.divergence.parallax * split,
    };
    if (divergence.active(diverged))
      divergence.render(scene, viewer, diverged, effectSeconds);
    else renderer.render(scene, viewer);
  });
  const dispose = () => {
    renderer.setAnimationLoop(null);
    divergence.dispose();
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
    for (const { flame } of Object.values(flames)) flame.dispose();
    for (const effect of failureEmbers) effect.dispose();
    for (const effect of failureArcs) effect.dispose();
    for (const stain of failureStains) stain.dispose();
    for (const { spray } of sprinklerEffects) spray.dispose();
    xenon.dispose();
    recirculator.dispose();
    sparkles.dispose();
    plantRoom.dispose();
    rectifier.dispose();
    cheats.dispose();
    teleports.dispose();
    hotline.dispose();
    labRoom.dispose();
    devPassages.dispose();
    museum.dispose();
    roomLighting.dispose();
    corridor.dispose();
    toolRack.dispose();
    cub.dispose();
    bbc.dispose();
    chair.dispose();
    gen2.dispose();
    diskDrive.dispose();
    userGuide.dispose();
    workbench.dispose();
    circuitBoard.dispose();
    disposeKit(boardKit, circuitBoard.group);
    teleprinter.dispose();
    overlay.remove();
    scene.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    for (const item of materials) item.dispose();
    for (const item of textures) item.dispose();
    freeEnvironment();
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
