import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  Vector2,
} from 'three';
import type { Material } from 'three';
import { createPs1Material } from '../rendering/ps1-material';

/** Rounded glass envelope, Bakelite base, plate cage, getter and heater. */
export function createThermionicValve() {
  const group = new Group();
  const materials: Material[] = [];
  const paint = (color: string, glow = false) => {
    const material = createPs1Material({ color }, glow, glow);
    materials.push(material);
    return material;
  };
  const base = paint('#28261f');
  const steel = paint('#69726a');
  const mica = paint('#b4b9a4');
  const getter = paint('#484d45');
  const glass = createPs1Material({
    color: '#bfd0c5',
    transparent: true,
    opacity: 0.23,
    depthWrite: false,
    metalness: 0.1,
  });
  materials.push(glass);
  const heater = paint('#3e1d0d', true);
  const add = (
    geometry: BoxGeometry | CylinderGeometry | LatheGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const item = new Mesh(geometry, material);
    item.position.set(x, y, z);
    group.add(item);
    return item;
  };
  add(new CylinderGeometry(0.13, 0.13, 0.035, 12), steel, 0, -0.18, 0.34);
  add(new CylinderGeometry(0.092, 0.098, 0.055, 10), base, 0, -0.14, 0.34);
  for (let i = 0; i < 5; i++)
    add(
      new CylinderGeometry(0.006, 0.006, 0.035, 5),
      steel,
      (i - 2) * 0.03,
      -0.17,
      0.39,
    );
  const outline = [
    new Vector2(0.067, -0.11),
    new Vector2(0.087, -0.07),
    new Vector2(0.092, 0.09),
    new Vector2(0.087, 0.14),
    new Vector2(0.06, 0.175),
    new Vector2(0.018, 0.19),
    new Vector2(0, 0.195),
  ];
  add(new LatheGeometry(outline, 12), glass, 0, 0, 0.34);
  for (const x of [-0.052, 0.052])
    add(new BoxGeometry(0.017, 0.16, 0.085), steel, x, 0.03, 0.34);
  for (const y of [-0.064, 0.118])
    add(new CylinderGeometry(0.067, 0.067, 0.01, 8), mica, 0, y, 0.34);
  add(new CylinderGeometry(0.04, 0.04, 0.008, 10), getter, 0, 0.155, 0.34);
  for (const x of [-0.018, 0.018])
    add(new BoxGeometry(0.005, 0.095, 0.005), heater, x, -0.01, 0.387);
  add(new BoxGeometry(0.039, 0.005, 0.005), heater, 0, 0.039, 0.387);
  let level = 0;
  let last: number | undefined;
  return {
    group,
    update(target: number, seconds: number, reducedMotion: boolean) {
      const delta = last === undefined ? 0 : Math.min(0.1, seconds - last);
      last = seconds;
      level += (target - level) * (1 - Math.exp(-delta / 0.8));
      const brightness =
        level * (reducedMotion ? 1 : 0.94 + Math.sin(seconds * 3) * 0.06);
      heater.color.setRGB(
        0.2 + brightness * 0.8,
        0.08 + brightness * 0.4,
        0.02 + brightness * 0.08,
      );
    },
    dispose() {
      group.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
      for (const material of materials) material.dispose();
    },
  };
}
