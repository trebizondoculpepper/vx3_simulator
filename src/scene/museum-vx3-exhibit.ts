import { BoxGeometry, Group, Mesh, PlaneGeometry } from 'three';
import type { Camera, Material, Texture } from 'three';
import type { SoundCue } from '../audio/sound-engine';
import { createMuseumExhibitModel } from '../game/museum-exhibit';
import { createPs1Material } from '../rendering/ps1-material';
import { GEN1_TOTAL_HEIGHT, createGen1Vx3 } from './gen1-vx3';
import type { Gen1Hookup } from './gen1-vx3';
import { createEightiesButton, createPanelKit } from './eighties-controls';
import { createCanvasTexture } from './screens';

export function createMuseumVx3Exhibit(options: {
  m: number;
  camera: Camera;
  input: Gen1Hookup['input'];
  indicator: Gen1Hookup['indicator'];
  play(cue: SoundCue): void;
  write(line: string): void;
  reducedMotion(): boolean;
}) {
  const { m, input, indicator, play, write } = options;
  const model = createMuseumExhibitModel();
  const group = new Group();
  group.name = 'Museum VX3 — field generators removed';
  group.position.z = 11.5 * m;
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const box = (
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
  ) => {
    const material = createPs1Material({ color, roughness: 0.7 });
    materials.push(material);
    const mesh = new Mesh(new BoxGeometry(w * m, h * m, d * m), material);
    mesh.position.set(x * m, y * m, z * m);
    group.add(mesh);
    return mesh;
  };
  // Shallow platform: walk round the whole display and reach the original controls.
  box(2.4, 0.08, 1.65, '#454d46', 0, 0.04, 0);
  box(2.45, 0.015, 1.7, '#a9935c', 0, 0.0875, 0);
  const platform = new Group();
  platform.position.y = 0.1 * m;
  platform.rotation.y = Math.PI;
  group.add(platform);
  const machine = createGen1Vx3({
    floorY: -GEN1_TOTAL_HEIGHT / 2 - 0.23,
    rig: model.rig,
    settings: model.settings,
    camera: options.camera,
    fieldGeneratorsRemoved: true,
    input: (object, machineName, name, action) =>
      input(object, `Museum VX3 / ${machineName}`, name, (hit) => {
        action(hit);
        model.sync();
      }),
    indicator: (object, machineName, name) =>
      indicator(object, `Museum VX3 / ${machineName}`, name),
    play,
    write,
    flipToggle: (id) => {
      model.toggle(id);
      play(model.settings.toggles[id] ? 'toggle-up' : 'toggle-down');
      write(
        `${id} ${model.settings.toggles[id] ? 'eingeschaltet' : 'ausgeschaltet'}.`,
      );
    },
    flipMains: () => {
      model.mains();
      play('rocker');
      write(
        `Geräteschalter ${model.settings.mains ? 'eingeschaltet' : 'ausgeschaltet'}.`,
      );
    },
    resetRig: () => {
      model.stop();
      write('Vorführung beendet; Auslauf gestartet.');
    },
    purge: () => {
      write('Museumsvorführung: Gassystem abgetrennt.');
    },
    reducedMotion: options.reducedMotion,
    pi: () => Math.PI,
    darkness: () => 0,
  });
  machine.group.position.set(-2.675, GEN1_TOTAL_HEIGHT / 2 + 0.23, 0);
  platform.add(machine.group);

  // Child-height pedestal with exactly one large physical START button.
  box(0.44, 0.07, 0.43, '#363e3a', 0, 0.035, -1.8);
  box(0.17, 0.68, 0.17, '#59665b', 0, 0.41, -1.8);
  box(0.5, 0.29, 0.09, '#c4c2ad', 0, 0.86, -1.8);
  const kit = createPanelKit();
  const start = createEightiesButton(kit, 'START', 'green', {
    size: 0.105,
    latching: false,
    illuminated: false,
  });
  start.group.scale.setScalar(m);
  start.group.rotation.y = Math.PI;
  start.group.position.set(0, 0.84 * m, -1.855 * m);
  group.add(start.group);
  input(start.cap, 'Museum VX3', 'START', () => {
    if (!model.start()) return;
    start.press();
    play('button');
    write('Vorführung gestartet: langsamer Hochlauf.');
  });
  const sign = createCanvasTexture(768, 384);
  textures.push(sign.texture);
  const signMaterial = createPs1Material({ map: sign.texture }, true);
  materials.push(signMaterial);
  const plaque = indicator(
    new Mesh(new PlaneGeometry(1.8 * m, 0.9 * m), signMaterial),
    'Museum VX3',
    'Vorführungsstatus',
  );
  plaque.position.set(0, 1.15 * m, 1.0 * m);
  plaque.rotation.y = Math.PI;
  // Put the explanation beside the pedestal, leaving the rack face accessible.
  plaque.position.set(-2.2 * m, 1.25 * m, -0.6 * m);
  group.add(plaque);
  box(0.08, 1.0, 0.08, '#454d46', -2.2, 0.5, -0.55);
  const phaseLabels = {
    inactive: 'BEREIT — START DRÜCKEN',
    starting: 'LANGSAMER HOCHLAUF',
    running: 'VORFÜHRUNG IN BETRIEB',
    stopping: 'AUTOMATISCHER AUSLAUF',
  };
  let lastStatus = '';
  return {
    group,
    model,
    update(delta: number) {
      model.tick(delta);
      machine.update(delta);
      start.update(delta);
      const status = `${phaseLabels[model.phase]}${model.phase === 'running' ? ` · ${Math.ceil(model.remaining)} s` : ''}`;
      if (status === lastStatus) return;
      lastStatus = status;
      const c = sign.context;
      c.fillStyle = '#ddd3b7';
      c.fillRect(0, 0, 768, 384);
      c.strokeStyle = '#726346';
      c.lineWidth = 5;
      c.strokeRect(10, 10, 748, 364);
      c.textAlign = 'center';
      c.fillStyle = '#26382f';
      c.font = 'bold 34px monospace';
      c.fillText('VX3 · GENERATION 1', 384, 63);
      c.font = '23px monospace';
      [
        'FELDGENERATOREN AUSGEBAUT',
        'Diese Vorführung ist ungefährlich.',
        'Schalter und Regler dürfen bedient werden.',
        '30 s Hochlauf · 60 s Betrieb · Auslauf',
      ].forEach((line, i) => c.fillText(line, 384, 120 + 42 * i, 720));
      c.font = 'bold 25px monospace';
      c.fillText(status, 384, 336, 720);
      sign.texture.needsUpdate = true;
    },
    dispose() {
      machine.dispose();
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const item of [...materials, ...kit.materials]) item.dispose();
      for (const item of [...textures, ...kit.textures]) item.dispose();
    },
  };
}
