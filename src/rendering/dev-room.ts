import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  Group,
  Mesh,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three';
import type { Material, Object3D } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createPs1Material, ps1Uniforms } from './ps1-material';
import { createFerrocoreColumnRig } from '../scene/ferrocore-column-rig';
import { createCoreVoice } from '../audio/core-voice';
import type { CoreVoice } from '../audio/core-voice';
import { coreVoiceParameters } from '../audio/core-voice-parameters';
import type { CoreVoiceScene } from '../audio/core-voice-render';
import {
  AMBIENT,
  FULL_BOTTLE,
  acknowledge,
  airShare,
  chamberPressure,
  coreStage,
  isSealed,
  setActivation,
  setClamped,
} from '../game/column-prep';
import { createRigSounds } from '../audio/rig-sounds';
import type { ControlSound, RigSounds } from '../audio/rig-sounds';
import {
  createMicroLabel,
  createPanelKit,
  disposeKit,
} from '../scene/eighties-controls';
import { createIsolatorBoard, createPartsBoard } from './dev-parts-board';

/**
 * The developer room: not part of the game. A plain, evenly lit room
 * reached at `/?room=dev`, where new apparatus and parts are built and
 * looked at before they go into the lab. Drag to orbit, scroll to zoom,
 * right-drag to pan, click a button cap to press it. P switches between the
 * game's low PS1 resolution and the screen's own, for reading small print.
 */
