import { designate } from '../game/machine-parts';
import {
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import type { Material, Texture } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createLabelTexture } from './screens';

/** An auxiliary return-gas cooler, set against the plant room's north wall. */
export function createXenonRecirculator(m: number) {
  const group = new Group();
  group.name = 'XenonRecirculator';
  group.scale.setScalar(m);
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const paint = (color: string, lit = false) => {
    const material = createPs1Material({ color }, lit, lit);
    materials.push(material);
    return material;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
    parent = group,
  ) => {
    const mesh = new Mesh(new BoxGeometry(w, h, d), paint(color));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const label = (
    text: string,
    width: number,
    x: number,
    y: number,
    z: number,
  ) => {
    const image = createLabelTexture(text, {
      ink: '#e7dec2',
      plate: '#35423d',
      size: 16,
    });
    textures.push(image.texture);
    const material = createPs1Material({ map: image.texture }, true, true);
    materials.push(material);
    const face = new Mesh(
      new PlaneGeometry(width, (width * image.height) / image.width),
      material,
    );
    face.position.set(x, y, z);
    group.add(face);
  };
  const pipe = (points: [number, number, number][], radius: number) => {
    const curve = new CatmullRomCurve3(
      points.map(([x, y, z]) => new Vector3(x, y, z)),
    );
    const tube = new Mesh(
      new TubeGeometry(curve, 20, radius, 6, false),
      paint('#ac8151'),
    );
    group.add(tube);
  };

  // A squat steel heat exchanger: service plinth, finned core, pump and fan.
  box(0.94, 0.08, 0.57, '#313b38', 0, 0.05, 0);
  box(0.88, 1.48, 0.51, '#65776e', 0, 0.83, 0);
  box(0.84, 0.63, 0.03, '#303b39', 0, 1.02, 0.272);
  for (let i = 0; i < 12; i++)
    box(0.024, 0.56, 0.04, '#a3ada3', -0.37 + i * 0.067, 1.02, 0.295);
  box(0.8, 0.3, 0.035, '#d4d0b9', 0, 0.37, 0.28);
  label('XENON-RÜCKFÜHRUNG', 0.69, 0, 1.53, 0.277);
  label('SYNCLEX · KÜHLER', 0.5, 0, 0.39, 0.305);

  const fan = new Group();
  fan.position.set(-0.23, 0.65, 0.304);
  group.add(fan);
  const ring = new Mesh(
    new CylinderGeometry(0.145, 0.145, 0.025, 12),
    paint('#333d38'),
  );
  ring.rotation.x = Math.PI / 2;
  fan.add(ring);
  const rotor = new Group();
  rotor.position.z = 0.018;
  fan.add(rotor);
  for (let i = 0; i < 4; i++) {
    const blade = box(0.045, 0.105, 0.006, '#b6b6a3', 0, 0.066, 0, rotor);
    blade.rotation.z = (i * Math.PI) / 2;
    blade.position.set(
      Math.sin(blade.rotation.z) * -0.066,
      Math.cos(blade.rotation.z) * 0.066,
      0,
    );
  }
  const hub = new Mesh(new CircleGeometry(0.035, 8), paint('#d2c49b'));
  hub.position.z = 0.009;
  rotor.add(hub);
  box(0.18, 0.15, 0.07, '#425a55', 0.22, 0.65, 0.31);
  label('PUMPE', 0.17, 0.22, 0.66, 0.355);

  // The return from the adjacent facility enters at the back left; chilled
  // xenon leaves through the right-hand wall union. The brass relief valve
  // and serial stamp echo the pre-VX4 catalogue detail.
  pipe(
    [
      [-0.32, 1.35, -0.4],
      [-0.32, 1.35, -0.22],
      [-0.32, 1.18, -0.02],
    ],
    0.025,
  );
  pipe(
    [
      [0.32, 0.83, -0.02],
      [0.43, 0.83, -0.21],
      [0.43, 0.83, -0.4],
    ],
    0.025,
  );
  pipe(
    [
      [0.32, 1.36, -0.04],
      [0.32, 1.61, -0.04],
    ],
    0.018,
  );
  const valve = new Mesh(
    new CylinderGeometry(0.05, 0.05, 0.11, 8),
    paint('#be9b5c'),
  );
  valve.position.set(0.32, 1.65, -0.04);
  group.add(valve);
  const wheel = new Mesh(
    new CylinderGeometry(0.095, 0.095, 0.015, 8),
    paint('#9d4b35'),
  );
  wheel.position.set(0.32, 1.72, -0.04);
  group.add(wheel);
  label('ENTLASTUNG · VX3-T23-PP009', 0.67, 0, 0.19, 0.303);

  const switchBody = box(0.12, 0.13, 0.045, '#3c4742', 0.3, 1.36, 0.3);
  const switchLever = box(0.045, 0.12, 0.045, '#d0b886', 0.3, 1.36, 0.345);
  label('KREISLAUF', 0.26, 0.3, 1.45, 0.306);
  for (const part of [switchBody, switchLever])
    designate(part, {
      machine: 'Xenon recirculator',
      name: 'KREISLAUF switch',
      role: 'input',
    });
  const lamp = box(0.08, 0.07, 0.016, '#4c5147', -0.28, 1.37, 0.298);
  designate(lamp, {
    machine: 'Xenon recirculator',
    name: 'Betrieb lamp',
    role: 'indicator',
  });
  label('BETRIEB', 0.18, -0.28, 1.45, 0.306);
  const lampOn = paint('#7abc80', true);
  const lampOff = lamp.material;
  let enabled = false;
  let working = false;
  return {
    group,
    switchParts: [switchBody, switchLever],
    get working() {
      return working;
    },
    toggle() {
      enabled = !enabled;
      return enabled;
    },
    update(plantPowered: boolean, delta: number, reducedMotion: boolean) {
      working = plantPowered && enabled;
      switchLever.rotation.x = enabled ? -0.5 : 0.5;
      lamp.material = working ? lampOn : lampOff;
      if (working && !reducedMotion) rotor.rotation.z -= delta * 8;
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
