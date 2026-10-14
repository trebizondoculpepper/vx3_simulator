import {
  createRenderer,
  realistic,
  renderScale,
  useEnvironment,
} from './render-style';
import { devDoors, devWallPieces } from '../game/dev-room-links';
import { createDevDoorways } from '../scene/dev-doorways';
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  DirectionalLight,
  Group,
  Mesh,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
} from 'three';
import type { Material, Object3D } from 'three';
import { knobDirection } from '../scene/rotary-knob';
import { createFirstPerson } from './first-person';
import type { Footprint } from '../game/walk-collision';
import { createPs1Material, ps1Uniforms } from './ps1-material';
import { createFerrocoreColumnRig } from '../scene/ferrocore-column-rig';
import type { CoreVoiceScene } from '../audio/core-voice-render';
import { createSoundEngine } from '../audio/sound-engine';
import type { SoundCue } from '../audio/sound-engine';
import { createPartLoops } from '../audio/part-loops';
import type { PartEvent } from '../game/world/components';
import { createRackControls } from '../game/rack-controls';
import type { RackControls } from '../game/rack-controls';
import type { Catastrophe } from '../game/column-prep';
import { driveBrightness, driveTemperature } from '../game/cold-start';
import type { RigState } from '../game/rig';
import { createWorld } from '../game/world/world';
import type { WorldEvent } from '../game/world/world';
import type { ControlSound } from '../audio/rig-sounds';
import {
  createMicroLabel,
  createPanelKit,
  disposeKit,
} from '../scene/eighties-controls';
import { createColdStartBoard } from './dev-cold-start-board';

/**
 * The developer room: not part of the game. A plain, evenly lit room
 * reached at `/?room=dev0`, where new apparatus and parts are built and
 * looked at before they go into the lab. Drag to orbit, scroll to zoom,
 * right-drag to pan, click a button cap to press it. P switches between the
 * game's low PS1 resolution and the screen's own, for reading small print.
 */
/** The lab's sound cues a part may name for itself. */
const SOUND_CUES = [
  'toggle-up',
  'toggle-down',
  'knob',
  'selector',
  'button',
  'key',
  'rocker',
  'bakelite-switch',
  'breaker-on',
  'breaker-off',
  'relay',
] as const satisfies readonly SoundCue[];

/** The usual sound of a kind of part doing something, if it has one. */
function defaultCue(part: string, event: PartEvent): SoundCue | null {
  if (event === 'refused') return 'selector';
  if (event === 'end-stop') return null;
  if (part === 'toggle') return event === 'off' ? 'toggle-down' : 'toggle-up';
  if (part === 'knob') return 'knob';
  return CONTROL_CUES[part as ControlSound] ?? 'button';
}

/** The lab's sound for each kind of panel part. */
const CONTROL_CUES: Partial<Record<ControlSound, SoundCue>> = {
  button: 'button',
  key: 'key',
  toggle: 'toggle-up',
  rocker: 'rocker',
  'key-switch': 'selector',
  knob: 'knob',
  selector: 'selector',
  locked: 'selector',
  slide: 'toggle-up',
  isolator: 'breaker-on',
};

/**
 * Where the walker starts, unless a door brought them: back by the south
 * wall, far enough to see the whole column with the KALTSTART board
 * beside it, angled to face this spot.
 */
const START = {
  x: 1.2,
  z: 4.6,
  // Looking at a point between the column and the desk.
  yaw: Math.atan2(0.4, 4.0),
  pitch: Math.atan2(-0.6, Math.hypot(0.4, 4.0)),
};
/**
 * The KALTSTART desk, right of the column: a sloping top like the effects
 * room's, tilted back from upright by `tilt` radians, at `top` metres.
 */
const DESK = { x: 2.8, z: 1.2, scale: 0.75, tilt: 1.15, top: 0.95 };

