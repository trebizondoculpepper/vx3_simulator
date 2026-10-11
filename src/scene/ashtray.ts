import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  Sprite,
  SpriteMaterial,
} from 'three';
import type { Material } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createCanvasTexture } from './screens';

const PUFFS = 14;
const SMOKE_HEIGHT = 1.15;
const emberDim = new Color('#c8340e');
const emberBright = new Color('#ffa040');

/**
 * A 1970s amber glass ashtray with one cigarette left burning, and a thin
 * plume of smoke rising and curling above it. In the 1970s everybody smoked.
 */
export function createAshtray() {
  const group = new Group();
  group.name = 'Ashtray';
  const materials: Material[] = [];
  const add = (mesh: Mesh) => {
    materials.push(mesh.material as Material);
    group.add(mesh);
    return mesh;
  };

  // Heavy faceted glass dish with a dark, ash-dusted well.
  add(
    new Mesh(
      new CylinderGeometry(0.2, 0.17, 0.06, 8),
      createPs1Material({ color: '#b5651d' }),
    ),
  ).position.y = 0.03;
  add(
    new Mesh(
      new CylinderGeometry(0.14, 0.12, 0.02, 8),
      createPs1Material({ color: '#4a4038' }),
    ),
  ).position.y = 0.055;
  // Three cigarette rests notched into the rim.
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const rest = add(
      new Mesh(
        new BoxGeometry(0.06, 0.02, 0.05),
        createPs1Material({ color: '#7a3e12' }),
      ),
    );
    rest.position.set(Math.cos(angle) * 0.18, 0.065, Math.sin(angle) * 0.18);
    rest.rotation.y = -angle;
  }
  // A couple of stubbed-out butts from earlier in the evening.
  for (const [x, z, turn] of [
    [-0.05, 0.04, 0.6],
    [0.03, -0.06, 2.1],
  ]) {
    const butt = add(
      new Mesh(
        new CylinderGeometry(0.011, 0.011, 0.05, 5),
        createPs1Material({ color: '#c8873a' }),
      ),
    );
    butt.rotation.set(Math.PI / 2, 0, turn);
    butt.position.set(x, 0.075, z);
  }

  // The lit cigarette lies in a rest with its filter over the rim and its
  // burning tip (local -x) pointing in over the dish.
  const restAngle = -0.325;
  const cigarette = new Group();
  cigarette.position.set(0.27, 0.085, 0.09);
  cigarette.rotation.y = restAngle;
  group.add(cigarette);
  const segment = (length: number, color: string, x: number, unlit = false) => {
    const mesh = new Mesh(
      new CylinderGeometry(0.013, 0.013, length, 6),
      createPs1Material({ color }, unlit),
    );
    materials.push(mesh.material as Material);
    mesh.rotation.z = Math.PI / 2;
    mesh.position.x = x;
    cigarette.add(mesh);
    return mesh;
  };
  segment(0.05, '#c8873a', -0.025); // filter
  segment(0.12, '#ece6d6', -0.11); // paper
  segment(0.025, '#8e8a84', -0.1825); // ash
  const ember = segment(0.008, '#ff5a1a', -0.199, true);
  const emberMaterial = ember.material as Material & { color: Color };

  // Smoke: pixelated soft puffs that rise, widen, sway and fade, then recycle.
  const puff = createCanvasTexture(16, 16);
  const gradient = puff.context.createRadialGradient(8, 8, 0, 8, 8, 8);
  gradient.addColorStop(0, 'rgba(222, 222, 216, 1)');
  gradient.addColorStop(1, 'rgba(222, 222, 216, 0)');
  puff.context.fillStyle = gradient;
  puff.context.fillRect(0, 0, 16, 16);
  puff.texture.needsUpdate = true;
  const tipX = 0.27 - Math.cos(restAngle) * 0.203;
  const tipZ = 0.09 + Math.sin(restAngle) * 0.203;
  const puffs = Array.from({ length: PUFFS }, () => {
    const spriteMaterial = new SpriteMaterial({
      map: puff.texture,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    materials.push(spriteMaterial);
    const sprite = new Sprite(spriteMaterial);
    group.add(sprite);
    return sprite;
  });

  return {
    group,
    /** Advance the smoke and ember; `seconds` is wall-clock time. */
    update(seconds: number, reducedMotion: boolean) {
      const time = reducedMotion ? 7 : seconds;
      const flicker =
        0.5 + 0.3 * Math.sin(time * 2.3) + 0.2 * Math.sin(time * 7.1);
      emberMaterial.color.copy(emberDim).lerp(emberBright, flicker);
      puffs.forEach((sprite, i) => {
        const age = (time * 0.16 + i / PUFFS) % 1;
        const curl = Math.sin(age * 5 + time * 0.6 + i * 0.7) * 0.07 * age;
        sprite.position.set(
          tipX + curl + age * 0.06,
          0.09 + age * SMOKE_HEIGHT,
          tipZ + Math.cos(age * 4 + time * 0.4) * 0.03 * age,
        );
        sprite.scale.setScalar(0.035 + age * 0.26);
        const fadeIn = Math.min(1, age / 0.08);
        sprite.material.opacity = fadeIn * (1 - age) * 0.62;
      });
    },
    dispose() {
      group.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const item of materials) item.dispose();
      puff.texture.dispose();
    },
  };
}
