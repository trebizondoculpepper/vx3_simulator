import {
  createRenderer,
  realistic,
  renderScale,
  useEnvironment,
} from './render-style';
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  DirectionalLight,
  Mesh,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
} from 'three';
import type { Object3D } from 'three';
import { devDoors, devWallPieces } from '../game/dev-room-links';
import type { Footprint } from '../game/walk-collision';
import { RACK_METRE } from '../game/rack-layout';
import { createDevDoorways } from '../scene/dev-doorways';
import { createPanelKit, disposeKit } from '../scene/eighties-controls';
import { knobDirection } from '../scene/rotary-knob';
import { createRigSounds } from '../audio/rig-sounds';
import type { ControlSound, RigSounds } from '../audio/rig-sounds';
import { createPartLoops } from '../audio/part-loops';
import type { PartEvent } from '../game/world/components';
import { createPartsBoard } from './dev-parts-board';
import { createFirstPerson } from './first-person';
import { createPs1Material, ps1Uniforms } from './ps1-material';

/** The sound a kind of part makes doing something, if any. */
function partSound(part: string, event: PartEvent): ControlSound | null {
  if (event === 'refused') return 'locked';
  if (event === 'end-stop') return null;
  return part as ControlSound;
}

/** What each kind of part is called in the click log. */
const TYPE_NAMES: Partial<Record<ControlSound, string>> = {
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

/**
 * Dev2, the parts room: the CONTROL TEST board, a catalogue of the 1980s
 * panel parts at four times life size with the heavy switchgear at twice
 * life size, for seeing and hearing every control and display on its own.
 * `?room=dev2&view=controls` starts in front of it.
 */
export function startPartsRoom(canvas: HTMLCanvasElement) {
  const m = RACK_METRE;
  const bounds = { minX: -5 * m, maxX: 5 * m, minZ: -5 * m, maxZ: 5 * m };
  const scene = new Scene();
  const renderer = createRenderer(canvas);
  // Realistic style: soft light and reflections from every side.
  const freeEnvironment = useEnvironment(renderer, scene, 0.5);
  renderer.setClearColor('#2b2d2c');
  const camera = new PerspectiveCamera(52, 1, 0.05, 40 * m);
  scene.add(new AmbientLight('#fff4e2', 1.6));
  const key = new DirectionalLight('#fff0d0', 2.2);
  key.position.set(-2, 4, 5);
  scene.add(key);
  const floorMaterial = createPs1Material({ color: '#62635c' });
  const wallMaterial = createPs1Material({ color: '#899085' });
  const slab = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    wall = false,
  ) => {
    const mesh = new Mesh(
      new BoxGeometry(w, h, d),
      wall ? wallMaterial : floorMaterial,
    );
    mesh.position.set(x, y, z);
    scene.add(mesh);
  };
  slab(10 * m, 0.1 * m, 10 * m, 0, -0.05 * m, 0);
  slab(10 * m, 0.1 * m, 10 * m, 0, 3.25 * m, 0, true);
  const doors = devDoors('dev2', bounds, m);
  const walls = devWallPieces(bounds, doors, m, 3.2 * m);
  for (const wall of walls)
    slab(
      wall.maxX - wall.minX,
      wall.top - wall.bottom,
      wall.maxZ - wall.minZ,
      (wall.minX + wall.maxX) / 2,
      (wall.bottom + wall.top) / 2,
      (wall.minZ + wall.maxZ) / 2,
      true,
    );
  const passages = createDevDoorways('dev2', doors, 0, m);
  scene.add(passages.group);

  // The CONTROL TEST board, built in metres, against the north wall.
  const kit = createPanelKit();
  const board = createPartsBoard(kit);
  board.group.scale.setScalar(m);
  board.group.position.set(0, 1.6 * m, -2.2 * m);
  scene.add(board.group);
  const boardBounds = new Box3().setFromObject(board.group);
  const boardFootprint: Footprint = {
    minX: boardBounds.min.x,
    maxX: boardBounds.max.x,
    minZ: boardBounds.min.z,
    maxZ: boardBounds.max.z,
  };

  // What was clicked, and what kind of part it was.
  const log = document.createElement('ol');
  log.setAttribute('aria-label', 'Controls used');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  Object.assign(log.style, {
    position: 'absolute',
    left: '12px',
    top: '64px',
    margin: '0',
    padding: '8px 12px',
    listStyle: 'none',
    pointerEvents: 'none',
    maxWidth: 'min(460px, calc(100% - 48px))',
    background: 'rgba(14,12,9,0.78)',
    color: '#e9e1c8',
    font: '13px/1.45 "Courier New", monospace',
  });
  log.hidden = true;
  canvas.parentElement?.append(log);
  const report = (name: string, type: string) => {
    const item = document.createElement('li');
    item.textContent = `${name} — ${type}`;
    log.prepend(item);
    while (log.children.length > 8) log.lastElementChild!.remove();
    log.hidden = false;
    console.info(`dev2: ${item.textContent}`);
  };

  // The parts' own sounds. Browsers allow sound only after a gesture.
  let audio: AudioContext | null = null;
  let resumeAudio = false;
  let sounds: RigSounds | null = null;
  const soundButton = document.createElement('button');
  soundButton.type = 'button';
  soundButton.textContent = 'Sound: off';
  Object.assign(soundButton.style, {
    position: 'absolute',
    right: '12px',
    top: '12px',
    font: '13px monospace',
    padding: '4px 10px',
    cursor: 'pointer',
  });
  // State sounds the parts hold, such as the isolator's hum.
  const loops = createPartLoops();
  board.onHeld((sound, from) => loops.hold(from.uuid, sound));
  // The parts' transition sounds, and a line in the log for each.
  board.onSound((event, sound, part, from) => {
    let name = from.name;
    for (let p = from.parent; !name && p; p = p.parent) name = p.name;
    report(
      name || 'Unnamed control',
      `${TYPE_NAMES[part as ControlSound] ?? part}: ${event}`,
    );
    if (sound === null) return;
    const kind = (sound as ControlSound | undefined) ?? partSound(part, event);
    if (kind) sounds?.play(kind);
  });
  soundButton.addEventListener('click', () => {
    void loops.unlock();
    if (!audio) {
      audio = new AudioContext();
      sounds = createRigSounds(audio);
      sounds.output.connect(audio.destination);
    } else if (audio.state === 'running') {
      void audio.suspend();
      loops.setMuted(true);
    } else {
      void audio.resume();
      loops.setMuted(false);
    }
    window.setTimeout(() => {
      soundButton.textContent =
        audio?.state === 'running' ? 'Sound: on (click to mute)' : 'Sound: off';
    }, 50);
  });
  canvas.parentElement?.append(soundButton);

  const uses = new Map<Object3D, (direction?: number) => void>([...board.uses]);
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const use = (x: number, y: number) => {
    pointer.set(x, y);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(
      [...passages.uses.keys(), ...uses.keys()],
      true,
    )[0];
    if (!hit) return;
    if (passages.uses.has(hit.object as Mesh)) {
      if (hit.distance < 2.8 * m) passages.uses.get(hit.object as Mesh)?.();
      return;
    }
    for (let o: Object3D | null = hit.object; o; o = o.parent) {
      const work = uses.get(o);
      if (!work) continue;
      // The part makes its own sound, and the log line, as it works.
      work(knobDirection(o, hit.point, camera));
      return;
    }
  };

  // In front of the board, or wherever the door brought the walker.
  const atBoard = { x: 0, z: -0.4 * m, yaw: 0, pitch: -0.12 };
  const params = new URLSearchParams(location.search);
  const walk = createFirstPerson({
    canvas,
    camera,
    metre: m,
    floorY: 0,
    start:
      params.get('view') === 'controls'
        ? atBoard
        : (passages.arrival(params.get('from')) ?? { x: 0, z: 3 * m }),
    solids: () => [
      ...walls.filter((wall) => wall.bottom === 0),
      ...passages.solids(),
      boardFootprint,
    ],
    use,
  });
  const notes = document.createElement('div');
  notes.textContent =
    'DEV2 · Parts room: every control and display on its own · Doors: dev1 west / dev3 east · WASD: walk · E or click: work a part · Esc: cursor · P: PS1 resolution';
  Object.assign(notes.style, {
    position: 'absolute',
    top: '12px',
    left: '12px',
    maxWidth: 'calc(100% - 260px)',
    padding: '10px',
    background: '#20302bdd',
    color: '#e8e2cc',
    font: '13px monospace',
  });
  canvas.parentElement?.append(notes);
  // The PS1 resolution, on P; the realistic style starts without it.
  let ps1 = !realistic;
  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const scale = ps1 ? renderScale(width, height, true) : 1;
    const w = Math.round(width * scale),
      h = Math.round(height * scale);
    renderer.setSize(w, h, false);
    ps1Uniforms.resolution.value.set(w, h);
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

  // A handle for scripted views.
  (window as unknown as { vx3Dev2: unknown }).vx3Dev2 = {
    /** Stand with the eye at (x, y, z), looking at (tx, ty, tz), in metres. */
    view(x: number, y: number, z: number, tx: number, ty: number, tz: number) {
      const dx = tx - x;
      const dz = tz - z;
      walk.place(
        x * m,
        z * m,
        Math.atan2(dx, -dz),
        Math.atan2(ty - y, Math.hypot(dx, dz)),
        y * m,
      );
    },
    setPs1(value: boolean) {
      ps1 = value;
      resize();
    },
    /** Work a part by its name, as a click would; returns whether found. */
    work(name: string, direction = 1) {
      for (const [object, use] of uses)
        if (object.name === name) {
          use(direction);
          return true;
        }
      return false;
    },
    /** The click log, newest first. */
    log: () => [...log.children].map((item) => item.textContent),
  };

  let last = 0;
  renderer.setAnimationLoop((time) => {
    if (canvas.parentElement?.hidden) {
      last = 0;
      return;
    }
    const delta = last ? Math.min(0.1, (time - last) / 1000) : 0;
    last = time;
    ps1Uniforms.time.value = time / 1000;
    walk.update(delta);
    passages.update(delta, walk.walker.x, walk.walker.z);
    board.update(time / 1000, delta);
    renderer.render(scene, camera);
  });
  const dispose = () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    window.removeEventListener('keydown', onKey);
    walk.dispose();
    passages.dispose();
    notes.remove();
    log.remove();
    soundButton.remove();
    sounds?.dispose();
    void audio?.close();
    loops.dispose();
    board.dispose();
    disposeKit(kit, board.group);
    scene.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    wallMaterial.dispose();
    floorMaterial.dispose();
    freeEnvironment();
    renderer.dispose();
  };
  return Object.assign(dispose, {
    suspend() {
      resumeAudio = audio?.state === 'running';
      if (resumeAudio) void audio?.suspend();
      loops.setVisible(false);
    },
    resume() {
      if (resumeAudio) void audio?.resume();
      loops.setVisible(true);
    },
    enter(previous: string | null) {
      if (new URLSearchParams(location.search).get('view') === 'controls') {
        walk.place(atBoard.x, atBoard.z, atBoard.yaw, atBoard.pitch);
        return;
      }
      const pose = passages.arrival(previous);
      if (pose) {
        walk.place(pose.x, pose.z, pose.yaw, pose.pitch);
        walk.walker.crouched = false;
        walk.walker.lowCrouched = false;
      }
    },
  });
}
