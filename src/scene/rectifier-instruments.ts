import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
} from 'three';
import type { Material, Texture } from 'three';
import { designate } from '../game/machine-parts';
import { rectifierReadings } from '../game/rectifier-readings';
import { createPs1Material } from '../rendering/ps1-material';
import { createCanvasTexture, createLabelTexture } from './screens';

type MeterSpec = { name: string; caption: string; unit: string; max: number };

const meters: MeterSpec[] = [
  { name: 'AC input voltmeter', caption: 'NETZ', unit: 'V~', max: 300 },
  { name: 'DC output voltmeter', caption: 'AUSGANG', unit: 'V=', max: 250 },
  { name: 'DC load ammeter', caption: 'LAST', unit: 'A=', max: 50 },
];

function meterDial(spec: MeterSpec) {
  const { context: c, texture } = createCanvasTexture(128, 128);
  c.fillStyle = '#ece6d3';
  c.fillRect(0, 0, 128, 128);
  c.strokeStyle = '#343b36';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(64, 64, 59, 0, Math.PI * 2);
  c.stroke();
  for (let i = 0; i <= 10; i++) {
    const angle = ((-135 + i * 27 - 90) * Math.PI) / 180;
    const major = i % 5 === 0;
    c.lineWidth = major ? 3 : 2;
    c.beginPath();
    c.moveTo(
      64 + Math.cos(angle) * (major ? 41 : 45),
      64 + Math.sin(angle) * (major ? 41 : 45),
    );
    c.lineTo(64 + Math.cos(angle) * 53, 64 + Math.sin(angle) * 53);
    c.stroke();
  }
  c.fillStyle = '#343b36';
  c.textAlign = 'center';
  c.font = 'bold 17px monospace';
  c.fillText(spec.unit, 64, 91);
  c.font = 'bold 12px monospace';
  c.fillText('0', 30, 107);
  c.fillText(String(spec.max), 100, 107);
  texture.needsUpdate = true;
  return texture;
}

/** Period-style voltmeters and ammeter between the throw switch and breakers. */
export function createRectifierInstruments(m: number) {
  const group = new Group();
  group.name = 'MercuryRectifierInstruments';
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const painted = (color: string) => {
    const material = createPs1Material({ color });
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
    const mesh = new Mesh(
      new BoxGeometry(width, height, depth),
      painted(color),
    );
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  box(1.32 * m, 0.66 * m, 0.09 * m, '#414e49', 0, 0, 0);
  box(1.28 * m, 0.62 * m, 0.012 * m, '#879188', 0, 0, 0.052 * m);
  const plate = createLabelTexture('GLEICHRICHTER · MESSWERTE', {
    ink: '#eee5c6',
    plate: '#35423d',
    size: 16,
  });
  textures.push(plate.texture);
  const plateMaterial = createPs1Material({ map: plate.texture }, true, true);
  materials.push(plateMaterial);
  const header = new Mesh(new PlaneGeometry(0.9 * m, 0.075 * m), plateMaterial);
  header.position.set(0, 0.255 * m, 0.061 * m);
  group.add(header);
  for (const x of [-0.62 * m, 0.62 * m])
    for (const y of [-0.29 * m, 0.29 * m])
      box(0.024 * m, 0.024 * m, 0.01 * m, '#c6ba91', x, y, 0.064 * m);

  const needles: Mesh[] = [];
  meters.forEach((spec, index) => {
    const x = (index - 1) * 0.42 * m;
    const bezel = new Mesh(
      new CylinderGeometry(0.17 * m, 0.17 * m, 0.022 * m, 16),
      painted('#303730'),
    );
    bezel.rotation.x = Math.PI / 2;
    bezel.position.set(x, 0.01 * m, 0.08 * m);
    group.add(bezel);
    const texture = meterDial(spec);
    textures.push(texture);
    const dialMaterial = createPs1Material({ map: texture }, true, true);
    materials.push(dialMaterial);
    const face = new Mesh(new CircleGeometry(0.149 * m, 20), dialMaterial);
    face.position.set(x, 0.01 * m, 0.095 * m);
    group.add(face);
    const needle = new Mesh(
      new BoxGeometry(0.009 * m, 0.116 * m, 0.004 * m),
      painted('#ae3a2b'),
    );
    needle.geometry.translate(0, 0.044 * m, 0);
    needle.position.set(x, 0.01 * m, 0.102 * m);
    needle.rotation.z = Math.PI * 0.75;
    designate(needle, {
      machine: 'Mercury-arc rectifier',
      name: spec.name,
      role: 'indicator',
    });
    group.add(needle);
    needles.push(needle);
    const caption = createLabelTexture(spec.caption, {
      ink: '#252d28',
      plate: '#b8c0b3',
      size: 15,
    });
    textures.push(caption.texture);
    const captionMaterial = createPs1Material(
      { map: caption.texture },
      true,
      true,
    );
    materials.push(captionMaterial);
    const label = new Mesh(
      new PlaneGeometry(0.34 * m, 0.067 * m),
      captionMaterial,
    );
    label.position.set(x, -0.235 * m, 0.062 * m);
    group.add(label);
  });

  const displayed = [0, 0, 0];
  return {
    group,
    update(powered: boolean, loadKw: number, delta: number) {
      const readings = rectifierReadings(powered, loadKw);
      const targets = [
        readings.inputVac / meters[0].max,
        readings.outputVdc / meters[1].max,
        readings.outputAdc / meters[2].max,
      ];
      const amount = 1 - Math.exp(-Math.max(0, delta) / 0.45);
      needles.forEach((needle, index) => {
        displayed[index] +=
          (Math.min(1, targets[index]) - displayed[index]) * amount;
        needle.rotation.z = Math.PI * (0.75 - displayed[index] * 1.5);
      });
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
