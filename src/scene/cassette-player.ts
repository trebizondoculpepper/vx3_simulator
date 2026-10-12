import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
} from 'three';
import type { Material, Object3D, Texture } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createCanvasTexture, createLabelTexture } from './screens';

export type CassetteTransport = 'play' | 'stop' | 'fast-forward';

/** An upright portable 1980s cassette player. Front faces local +z. Metres. */
export function createCassettePlayer(worldUnitsPerMetre: number) {
  const group = new Group();
  group.name = 'CassettePlayer';
  group.scale.setScalar(worldUnitsPerMetre);
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const paint = (color: string) => {
    const material = createPs1Material({ color, roughness: 0.85 });
    materials.push(material);
    return material;
  };
  const box = (
    width: number,
    height: number,
    depth: number,
    color: string,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new Mesh(new BoxGeometry(width, height, depth), paint(color));
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const disc = (
    radius: number,
    height: number,
    color: string,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new Mesh(
      new CylinderGeometry(radius, radius, height, 10),
      paint(color),
    );
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const label = (
    value: string,
    width: number,
    x: number,
    y: number,
    z: number,
  ) => {
    const image = createLabelTexture(value, {
      ink: '#302c21',
      plate: '#d7c8a5',
      size: 14,
    });
    textures.push(image.texture);
    const material = createPs1Material({ map: image.texture }, true);
    materials.push(material);
    const mesh = new Mesh(
      new PlaneGeometry(width, (width * image.height) / image.width),
      material,
    );
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  // Silver case, black top and raised folding handle.
  box(0.56, 0.29, 0.17, '#b7bcb9', 0, 0.153, 0);
  box(0.55, 0.035, 0.175, '#353a3a', 0, 0.289, 0);
  for (const x of [-0.225, 0.225]) {
    box(0.055, 0.016, 0.13, '#292e2e', x, 0.009, 0);
    box(0.018, 0.09, 0.018, '#6f7778', x, 0.35, -0.026);
  }
  box(0.47, 0.025, 0.027, '#333839', 0, 0.398, -0.026);
  const tuningKnob = disc(0.045, 0.022, '#4d5555', 0.291, 0.233, 0.004);
  tuningKnob.rotation.z = Math.PI / 2;

  // Glazed radio scale above the cassette deck.
  const tuner = createCanvasTexture(384, 55);
  textures.push(tuner.texture);
  const t = tuner.context;
  t.fillStyle = '#293334';
  t.fillRect(0, 0, 384, 55);
  t.fillStyle = '#d9d4bc';
  t.font = 'bold 13px monospace';
  t.fillText('UKW', 11, 18);
  t.fillText('MW', 12, 43);
  t.font = '11px monospace';
  ['88', '92', '96', '100', '104', '108'].forEach((frequency, i) => {
    const x = 91 + i * 50;
    t.fillText(frequency, x - 8, 18);
    t.fillRect(x, 22, 1, 7);
  });
  t.fillStyle = '#e8664b';
  t.fillRect(213, 4, 3, 46);
  t.fillStyle = '#bca982';
  t.fillRect(85, 38, 274, 1);
  tuner.texture.needsUpdate = true;
  const tunerMaterial = createPs1Material({ map: tuner.texture }, true);
  materials.push(tunerMaterial);
  box(0.49, 0.058, 0.008, '#5b6464', 0, 0.244, 0.089);
  const tunerFace = new Mesh(new PlaneGeometry(0.475, 0.047), tunerMaterial);
  tunerFace.position.set(0, 0.244, 0.095);
  group.add(tunerFace);

  // Two big front-facing speakers with printed mesh over dark cones.
  const grille = createCanvasTexture(128, 128);
  textures.push(grille.texture);
  const g = grille.context;
  g.fillStyle = '#22292b';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#485153';
  g.beginPath();
  g.arc(64, 64, 42, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#283033';
  g.beginPath();
  g.arc(64, 64, 19, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#a6afaa';
  for (let y = 5; y < 128; y += 7)
    for (let x = 5; x < 128; x += 7)
      if ((x - 64) ** 2 + (y - 64) ** 2 < 60 ** 2) {
        g.beginPath();
        g.arc(x, y, 1.3, 0, Math.PI * 2);
        g.fill();
      }
  grille.texture.needsUpdate = true;
  const grilleMaterial = createPs1Material({ map: grille.texture }, true);
  materials.push(grilleMaterial);
  for (const x of [-0.168, 0.168]) {
    const rim = disc(0.104, 0.007, '#e4e5db', x, 0.124, 0.091);
    rim.rotation.x = Math.PI / 2;
    const speaker = new Mesh(new CircleGeometry(0.096, 24), grilleMaterial);
    speaker.position.set(x, 0.124, 0.096);
    group.add(speaker);
  }

  // Centre cassette door, smoked window, two hubs and a tape counter.
  box(0.123, 0.145, 0.012, '#737d7b', 0, 0.126, 0.092);
  box(0.113, 0.126, 0.006, '#d9d9cc', 0, 0.128, 0.101);
  box(0.102, 0.069, 0.003, '#252e2e', 0, 0.151, 0.106);
  const reels = [-0.026, 0.026].map((x) => {
    const reel = new Group();
    reel.position.set(x, 0.155, 0.109);
    group.add(reel);
    const hub = new Mesh(
      new CylinderGeometry(0.016, 0.016, 0.003, 10),
      paint('#d9d5c3'),
    );
    hub.rotation.x = Math.PI / 2;
    reel.add(hub);
    for (let spoke = 0; spoke < 3; spoke++) {
      const bar = new Mesh(
        new BoxGeometry(0.004, 0.025, 0.004),
        paint('#555d59'),
      );
      bar.rotation.z = (spoke * Math.PI) / 3;
      bar.position.z = 0.003;
      reel.add(bar);
    }
    return reel;
  });
  label('KASSETTE', 0.087, 0, 0.095, 0.106);
  box(0.074, 0.016, 0.005, '#2d3332', 0, 0.049, 0.103);
  label('000', 0.041, 0, 0.049, 0.107);

  const controls: Array<{
    name: CassetteTransport;
    parts: readonly Object3D[];
  }> = [];
  const buttons: Partial<Record<CassetteTransport, Mesh[]>> = {};
  for (const [index, name, symbol] of [
    [0, 'play', '▶'],
    [1, 'stop', '■'],
    [2, 'fast-forward', '≫'],
  ] as const) {
    const x = -0.15 + index * 0.15;
    box(0.085, 0.008, 0.045, '#171d1e', x, 0.312, 0.025);
    const button = box(0.078, 0.016, 0.038, '#919a97', x, 0.324, 0.025);
    buttons[name] = [button];
    controls.push({ name, parts: [button] });
    label(symbol, 0.032, x, 0.282, 0.091);
  }
  const statusLamp = new Mesh(new CircleGeometry(0.005, 8), paint('#5c4836'));
  statusLamp.position.set(0.238, 0.286, 0.091);
  group.add(statusLamp);
  let transport: CassetteTransport = 'stop';
  let lastSeconds: number | undefined;
  return {
    group,
    controls,
    press(name: CassetteTransport) {
      transport = name;
      for (const [id, parts] of Object.entries(buttons)) {
        if (!parts) continue;
        const offset = (id === name ? 0.316 : 0.324) - parts[0].position.y;
        for (const part of parts) part.position.y += offset;
      }
      (statusLamp.material as ReturnType<typeof paint>).color.set(
        name === 'stop' ? '#5c4836' : '#ce513a',
      );
      return transport;
    },
    update(seconds: number, reducedMotion: boolean) {
      const delta =
        lastSeconds === undefined
          ? 0
          : Math.min(0.1, Math.max(0, seconds - lastSeconds));
      lastSeconds = seconds;
      if (transport !== 'stop' && !reducedMotion)
        for (const reel of reels)
          reel.rotation.z -= delta * (transport === 'play' ? 3 : 12);
    },
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
