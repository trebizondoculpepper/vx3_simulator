import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  TubeGeometry,
  Curve,
  Vector3,
} from 'three';
import type { BufferGeometry, Material, Texture } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createCanvasTexture } from './screens';

/** A tight helix for the handset's coiled cord. */
class CoilCurve extends Curve<Vector3> {
  constructor(
    private readonly start: Vector3,
    private readonly end: Vector3,
    private readonly turns: number,
    private readonly radius: number,
  ) {
    super();
  }

  getPoint(t: number, target = new Vector3()) {
    const angle = t * this.turns * Math.PI * 2;
    return target
      .lerpVectors(this.start, this.end, t)
      .add(
        new Vector3(
          Math.cos(angle) * this.radius,
          0,
          Math.sin(angle) * this.radius,
        ),
      );
  }
}

/** Yellow-and-black hazard sign with the hotline's name in heavy capitals. */
function createHotlineSign() {
  const width = 192;
  const height = 72;
  const { context, texture } = createCanvasTexture(width, height);
  context.fillStyle = '#f2c230';
  context.fillRect(0, 0, width, height);
  // Hazard stripes around the border.
  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.rect(8, 8, width - 16, height - 16);
  context.clip('evenodd');
  context.fillStyle = '#151511';
  for (let x = -height; x < width + height; x += 16) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + 8, 0);
    context.lineTo(x + 8 - height, height);
    context.lineTo(x - height, height);
    context.closePath();
    context.fill();
  }
  context.restore();
  context.fillStyle = '#151511';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = 'bold 15px monospace';
  context.fillText('EMERGENCY', width / 2, 22);
  context.fillText('DECOHERENCE', width / 2, 37);
  context.fillText('HOTLINE', width / 2, 52);
  texture.needsUpdate = true;
  return { texture, width, height };
}

/**
 * A red 1970s wall telephone with a rotary dial, handset in its cradle and a
 * coiled cord, under a yellow-and-black EMERGENCY DECOHERENCE HOTLINE sign.
 * The group's origin is the centre of the phone body, on the wall surface.
 */
export function createHotlinePhone() {
  const group = new Group();
  group.name = 'HotlinePhone';
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const mesh = (
    geometry: BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    unlit = false,
  ) => {
    const material = createPs1Material({ color }, unlit);
    materials.push(material);
    const result = new Mesh(geometry, material);
    result.position.set(x, y, z);
    group.add(result);
    return result;
  };

  const red = '#b8241c';
  const darkRed = '#86170f';
  // Wall plate, then the body with a slightly smaller front step.
  mesh(new BoxGeometry(0.5, 0.66, 0.03), '#2d2b26', 0, 0, 0.015);
  mesh(new BoxGeometry(0.42, 0.56, 0.16), red, 0, 0, 0.11);
  mesh(new BoxGeometry(0.36, 0.48, 0.03), darkRed, 0, -0.02, 0.2);

  // Rotary dial: chrome ring, cream finger plate with ten holes, centre card.
  mesh(
    new CylinderGeometry(0.135, 0.135, 0.02, 14),
    '#b9b6aa',
    0,
    -0.05,
    0.22,
  ).rotation.x = Math.PI / 2;
  mesh(new CircleGeometry(0.12, 14), '#e6dcc2', 0, -0.05, 0.232);
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI * 0.35 + (i / 10) * Math.PI * 1.6;
    mesh(
      new CircleGeometry(0.019, 6),
      '#3a2a22',
      Math.cos(angle) * 0.085,
      -0.05 + Math.sin(angle) * 0.085,
      0.234,
    );
  }
  mesh(new CircleGeometry(0.04, 10), '#f4ecd4', 0, -0.05, 0.236);
  mesh(
    new BoxGeometry(0.012, 0.03, 0.01),
    '#b9b6aa',
    0.11,
    -0.14,
    0.235,
  ).rotation.z = -0.6; // finger stop

  // Handset resting in the cradle across the top.
  const handsetY = 0.31;
  mesh(new BoxGeometry(0.46, 0.05, 0.08), darkRed, 0, handsetY - 0.04, 0.17);
  const grip = mesh(new BoxGeometry(0.34, 0.06, 0.07), red, 0, handsetY, 0.19);
  grip.rotation.z = 0.02;
  for (const side of [-1, 1]) {
    const cup = mesh(
      new CylinderGeometry(0.06, 0.05, 0.07, 8),
      red,
      side * 0.2,
      handsetY - 0.02,
      0.2,
    );
    cup.rotation.x = Math.PI / 2;
  }

  // Coiled cord from the left of the body to the handset.
  const cord = new CoilCurve(
    new Vector3(-0.23, -0.2, 0.15),
    new Vector3(-0.22, handsetY - 0.06, 0.22),
    9,
    0.025,
  );
  mesh(new TubeGeometry(cord, 140, 0.007, 4, false), '#7a160f', 0, 0, 0);

  // The sign, screwed to the wall above the phone.
  const sign = createHotlineSign();
  textures.push(sign.texture);
  const signMaterial = createPs1Material({ map: sign.texture }, true);
  materials.push(signMaterial);
  const signMesh = new Mesh(
    new PlaneGeometry(sign.width / 220, sign.height / 220),
    signMaterial,
  );
  signMesh.position.set(0, 0.72, 0.012);
  group.add(signMesh);
  for (const x of [-0.4, 0.4])
    mesh(new CircleGeometry(0.014, 6), '#8a8a80', x, 0.72, 0.016);

  return {
    group,
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const item of materials) item.dispose();
      for (const item of textures) item.dispose();
    },
  };
}
