import {
  AmbientLight,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three';
import type { Material, Object3D, Texture } from 'three';
import { assembleRack } from '../game/rack-catalogue';
import {
  applyRack,
  createRackControls,
  knobLine,
  toggleLine,
} from '../game/rack-controls';
import { createRig, stepRig } from '../game/rig';
import {
  createDialTexture,
  createLabelTexture,
  createNixieScreen,
  createScopeScreen,
} from '../scene/screens';
import { createPs1Material, ps1Uniforms } from './ps1-material';

const U = 0.48;
const panelWidth = 4.35;

export function startScene(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  const perspectiveCamera = new PerspectiveCamera(38, 1, 0.1, 100);
  const isometricCamera = new OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
  let view: 'perspective' | 'isometric' = 'perspective';
  const camera = () =>
    view === 'perspective' ? perspectiveCamera : isometricCamera;
  const scene = new Scene();
  scene.background = new Color('#181714');
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
  const settings = createRackControls();
  const modules = assembleRack();
  const totalHeight =
    modules.reduce((sum, module) => sum + module.units * U + 0.045, 0) + 0.35;
  const rack = new Group();
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

  cube(rack, 5.05, totalHeight + 0.25, 0.65, '#242724', 0, 0, -0.48);
  for (const x of [-2.5, 2.5]) {
    cube(rack, 0.08, totalHeight + 0.25, 0.9, '#313a35', x, 0, -0.45);
  }
  cube(rack, 4.65, totalHeight + 0.12, 0.05, '#111b1a', 0, 0, -0.12);
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
  cube(rack, 5.2, 0.18, 0.74, '#3e423b', 0, totalHeight / 2 + 0.08, 0);
  cube(rack, 5.2, 0.18, 0.74, '#30332f', 0, -totalHeight / 2 - 0.08, 0);

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
  for (const module of modules) {
    const h = module.units * U;
    const y = top - h / 2;
    const panel = new Group();
    panel.position.y = y;
    rack.add(panel);
    cube(panel, panelWidth, h - 0.055, 0.27, module.finish, 0, 0, 0.04);
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
    label(
      panel,
      `${module.maker}  /  ${module.title}`,
      0,
      h / 2 - 0.27,
      0.235,
      11,
      '#eadcbd',
      '#252d2a',
    );
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
      for (const x of [-1.35, -0.55, 0.25, 1.05]) {
        cube(panel, 0.28, 0.07, 0.19, '#252823', x, 0.09, 0.31);
        const glass = new Mesh(
          new CylinderGeometry(0.1, 0.1, 0.2, 8),
          material('#40342b'),
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
        dynamic.push(() => {
          (filament.material as ReturnType<typeof material>).color.set(
            rig.heater > 0.3 && settings.toggles.ht ? '#ef8b35' : '#4f2f19',
          );
        });
      }
    }

    for (const control of module.controls) {
      const x = control.x;
      const cy = module.units >= 4 ? -0.28 : -0.2;
      if (control.kind === 'knob') {
        disc(panel, 0.26, '#1e2422', x, cy, 0.25);
        const knob = new Mesh(
          new CylinderGeometry(0.18, 0.2, 0.13, 12),
          material('#252928'),
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
        const id = control.id;
        const update = () => {
          mark.rotation.z = -(settings.knobs[id] - 0.5) * 4.4;
        };
        dynamic.push(update);
        bind(knob, () => {
          settings.knobs[id] = (settings.knobs[id] + 0.1) % 1.01;
          applyRack(settings, rig.controls);
          write(knobLine(id, settings.knobs[id]));
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
            write(toggleLine(id, settings.toggles[id]));
          } else {
            rig.controls.mains = !rig.controls.mains;
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
    const instrumentY = module.units >= 4 ? 0.28 : -0.05;
    for (const [index, instrument] of module.instruments.entries()) {
      const x = module.instruments.length === 1 ? 1.27 : 1.0 + index * 0.75;
      if (instrument === 'scope') {
        const scope = createScopeScreen(96, 64);
        textures.push(scope.texture);
        const screen = new Mesh(
          new PlaneGeometry(1.15, 0.77),
          createPs1Material({ map: scope.texture }, true),
        );
        materials.push(screen.material);
        screen.position.set(1.15, instrumentY, 0.29);
        panel.add(screen);
        dynamic.push(() => {
          const points: [number, number][] = Array.from(
            { length: 40 },
            (_, i) => [
              i / 39,
              0.5 +
                Math.sin(i * 0.7 + performance.now() * 0.003) *
                  rig.field *
                  (0.18 + rig.instability * 0.15),
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
        screen.position.set(1.36, instrumentY - 0.42, 0.29);
        panel.add(screen);
        dynamic.push(() =>
          nixie.draw(
            String(Math.round(rig.spindle * 3600)).padStart(6, '0'),
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
  }

  const overlay = document.createElement('div');
  overlay.className = 'rack-ui';
  overlay.innerHTML = `<div class="rack-heading"><strong>VX3 / FULL RIG</strong><small>VALVE-ERA ANALOGUE COMPUTOR · c. 1960</small><span id="rig-status">RIG COLD</span></div><div class="view-switch" role="group" aria-label="Camera view"><button type="button" data-view="perspective" aria-pressed="true">PERSPECTIVE</button><button type="button" data-view="isometric" aria-pressed="false">ISOMETRIC</button></div><div class="rack-nav"><button type="button" data-pan="up" aria-label="Scroll up the rack">▲</button><span id="unit-readout"></span><button type="button" data-pan="down" aria-label="Scroll down the rack">▼</button></div><aside class="logbook"><div class="logbook-head"><strong>OPERATOR'S LOG</strong><button type="button" id="close-log" aria-label="Put the logbook away">×</button></div><ol id="log-entries"></ol></aside><button type="button" class="notebook-tab" id="open-log" hidden>▤ LOG <span id="unread-count"></span></button><p class="rack-help">WHEEL OR DRAG TO SCROLL · CLICK CONTROLS</p>`;
  canvas.parentElement?.append(overlay);
  const status = overlay.querySelector<HTMLElement>('#rig-status')!;
  const entries = overlay.querySelector<HTMLOListElement>('#log-entries')!;
  const unitReadout = overlay.querySelector<HTMLElement>('#unit-readout')!;
  const logbook = overlay.querySelector<HTMLElement>('.logbook')!;
  const tab = overlay.querySelector<HTMLButtonElement>('#open-log')!;
  const unread = overlay.querySelector<HTMLElement>('#unread-count')!;
  let logOpen = true;
  let unseen = 0;
  const write = (line: string) => {
    const item = document.createElement('li');
    item.textContent = `${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}  ${line}`;
    entries.prepend(item);
    while (entries.children.length > 25) entries.lastElementChild?.remove();
    if (!logOpen) {
      unseen++;
      unread.textContent = String(unseen);
      tab.setAttribute('aria-label', `Open logbook, ${unseen} new entries`);
    }
  };
  write('Rack opened. Historical full VX3 cold. No two standard racks alike.');
  overlay.querySelector('#close-log')!.addEventListener('click', () => {
    logOpen = false;
    logbook.hidden = true;
    tab.hidden = false;
  });
  tab.addEventListener('click', () => {
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
      view = button.dataset.view === 'isometric' ? 'isometric' : 'perspective';
      for (const option of overlay.querySelectorAll<HTMLButtonElement>(
        '[data-view]',
      )) {
        option.setAttribute('aria-pressed', String(option === button));
      }
    });
  }

  const halfTravel = Math.max(0, (totalHeight - 3.2) / 2);
  let pan = halfTravel;
  const panTo = (value: number) => {
    pan = Math.max(-halfTravel, Math.min(halfTravel, value));
    unitReadout.textContent = `U ${String(Math.max(1, Math.floor((halfTravel - pan) / U) + 1)).padStart(2, '0')} / ${Math.round(totalHeight / U)}`;
  };
  panTo(pan);
  overlay
    .querySelector('[data-pan="up"]')!
    .addEventListener('click', () => panTo(pan + 1.5));
  overlay
    .querySelector('[data-pan="down"]')!
    .addEventListener('click', () => panTo(pan - 1.5));
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    panTo(pan - event.deltaY * 0.004);
  };
  canvas.addEventListener('wheel', wheel, { passive: false });
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let drag: { y: number; pan: number; moved: boolean } | null = null;
  const down = (event: PointerEvent) => {
    canvas.setPointerCapture(event.pointerId);
    drag = { y: event.clientY, pan, moved: false };
  };
  const move = (event: PointerEvent) => {
    if (!drag) return;
    if (Math.abs(event.clientY - drag.y) > 5) drag.moved = true;
    if (drag.moved) panTo(drag.pan + (event.clientY - drag.y) * 0.008);
  };
  const up = (event: PointerEvent) => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (moved) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera());
    const hit = raycaster.intersectObjects(interactive, false)[0];
    if (hit) actions.get(hit.object.id)?.();
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
    isometricCamera.left = -3.9 * (width / height);
    isometricCamera.right = 3.9 * (width / height);
    isometricCamera.top = 3.9;
    isometricCamera.bottom = -3.9;
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
      if (event.kind === 'warmed')
        write('Heaters at temperature. The cabinet smells like dust.');
      if (event.kind === 'field-locked') write('H-B field locked. Lovely hum.');
      if (event.kind === 'warning')
        write('H-B field wandering. Strain rising.');
      if (event.kind === 'incident') write(event.text);
    }
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
    for (const update of dynamic) update();
    const sway = reducedMotion.matches ? 0 : Math.sin(time / 5000) * 0.05;
    perspectiveCamera.position.set(1.25 + sway, pan + 0.22, 8.8);
    perspectiveCamera.lookAt(0, pan, 0);
    isometricCamera.position.set(5.5, pan + 3.5, 7.5);
    isometricCamera.lookAt(0, pan, 0);
    ps1Uniforms.snapPixels.value = reducedMotion.matches ? 0 : 1;
    renderer.render(scene, camera());
  });
  return () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    canvas.removeEventListener('wheel', wheel);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    overlay.remove();
    scene.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    for (const item of materials) item.dispose();
    for (const item of textures) item.dispose();
    renderer.dispose();
  };
}