export function startDevRoom(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.01, 60);
  camera.position.set(0.3, 1.3, 2.9);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.0, 0);
  controls.enableDamping = true;
  controls.update();

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
  block(size, 3.2, 0.1, '#8a8d88', 0, 1.6, -size / 2);
  block(0.1, 3.2, size, '#80837e', -size / 2, 1.6, 0);
  block(0.1, 3.2, size, '#80837e', size / 2, 1.6, 0);
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
  const rig = createFerrocoreColumnRig({
    log(text) {
      columnLog.unshift(text);
      columnLog.length = Math.min(columnLog.length, 4);
      console.debug(text);
    },
  });
  scene.add(rig.group);
  // Audit the panels: parts must clear each other and the panel edges.
  for (const problem of rig.layoutProblems())
    console.warn(`Panel layout: ${problem}`);
  const rigNote = createMicroLabel(
    kit,
    'CONCEPT: VX3 ROUND A VERTICAL FERROCORE COLUMN  ·  NOT WIRED',
    { height: 0.03, plate: '#e8e4d4', ink: '#222' },
  );
  rigNote.position.set(0, 0.06, 0.62);
  rigNote.rotation.x = -Math.PI / 2;
  room.add(rigNote);

  // A catalogue of the 1980s panel parts, four times life size.
  const board = createPartsBoard(kit);
  board.group.position.set(-2.3, 1.25, 0.6);
  board.group.rotation.y = 0.6;
  scene.add(board.group);

  const heavy = createIsolatorBoard(kit);
  heavy.group.position.set(2.4, 1.1, 0.7);
  heavy.group.rotation.y = -0.6;
  scene.add(heavy.group);

  const uses = new Map<Object3D, () => void>([
    ...rig.clickables.map((c) => [c.object, c.use] as const),
    ...board.uses,
    ...heavy.uses,
  ]);

  // On-screen notes.
  const notes = document.createElement('div');
  notes.className = 'dev-room-notes';
  notes.innerHTML =
    '<strong>Developer room</strong> · not part of the game<br>' +
    'Drag to orbit · scroll to zoom · right-drag to pan · click any control to work it<br>' +
    '<kbd>P</kbd> toggles PS1 resolution · <a href="/">back to the lab</a>';
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

  // Stand-ins for the game's model: the core's activation temperature and
  // brightness are set from outside the rig, never on its panels.
  const model = document.createElement('div');
  model.className = 'dev-room-model';
  model.innerHTML =
    '<strong>Game model stand-in</strong>' +
    '<label>Activation <input type="range" min="293" max="4000" step="1" value="293" data-control="activation"> <output>293 K</output></label>' +
    '<label>Brightness <input type="range" min="0" max="1" step="0.01" value="0.6" data-control="brightness"> <output>0.60</output></label>' +
    '<button type="button" data-sound>Sound: off</button>' +
    '<div data-scenes></div>' +
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
  for (const label of model.querySelectorAll('label'))
    Object.assign(label.style, {
      display: 'grid',
      gridTemplateColumns: '7.5em 1fr 4.5em',
      alignItems: 'center',
      gap: '6px',
    });
  canvas.parentElement?.appendChild(model);
  const activation = model.querySelector<HTMLInputElement>(
    '[data-control="activation"]',
  )!;
  const brightness = model.querySelector<HTMLInputElement>(
    '[data-control="brightness"]',
  )!;
  const onModel = () => {
    setActivation(rig.prep, Number(activation.value));
    rig.prep.brightness = Number(brightness.value);
    activation.nextElementSibling!.textContent = `${activation.value} K`;
    brightness.nextElementSibling!.textContent = Number(
      brightness.value,
    ).toFixed(2);
  };
  activation.addEventListener('input', onModel);
  brightness.addEventListener('input', onModel);
  // Scenario buttons: jump the column straight to a state, to see and hear
  // it without working through the cold start each time.
  const setActivationSlider = (kelvin: number) => {
    activation.value = String(Math.round(kelvin));
    onModel();
  };
  const ready = () => {
    const prep = rig.prep;
    prep.failure = null;
    prep.lift = 0;
    prep.liftTarget = 0;
    prep.clamped = true;
    prep.inletOpen = false;
    prep.outletOpen = false;
    prep.air = 0;
    prep.xenon = 1.8;
    prep.supply = FULL_BOTTLE;
  };
  const scenes: [string, () => void][] = [
    [
      'Cold',
      () => {
        const prep = rig.prep;
        acknowledge(prep);
        setClamped(prep, false);
        prep.lift = 1;
        prep.liftTarget = 1;
        prep.inletOpen = false;
        prep.outletOpen = false;
        prep.air = 1;
        prep.xenon = 0;
        prep.temperature = AMBIENT;
        setActivationSlider(AMBIENT);
      },
    ],
    ['Vessel ready', ready],
    [
      'Glowing',
      () => {
        ready();
        setActivationSlider(1600);
      },
    ],
    [
      'Full power',
      () => {
        ready();
        setActivationSlider(4000);
      },
    ],
    [
      'Purging',
      () => {
        ready();
        rig.prep.air = 0.6;
        rig.prep.xenon = 0.3;
        rig.prep.inletOpen = true;
        rig.prep.outletOpen = true;
        rig.prep.temperature = AMBIENT;
        setActivationSlider(AMBIENT);
      },
    ],
    [
      'Burnout',
      () => {
        ready();
        rig.prep.temperature = 2000;
        setActivationSlider(2000);
        setClamped(rig.prep, false);
      },
    ],
    [
      'Flux inductance',
      () => {
        // Hot, with the purge left open on an almost empty bottle: the
        // chamber is pumped down within a few seconds.
        ready();
        rig.prep.inletOpen = true;
        rig.prep.outletOpen = true;
        rig.prep.supply = 0.02;
        rig.prep.xenon = 0.5;
        rig.prep.temperature = 2000;
        setActivationSlider(2000);
      },
    ],
    [
      'Acknowledge',
      () => {
        acknowledge(rig.prep);
        setActivationSlider(AMBIENT);
      },
    ],
  ];
  const sceneRow = model.querySelector<HTMLElement>('[data-scenes]')!;
  Object.assign(sceneRow.style, {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  });
  for (const [name, apply] of scenes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = name;
    Object.assign(button.style, {
      font: 'inherit',
      padding: '1px 6px',
      cursor: 'pointer',
    });
    button.addEventListener('click', apply);
    sceneRow.appendChild(button);
  }

  const status = model.querySelector<HTMLElement>('[data-status]')!;
  const logView = model.querySelector<HTMLElement>('[data-log]')!;
  logView.style.color = '#ffb43a';
  let lastStatus = '';
  // The core's voice. Browsers allow sound only after a gesture, so it
  // starts on the button.
  let audio: AudioContext | null = null;
  let voice: CoreVoice | null = null;
  let sounds: RigSounds | null = null;
  let wasClamped = false;
  let wasMoving = false;
  let lastFailure: string | null = null;
  const soundButton = model.querySelector<HTMLButtonElement>('[data-sound]')!;
  Object.assign(soundButton.style, {
    justifySelf: 'start',
    font: 'inherit',
    padding: '2px 8px',
    cursor: 'pointer',
  });
  soundButton.addEventListener('click', () => {
    if (!audio) {
      audio = new AudioContext();
      voice = createCoreVoice(audio);
      voice.output.connect(audio.destination);
      sounds = createRigSounds(audio);
      sounds.output.connect(audio.destination);
    } else if (audio.state === 'running') void audio.suspend();
    else void audio.resume();
    // The label says what a click does next, once the state has settled.
    window.setTimeout(() => {
      soundButton.textContent =
        audio?.state === 'running' ? 'Sound: on (click to mute)' : 'Sound: off';
    }, 50);
  });
  const voiceFrame = () => {
    if (!voice) return;
    const prep = rig.prep;
    // The column's mechanical sounds: the pump while the head moves, a thud
    // at the end of its travel, the clamps, and the purge port's hiss.
    if (sounds) {
      const moving = !prep.clamped && prep.lift !== prep.liftTarget;
      if (wasMoving && !moving) sounds.play('ram-stop');
      if (prep.clamped !== wasClamped) sounds.play('clamp');
      wasMoving = moving;
      wasClamped = prep.clamped;
      sounds.update({
        rams: moving ? (prep.liftTarget > prep.lift ? 1 : -1) : 0,
        venting:
          isSealed(prep) && prep.outletOpen
            ? Math.min(1, chamberPressure(prep))
            : 0,
      });
    }
    // A new failure gets its catastrophe; an acknowledged one, a fresh voice.
    if (prep.failure !== lastFailure) {
      if (prep.failure === 'flux-inductance') voice.collapse();
      else if (prep.failure === 'burnout') voice.burnout();
      else voice.reset();
      lastFailure = prep.failure;
    }
    voice.update(
      coreVoiceParameters({
        kelvin: prep.temperature,
        brightness: prep.brightness,
        spinRate: prep.spinRate,
        sealed: prep.lift < 0.03,
        failed: prep.failure !== null,
      }),
      prep.spinAngle,
    );
  };

  const showStatus = () => {
    const prep = rig.prep;
    const head =
      prep.lift === 0
        ? 'down'
        : prep.lift === 1
          ? 'up'
          : `${Math.round(prep.lift * 100)}%`;
    const text =
      `Head ${head} · ${prep.clamped ? 'clamped' : 'unclamped'} · ` +
      `inlet ${prep.inletOpen ? 'open' : 'shut'} · outlet ${prep.outletOpen ? 'open' : 'shut'}<br>` +
      `Air ${Math.round(airShare(prep) * 100)}% · Xe ${prep.xenon.toFixed(2)} bar · ` +
      `bottle ${Math.round((prep.supply / FULL_BOTTLE) * 100)}%<br>` +
      `Core ${Math.round(prep.temperature)} K · ${coreStage(prep)}`;
    const shown = text + columnLog.join('<br>');
    if (shown === lastStatus) return;
    lastStatus = shown;
    status.innerHTML = text;
    logView.innerHTML = columnLog.join('<br>');
  };

  let ps1 = true;
  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const scale = ps1 ? Math.min(640 / width, 480 / height, 1) : 1;
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
    if (event.key === 'p' || event.key === 'P') {
      ps1 = !ps1;
      resize();
    }
  };
  window.addEventListener('keydown', onKey);

  // A handle for scripted views: place the camera and its target.
  (window as unknown as { vx3Dev: unknown }).vx3Dev = {
    view(x: number, y: number, z: number, tx: number, ty: number, tz: number) {
      camera.position.set(x, y, z);
      controls.target.set(tx, ty, tz);
      controls.update();
    },
    setPs1(value: boolean) {
      ps1 = value;
      resize();
    },
    /** The column's model, for scripted tests. */
    prep: rig.prep,
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
    setActivation(kelvin: number) {
      activation.value = String(kelvin);
      onModel();
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
  let downAt: [number, number] | null = null;
  const down = (event: PointerEvent) => {
    downAt = [event.clientX, event.clientY];
  };
  const up = (event: PointerEvent) => {
    if (!downAt) return;
    const moved = Math.hypot(
      event.clientX - downAt[0],
      event.clientY - downAt[1],
    );
    downAt = null;
    if (moved > 5) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    // Walk up from the mesh hit to the part that takes the click.
    const hit = raycaster.intersectObjects([...uses.keys()], true)[0];
    for (let o: Object3D | null = hit?.object ?? null; o; o = o.parent) {
      const use = uses.get(o);
      if (use) {
        console.debug('dev room: worked', o.name || o.type);
        // The part's sound, judged before the click changes it.
        const kind = soundOf(hit!.object);
        use();
        if (kind) sounds?.play(kind);
        break;
      }
    }
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointerup', up);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let last = 0;
  renderer.setAnimationLoop((time) => {
    const seconds = time / 1000;
    const delta = Math.min(0.1, last ? seconds - last : 0);
    last = seconds;
    ps1Uniforms.time.value = seconds;
    controls.update();
    rig.update(seconds, delta, reducedMotion.matches);
    board.update(seconds, delta);
    heavy.update(delta);
    showStatus();
    voiceFrame();
    renderer.render(scene, camera);
  });

  return () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    window.removeEventListener('keydown', onKey);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointerup', up);
    controls.dispose();
    notes.remove();
    model.remove();
    voice?.dispose();
    sounds?.dispose();
    void audio?.close();
    rig.dispose();
    disposeKit(kit, board.group);
    heavy.group.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    room.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    for (const material of materials) material.dispose();
    renderer.dispose();
  };
}
