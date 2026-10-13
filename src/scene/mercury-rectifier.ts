import { mercuryArcLight } from '../game/mercury-arc-light';
import { designate } from '../game/machine-parts';
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  PlaneGeometry,
  PointLight,
  Vector2,
} from 'three';
import type { Material, Texture, MeshStandardMaterial } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createLabelTexture } from './screens';

/** Glass bulb and electrode arms inspired by the owner's reference images.
 * Local dimensions are metres, facing +z; origin at floor level.
 */
export function createMercuryRectifier(m: number) {
  const group = new Group();
  group.name = 'MercuryArcRectifier';
  group.scale.setScalar(m);
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const metal = createPs1Material({ color: '#4d5b58' });
  materials.push(metal);
  const brass = createPs1Material({ color: '#9d8b59' });
  materials.push(brass);
  const dark = createPs1Material({ color: '#151f20' });
  materials.push(dark);
  const glass = createPs1Material({
    color: '#275b71',
    transparent: true,
    opacity: 0.78,
    emissive: '#0875ac',
    emissiveIntensity: 0.02,
  }) as MeshStandardMaterial;
  materials.push(glass);
  const glow = createPs1Material({ color: '#182a30' }, true, true);
  materials.push(glow);
  const add = (
    geometry: BoxGeometry | CylinderGeometry | LatheGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  for (const x of [-0.48, 0.48]) {
    add(new BoxGeometry(0.055, 1.95, 0.055), metal, x, 0.975, 0);
    for (const y of [0.14, 1.88])
      add(new BoxGeometry(0.06, 0.055, 0.65), metal, x, y, 0.22);
  }
  for (const y of [0.14, 1.88])
    add(new BoxGeometry(1.02, 0.055, 0.055), metal, 0, y, 0.02);
  add(new BoxGeometry(1.04, 0.06, 0.68), metal, 0, 0.1, 0.2);
  const vessel = [
    new Vector2(0.035, 0),
    new Vector2(0.09, 0.1),
    new Vector2(0.2, 0.27),
    new Vector2(0.29, 0.54),
    new Vector2(0.32, 0.73),
    new Vector2(0.28, 0.89),
    new Vector2(0.18, 1.0),
    new Vector2(0, 1.05),
  ];
  add(new LatheGeometry(vessel, 16), glass, 0, 0.67, 0.22);
  add(new CylinderGeometry(0.32, 0.32, 0.027, 16), brass, 0, 1.42, 0.22);
  add(new CylinderGeometry(0.035, 0.045, 0.27, 8), dark, 0, 0.62, 0.22);
  const core = add(
    new CylinderGeometry(0.023, 0.055, 0.36, 8),
    glow,
    0,
    0.86,
    0.22,
  );
  for (const [i, x] of [-0.34, -0.18, 0.18, 0.34].entries()) {
    const arm = add(
      new CylinderGeometry(0.045, 0.063, 0.46, 8),
      glow,
      x,
      0.77,
      0.22 + (i % 2) * 0.06,
    );
    arm.rotation.z = -Math.sign(x) * 0.85;
    const socket = add(
      new CylinderGeometry(0.061, 0.061, 0.12, 8),
      dark,
      x * 1.48,
      0.94,
      0.22 + (i % 2) * 0.06,
    );
    socket.rotation.z = arm.rotation.z;
    add(new BoxGeometry(0.026, 0.35, 0.026), brass, x * 1.48, 1.14, 0.22);
  }
  const badge = createLabelTexture('QUECKSILBER-GLEICHRICHTER', { size: 14 });
  textures.push(badge.texture);
  const print = createPs1Material({ map: badge.texture }, true);
  materials.push(print);
  const plate = new Mesh(new PlaneGeometry(0.91, 0.055), print);
  plate.position.set(0, 0.19, 0.55);
  group.add(plate);
  const light = new PointLight('#b4efff', 0, 12 * m, 1.2);
  light.castShadow = true;
  light.shadow.mapSize.set(512, 512);
  light.shadow.camera.near = 0.05 * m;
  light.shadow.camera.far = 12 * m;
  light.shadow.bias = -0.0002;
  light.shadow.normalBias = 0.015 * m;
  light.position.set(0, 0.9, 0.28);
  group.add(light);
  // The bulb and its arc glow show whether the plant supply is live.
  group.traverse((object) => {
    if (
      object instanceof Mesh &&
      (object.material === glass || object.material === glow)
    )
      designate(object, {
        machine: 'Mercury-arc rectifier',
        name: object.material === glow ? 'Arc glow' : 'Bulb',
        role: 'indicator',
      });
  });
  let lightLevel = 0;
  return {
    group,
    get lightLevel() {
      return lightLevel;
    },
    update(on: boolean, seconds: number, reducedMotion: boolean) {
      const pulse = mercuryArcLight(on, seconds, reducedMotion);
      lightLevel = pulse;
      glow.color.set(on ? '#d8fbff' : '#182a30');
      if (on) glow.color.multiplyScalar(pulse);
      glass.emissiveIntensity = on ? 2.5 * pulse : 0.02;
      light.intensity = on ? 190 * pulse : 0;
      core.scale.x = 1;
    },
    dispose() {
      group.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