export function startDevRoom(canvas: HTMLCanvasElement) {
  const renderer = createRenderer(canvas);
  const scene = new Scene();
  // Realistic style: soft light and reflections from every side.
  const freeEnvironment = useEnvironment(renderer, scene, 0.5);
  const camera = new PerspectiveCamera(52, 1, 0.01, 60);

  scene.background = null;
  renderer.setClearColor('#2b2d2c');
  scene.add(new AmbientLight('#fff4e2', 1.6));
  const key = new DirectionalLight('#fff0d0', 2.2);
  key.position.set(-2, 4, 5);
  scene.add(key);
  const rim = new DirectionalLight('#9fb2c0', 0.8);
  rim.position.set(3, 2, -4);
  scene.add(rim);

  // The room: a grey floor ruled in metres, three walls and a sign.
  const materials: Material[] = [];
  const room = new Group();
  scene.add(room);
  const block = (
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
    parent: Object3D = room,
  ) => {
    const material = createPs1Material({ color });
    materials.push(material);
    const mesh = new Mesh(new BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const size = 10;
  block(size, 0.1, size, '#5d605c', 0, -0.05, 0);
  for (let i = -size / 2; i <= size / 2; i++) {
    block(0.012, 0.002, size, '#494b48', i, 0.001, 0);
    block(size, 0.002, 0.012, '#494b48', 0, 0.001, i);
  }
  const bounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };
  const doors = devDoors('dev0', bounds, 1);
  const walls = devWallPieces(bounds, doors, 1, 3.2);
  for (const wall of walls)
    block(
      wall.maxX - wall.minX,
      wall.top - wall.bottom,
      wall.maxZ - wall.minZ,
      '#80837e',
      (wall.minX + wall.maxX) / 2,
      (wall.top + wall.bottom) / 2,
      (wall.minZ + wall.maxZ) / 2,
    );
  const passages = createDevDoorways('dev0', doors, 0, 1);
  scene.add(passages.group);
  const kit = createPanelKit();
  const sign = createMicroLabel(
    kit,
    'DEVELOPER ROOM  ·  NOT PART OF THE GAME',
    { height: 0.09, plate: '#20302b', ink: '#e8e2cc' },
  );
  sign.position.set(0, 2.95, -size / 2 + 0.06);
  room.add(sign);

  // The concept rig, centre stage.
  const columnLog: string[] = [];
  // State sounds the parts hold, such as a hum while a switch is on.
  const loops = createPartLoops();
  // The world model: the lab's machine as a graph (src/game/world/). It
  // drives the concept rig, which only shows it; the cold-start board
  // below works it.
  let world = createWorld();
  const rig = createFerrocoreColumnRig({
    // As in the lab: its own switches start off, and it is dead without
    // the plant room's supply.
    switchedOn: false,
    supplied: () => world.read<boolean>('plant.powered'),
    log(text) {
      columnLog.unshift(text);
      columnLog.length = Math.min(columnLog.length, 4);
      console.debug(text);
    },
  });
  scene.add(rig.group);
  // The rig's own physics are held: the world model moves it.
  rig.drive.hold = true;
  // Audit the panels: parts must clear each other and the panel edges.
  for (const problem of rig.layoutProblems())
    console.warn(`Panel layout: ${problem}`);
  const rigNote = createMicroLabel(
    kit,
    'VX3 FERROCORE COLUMN  ·  DRIVEN BY THE GRAPH WORLD MODEL',
    { height: 0.03, plate: '#e8e4d4', ink: '#222' },
  );
  rigNote.position.set(0, 0.06, 0.62);
  rigNote.rotation.x = -Math.PI / 2;
  room.add(rigNote);

  // The CONTROL TEST board of panel parts is in dev2, the parts room.

  const note = (text: string) => {
    columnLog.unshift(text);
    columnLog.length = Math.min(columnLog.length, 4);
    console.debug(text);
  };
  // The cold-start board: the procedure as two rows of steps, working the
  // world model. The rig's own panels are not clickable here, because the
  // world, not the rig, holds the machine's state.
  const coldStart = createColdStartBoard(
    kit,
    () => world,
    note,
    () => {
      world = createWorld();
      note('World model restarted: everything cold and off.');
    },
    { post: false },
  );
  // The desk, turned to face the start: the board on its sloping top, a
  // cabinet up to the top's front edge and a back panel up to its rear.
  const desk = new Group();
  desk.position.set(DESK.x, 0, DESK.z);
  desk.rotation.y = Math.atan2(START.x - DESK.x, START.z - DESK.z);
  scene.add(desk);
  const deskTop = new Group();
  deskTop.position.y = DESK.top;
  deskTop.rotation.x = -DESK.tilt;
  desk.add(deskTop);
  coldStart.group.scale.setScalar(DESK.scale);
  deskTop.add(coldStart.group);
  {
    const w = coldStart.width * DESK.scale;
    const h = coldStart.height * DESK.scale;
    const depth = h * Math.sin(DESK.tilt);
    const front = DESK.top - (h / 2) * Math.cos(DESK.tilt);
    const back = DESK.top + (h / 2) * Math.cos(DESK.tilt);
    block(w, front, depth, '#3d4a45', 0, front / 2 - 0.01, 0, desk);
    block(
      w,
      back,
      0.03,
      '#3d4a45',
      0,
      back / 2 - 0.01,
      -depth / 2 - 0.016,
      desk,
    );
  }

  // The desk's parts make their own sounds, played here: a part's own
  // sound for a transition if it names one, else the usual sound for
  // that kind of part; and the state sounds the parts hold.
  coldStart.onSound((event, sound, part) => {
    if (sound === null) return;
    const cue =
      sound && (SOUND_CUES as readonly string[]).includes(sound)
        ? (sound as SoundCue)
        : defaultCue(part, event);
    if (cue) audio.play(cue);
  });
  coldStart.onHeld((sound, from) => loops.hold(from.uuid, sound));

  const uses = new Map<Object3D, (direction?: number) => void>([
    ...coldStart.uses,
    ...passages.uses,
  ]);

  // The rig's three supply switches follow the world's: each is found by
  // working the rig's controls whose names suggest it, seeing which of its
  // power selections flipped, and working it back.
  type Selection = 'isolator' | 'mains' | 'cabinet';
  const supplySwitches = new Map<Selection, () => void>();
  for (const control of rig.clickables) {
    if (!/isolator|rocker|NETZ/i.test(control.name)) continue;
    const before = rig.powerSelections;
    control.use();
    const after = rig.powerSelections;
    const flipped = (['isolator', 'mains', 'cabinet'] as const).find(
      (k) => before[k] !== after[k],
    );
    control.use();
    if (flipped && !supplySwitches.has(flipped))
      supplySwitches.set(flipped, () => control.use());
  }
  const worldSelections: Record<Selection, string> = {
    isolator: 'column.isolator',
    mains: 'column.netz',
    cabinet: 'column.rocker',
  };
  /** Put the world's state on the rig, which only shows it. */
  const showWorldOnRig = () => {
    for (const [key, id] of Object.entries(worldSelections) as [
      Selection,
      string,
    ][])
      if (rig.powerSelections[key] !== world.read<boolean>(id))
        supplySwitches.get(key)?.();
    const prep = rig.prep;
    const lift = world.read<number>('vessel.lift');
    const target = world.read<0 | 1>('vessel.liftTarget');
    prep.liftTarget = target;
    // When the head arrives, hand the rig's rams the last fraction of a
    // millimetre, so it plays its own arrival: the thud and the seal puff.
    if (lift === target && prep.lift !== target && !prep.clamped)
      prep.lift = target === 0 ? 1e-4 : 1 - 1e-4;
    else prep.lift = lift;
    prep.clamped = world.read('vessel.clamped');
    prep.inletOpen = world.read('vessel.inletOpen');
    prep.outletOpen = world.read('vessel.outletOpen');
    prep.air = world.read('vessel.air');
    prep.xenon = world.read('vessel.xenon');
    prep.supply = world.read('vessel.supply');
    prep.temperature = world.read('vessel.temperature');
    prep.failure = world.read<Catastrophe | null>('vessel.failure');
    prep.spinRate = world.read('vessel.spinRate');
    prep.spinAngle = world.read('vessel.spinAngle');
    const drive = {
      heater: world.read<number>('rig.heater'),
      spindle: world.read<number>('rig.spindle'),
      field: world.read<number>('rig.field'),
    } as RigState;
    prep.setpoint = Math.min(4000, driveTemperature(drive));
    prep.brightness = driveBrightness(drive);
    rig.drive.power = world.read('drive.mains');
  };
  const describeEvent = (e: WorldEvent): string | null => {
    if (e.source === 'fire') return `Fire circuit: ${e.event}.`;
    if (e.source === 'breaker')
      return `Drive breaker dropped: the ${e.event.cause} supply went off.`;
    if (e.source === 'plant') return 'FULLY OPERATIONAL.';
    if (e.source === 'rig')
      return e.event.kind === 'incident'
        ? `Breaker tripped: ${e.event.text}`
        : e.event.kind === 'warmed'
          ? 'Heaters at temperature.'
          : e.event.kind === 'field-locked'
            ? 'H-B field locked.'
            : 'H-B field wandering. Strain rising.';
    // The vessel's own events are logged by the rig as it shows them.
    return e.event.kind === 'catastrophe'
      ? `Core catastrophe: ${e.event.cause}.`
      : null;
  };

  const controlNames = new Map(
    rig.clickables.map((control) => [control.object, control.name]),
  );
  const controlLog = document.createElement('ol');
  controlLog.setAttribute('aria-label', 'Controls used');
  controlLog.setAttribute('role', 'log');
  controlLog.setAttribute('aria-live', 'polite');
  Object.assign(controlLog.style, {
    position: 'absolute',
    left: '12px',
    top: '116px',
    margin: '0',
    padding: '8px 12px',
    listStyle: 'none',
    pointerEvents: 'none',
    maxWidth: 'min(460px, calc(100% - 48px))',
    background: 'rgba(14,12,9,0.78)',
    color: '#e9e1c8',
    font: '13px/1.45 "Courier New", monospace',
  });
  controlLog.hidden = true;
  canvas.parentElement?.append(controlLog);
  const reportControl = (name: string, type: string) => {
    const line = `${name} — ${type}`;
    const item = document.createElement('li');
    item.textContent = line;
    controlLog.prepend(item);
    while (controlLog.children.length > 8)
      controlLog.lastElementChild!.remove();
    controlLog.hidden = false;
    console.info(`dev room: ${line}`);
  };

  // On-screen notes.
  const notes = document.createElement('div');
  notes.className = 'dev-room-notes';
  notes.innerHTML =
    '<strong>Developer room</strong> · not part of the game<br>' +
    'Click: mouse look · WASD: walk · Shift: run · C: crouch · V: lower crouch<br>' +
    'Click / E: work the control under the crosshair · wheel: zoom · Alt+wheel: height · Esc: cursor<br>' +
    'Doors: corridor north · dev1 east · <kbd>P</kbd> toggles PS1 resolution · <a href="/">back to the lab</a><br>' +
    'The column is driven by the graph world model: work the KALTSTART board, row 1 then row 2';
  Object.assign(notes.style, {
    position: 'absolute',
    left: '12px',
    top: '12px',
    padding: '8px 10px',
    background: 'rgba(14,12,9,0.78)',
    color: '#e9e1c8',
    font: '13px/1.45 "Courier New", monospace',
    maxWidth: 'calc(100% - 24px)',
  });
  notes.querySelector('a')!.style.color = '#ffb43a';
  canvas.parentElement?.appendChild(notes);

  // The world model's status, the rig's log and the sound switch.
  const model = document.createElement('div');
  model.className = 'dev-room-model';
  model.innerHTML =
    '<strong>World model (graph)</strong>' +
    '<button type="button" data-sound>Sound: off</button>' +
    '<div data-status></div><div data-log></div>';
  Object.assign(model.style, {
    position: 'absolute',
    right: '12px',
    bottom: '12px',
    width: 'min(360px, calc(100% - 24px))',
    padding: '8px 10px',
    display: 'grid',
    gap: '4px',
    background: 'rgba(14,12,9,0.82)',
    color: '#e9e1c8',
    font: '12px/1.4 "Courier New", monospace',
  });
  canvas.parentElement?.appendChild(model);

  const status = model.querySelector<HTMLElement>('[data-status]')!;
  const logView = model.querySelector<HTMLElement>('[data-log]')!;
  logView.style.color = '#ffb43a';
  let lastStatus = '';
  // The lab's own sound engine: the drive's hum, the column's mechanics
  // and voice, the plant, the panel clicks and the breakers, relays and
  // warnings, all driven by the world model. Browsers allow sound only
  // after a gesture, so it starts with the first click or key in the room.
  const audio = createSoundEngine();
  let muted = false;
  const unlock = () => {
    if (canvas.parentElement?.hidden) return;
    void audio.unlock();
    void loops.unlock();
  };
  canvas.addEventListener('pointerdown', unlock);
  model.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  const soundButton = model.querySelector<HTMLButtonElement>('[data-sound]')!;
  soundButton.textContent = 'Sound: on (click to mute)';
  Object.assign(soundButton.style, {
    justifySelf: 'start',
    font: 'inherit',
    padding: '2px 8px',
    cursor: 'pointer',
  });
  soundButton.addEventListener('click', () => {
    muted = !muted;
    audio.setMix(0.55, muted);
    loops.setMuted(muted);
    soundButton.textContent = muted
      ? 'Sound: muted (click for sound)'
      : 'Sound: on (click to mute)';
  });
  /** The world's drive as the sound engine reads it. */
  const rigForSound = (): RigState => ({
    controls: world.read('drive.controls'),
    heater: world.read('rig.heater'),
    spindle: world.read('rig.spindle'),
    field: world.read('rig.field'),
    drift: world.read('rig.drift'),
    instability: world.read('rig.instability'),
    strain: world.read('rig.strain'),
    strainFrom: world.read('rig.strainFrom'),
    incidents: world.read('rig.incidents'),
  });
  /** The world's drive settings, on the rack the sound engine knows. */
  const deskForSound = (): RackControls => {
    const desk = createRackControls();
    desk.mains = world.read('drive.mains');
    for (const id of Object.keys(
      desk.toggles,
    ) as (keyof RackControls['toggles'])[])
      if (world.graph.get(`drive.${id}`))
        desk.toggles[id] = world.read(`drive.${id}`);
    for (const id of Object.keys(desk.knobs) as (keyof RackControls['knobs'])[])
      if (world.graph.get(`drive.${id}`))
        desk.knobs[id] = world.read(`drive.${id}`);
    return desk;
  };
  /** The sound for something the world did, if it has one. */
  const cueFor = (e: WorldEvent): SoundCue | null => {
    if (e.source === 'breaker') return null;
    // No fire bell or sprinklers in this room.
    if (e.source === 'fire') return null;
    if (e.source === 'plant') return 'field-locked';
    if (e.source === 'rig')
      return e.event.kind === 'incident'
        ? 'incident'
        : e.event.kind === 'warmed'
          ? 'relay'
          : e.event.kind === 'field-locked'
            ? 'field-locked'
            : 'warning';
    return e.event.kind === 'catastrophe' ? 'incident' : null;
  };
  let wasMains = false;
  let wasOutlet = false;
  /** Keep the sound engine in step with the world, once a frame. */
  const soundFrame = () => {
    // The breaker and the purge valve are heard whenever they move.
    const mains = world.read<boolean>('drive.mains');
    if (mains !== wasMains) audio.play(mains ? 'breaker-on' : 'breaker-off');
    wasMains = mains;
    const outlet = world.read<boolean>('vessel.outletOpen');
    if (outlet !== wasOutlet) audio.play('purge');
    wasOutlet = outlet;
    // Only what is in this room makes a sound: the column and its drive.
    // The rectifier, the recirculator and the sprinklers are in the lab,
    // so the world's plant, recirculator and fire states are not heard.
    audio.update(rigForSound(), deskForSound(), reducedMotion.matches);
    audio.updateColumn(rig.prep);
  };

  const showStatus = () => {
    const head = world.read<number>('vessel.lift');
    const lit = annunciatorsLit();
    const text =
      `Plant ${world.read('plant.powered') ? 'on' : 'off'} · column ${world.read('column.running') ? 'on' : 'off'} · ` +
      `head ${head === 0 ? 'down' : head === 1 ? 'up' : `${Math.round(head * 100)}%`} · ` +
      `${world.read('vessel.sealed') ? 'sealed' : 'open'}<br>` +
      `O2 ${world.read<number>('vessel.oxygen').toFixed(2)}% · Xe ${world.read<number>('vessel.xenon').toFixed(2)} bar · ` +
      `line ${world.read<number>('line.flowSlpm').toFixed(1)} SLPM · permit ${world.read('drive.permit') ? 'yes' : 'no'}<br>` +
      `Drive ${world.read('drive.mains') ? 'on' : 'off'} · heaters ${Math.round(world.read<number>('rig.heater') * 100)}% · ` +
      `core ${Math.round(world.read<number>('vessel.temperature'))} K ${world.read('vessel.stage')}<br>` +
      `Tempo ×${coldStart.tempo} · alarms: ${lit.length ? lit.join(', ') : 'none'}`;
    const shown = text + columnLog.join('<br>');
    if (shown === lastStatus) return;
    lastStatus = shown;
    status.innerHTML = text;
    logView.innerHTML = columnLog.join('<br>');
  };
  const annunciatorsLit = () =>
    world.graph
      .vertices()
      .filter((v) => v.id.startsWith('alarm.') && world.read<boolean>(v.id))
      .map((v) => v.id.slice('alarm.'.length));

  // The PS1 resolution, on P; the realistic style starts without it.
  let ps1 = !realistic;
  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const scale = ps1 ? renderScale(width, height, true) : 1;
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    renderer.setSize(w, h, false);
    ps1Uniforms.resolution.value.set(w, h);
    ps1Uniforms.snapStrength.value = ps1 ? 0.35 : 0;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  const onKey = (event: KeyboardEvent) => {
    if (canvas.parentElement?.hidden) return;
    if (event.key === 'p' || event.key === 'P') {
      ps1 = !ps1;
      resize();
    }
  };
  window.addEventListener('keydown', onKey);

  // A handle for scripted views: place the camera and its target.
  (window as unknown as { vx3Dev: unknown }).vx3Dev = {
    /** Stand the walker with its eye at (x, y, z), looking at (tx, ty, tz). */
    view(x: number, y: number, z: number, tx: number, ty: number, tz: number) {
      const dx = tx - x;
      const dz = tz - z;
      walk.place(
        x,
        z,
        Math.atan2(dx, -dz),
        Math.atan2(ty - y, Math.hypot(dx, dz)),
        y,
      );
    },
    /** Set the zoom: 1 is normal, up to 4 times closer. */
    zoom(value: number) {
      walk.walker.zoom = value;
    },
    setPs1(value: boolean) {
      ps1 = value;
      resize();
    },
    /** The column's model, as the rig shows it. */
    prep: rig.prep,
    /** The world model that drives the rig. */
    world: () => world,
    /** The KALTSTART board, for placing it in scripted views. */
    coldStartDesk: desk,
    /** Work a cold-start board step by its legend, as a click would. */
    step: (legend: string, direction = 1) => coldStart.work(legend, direction),
    /** The last frame's draw calls and triangles, and what the GPU holds. */
    stats: () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      programs: renderer.info.programs?.length ?? 0,
    }),
    /** The rig's panel layout problems. */
    layout: (part?: number, edge?: number) => rig.layoutProblems(part, edge),
    /** How many parts are fitted to each panel. */
    fittedCounts: () => rig.fittedCounts(),
    /**
     * Work every control on the rig once and report which moved nothing
     * visible: each is clicked, the rig run on a tenth of a second, and its
     * part compared before and after. Leaves the rig in a muddle; reload.
     */
    exerciseControls() {
      const pose = (root: Object3D) => {
        const values: number[] = [];
        root.updateMatrixWorld(true);
        root.traverse((o) => {
          values.push(...o.matrixWorld.elements);
          // Colour counts too, on single materials and on arrays of them.
          const own = (o as { material?: unknown }).material;
          for (const material of Array.isArray(own) ? own : [own]) {
            const colour = (
              material as
                { color?: { r: number; g: number; b: number } } | undefined
            )?.color;
            if (colour) values.push(colour.r, colour.g, colour.b);
          }
        });
        return values;
      };
      const still: string[] = [];
      let t = 1000;
      for (const control of rig.clickables) {
        // Judge from the part the control belongs to.
        let part: Object3D = control.object;
        while (part.parent && !part.userData.sound && part.parent !== rig.group)
          part = part.parent;
        const before = pose(part);
        control.use();
        for (let i = 0; i < 2; i++) rig.update((t += 0.05), 0.05, false);
        const after = pose(part);
        if (!before.some((v, i) => Math.abs(v - after[i]) > 1e-6))
          still.push(control.name);
      }
      return { total: rig.clickables.length, still };
    },
    /** Work a rig control by its name, as a click would. */
    work(name: string) {
      const control = rig.clickables.find((c) => c.name === name);
      control?.use();
      return Boolean(control);
    },
    /** Render the rig's mechanical sounds as one clip, WAV bytes in base64. */
    async renderRigSounds() {
      const { renderRigSounds } = await import('../audio/core-voice-render');
      const bytes = await renderRigSounds();
      let text = '';
      for (const byte of bytes) text += String.fromCharCode(byte);
      return btoa(text);
    },
    /** Render the core's voice through a set scene, as WAV bytes in base64. */
    async renderVoice(scene: CoreVoiceScene) {
      const { renderCoreVoice } = await import('../audio/core-voice-render');
      const bytes = await renderCoreVoice(scene);
      let text = '';
      for (const byte of bytes) text += String.fromCharCode(byte);
      return btoa(text);
    },
  };
  /** The sound of the part a mesh belongs to, from its nearest tagged ancestor. */
  const soundOf = (object: Object3D): ControlSound | null => {
    for (let o: Object3D | null = object; o; o = o.parent) {
      const sound = o.userData.sound as
        ControlSound | (() => ControlSound) | undefined;
      if (sound) return typeof sound === 'function' ? sound() : sound;
    }
    return null;
  };

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  /** The usable part at a normalised screen point, walking up from the mesh hit. */
  const usableAt = (x: number, y: number) => {
    pointer.set(x, y);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...uses.keys()], true)[0];
    for (let o: Object3D | null = hit?.object ?? null; o; o = o.parent) {
      const use = uses.get(o);
      if (passages.uses.has(o as Mesh) && hit && hit.distance > 2.8 * 1)
        return undefined;
      if (use && hit)
        return { object: o, use, point: hit.point, mesh: hit.object };
    }
    return undefined;
  };
  const useAt = (x: number, y: number) => {
    const found = usableAt(x, y);
    if (!found) return;

    // The part's sound, judged before the click changes it.
    const kind = soundOf(found.mesh);
    const typeNames: Partial<Record<ControlSound, string>> = {
      button: 'push-button',
      key: 'keycap',
      toggle: 'toggle switch',
      rocker: 'rocker switch',
      'key-switch': 'key switch',
      knob: 'rotary knob',
      selector: 'rotary selector',
      locked: 'locked rotary selector',
      slide: 'slide switch',
      handwheel: 'handwheel',
      isolator: 'power isolator',
    };
    let name = controlNames.get(found.object) ?? found.object.name;
    for (
      let parent = found.object.parent;
      !name && parent;
      parent = parent.parent
    )
      name = parent.name;
    reportControl(
      name || 'Unnamed control',
      kind ? (typeNames[kind] ?? kind) : 'door handle',
    );
    // Knobs and selectors turn by the side clicked, as everywhere in the game.
    found.use(knobDirection(found.object, found.point, camera));
    if (kind) audio.play(CONTROL_CUES[kind] ?? 'button');
  };

  model.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLButtonElement)
      reportControl(
        target.textContent?.trim() || 'Model command',
        'push-button',
      );
  });
  model.addEventListener('input', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement)
      reportControl(target.dataset.control || 'Model setting', 'slider');
  });

  // Walk the room as in the lab. The walls, the open front and the three
  // exhibits are solid.
  const solids: Footprint[] = walls.filter((wall) => wall.bottom === 0);
  for (const exhibit of [rig.group, desk]) {
    const bounds = new Box3().setFromObject(exhibit);
    if (bounds.isEmpty()) continue;
    solids.push({
      minX: bounds.min.x,
      maxX: bounds.max.x,
      minZ: bounds.min.z,
      maxZ: bounds.max.z,
    });
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const walk = createFirstPerson({
    canvas,
    camera,
    metre: 1,
    floorY: 0,
    // The start sees the whole column and the KALTSTART board beside it.
    start:
      passages.arrival(new URLSearchParams(location.search).get('from')) ??
      START,
    solids: () => [...solids, ...passages.solids()],
    use: useAt,
    aimed: () => Boolean(usableAt(0, 0)),
    reducedMotion: () => reducedMotion.matches,
  });

  let last = 0;
  renderer.setAnimationLoop((time) => {
    if (canvas.parentElement?.hidden) {
      last = 0;
      return;
    }
    const seconds = time / 1000;
    const delta = Math.min(0.1, last ? seconds - last : 0);
    last = seconds;
    ps1Uniforms.time.value = seconds;
    walk.update(delta);
    passages.update(delta, walk.walker.x, walk.walker.z);
    // The world runs at the board's tempo, in steps of a tenth of a second.
    let remaining = delta * coldStart.tempo;
    while (remaining > 1e-6) {
      const dt = Math.min(0.1, remaining);
      remaining -= dt;
      if (coldStart.tracking) {
        const want =
          Math.round(world.read<number>('drive.idealTrim') * 20) / 20;
        if (world.read('drive.trim') !== want) world.work('drive.trim', want);
      }
      for (const event of world.tick(dt)) {
        const line = describeEvent(event);
        if (line) note(line);
        const cue = cueFor(event);
        if (cue) audio.play(cue);
      }
    }
    showWorldOnRig();
    rig.update(seconds, delta, reducedMotion.matches);
    coldStart.update(delta);
    showStatus();
    soundFrame();
    renderer.render(scene, camera);
  });

  const dispose = () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    window.removeEventListener('keydown', onKey);
    walk.dispose();
    passages.dispose();
    notes.remove();
    controlLog.remove();
    model.remove();
    canvas.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    audio.dispose();
    loops.dispose();
    coldStart.dispose();
    rig.dispose();
    disposeKit(kit, coldStart.group);
    coldStart.group.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    room.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    for (const material of materials) material.dispose();

    freeEnvironment();
    renderer.dispose();
  };
  return Object.assign(dispose, {
    suspend() {
      audio.setVisible(false);
      loops.setVisible(false);
    },
    resume() {
      audio.setVisible(true);
      loops.setVisible(true);
    },
    enter(previous: string | null) {
      const pose = passages.arrival(previous);
      if (pose) {
        walk.place(pose.x, pose.z, pose.yaw, pose.pitch);
        walk.walker.crouched = false;
        walk.walker.lowCrouched = false;
      }
    },
  });
}
