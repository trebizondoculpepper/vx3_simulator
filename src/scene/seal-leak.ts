import {
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from 'three';
import type { MeshBasicMaterial } from 'three';
import { createPs1Material } from '../rendering/ps1-material';
import { createCanvasTexture } from './screens';

/**
 * Exhaust leaking round an unclamped seal: thin, sooty wisps seeping out
 * all round the seam, curling outward and up the head as they thin. Built
 * in metres round a ring of `radius` in the group's x-z plane. `update`
 * takes the leak's strength, 0 to 1.
 */
export function createSealLeak({ radius = 0.25, wisps = 40 } = {}) {
  const group = new Group();
  group.name = 'SealLeak';
  group.userData.noCollision = true;
  group.visible = false;
  const dot = createCanvasTexture(16, 16);
  const gradient = dot.context.createRadialGradient(8, 8, 0, 8, 8, 8);
  gradient.addColorStop(0, 'rgba(160, 152, 140, 1)');
  gradient.addColorStop(1, 'rgba(160, 152, 140, 0)');
  dot.context.fillStyle = gradient;
  dot.context.fillRect(0, 0, 16, 16);
  dot.texture.needsUpdate = true;
  const sprites = Array.from({ length: wisps }, (_, i) => {
    const sprite = new Sprite(
      new SpriteMaterial({
        map: dot.texture,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    sprite.userData.noCollision = true;
    // Round the seam, unevenly: a seal leaks worse in some places.
    sprite.userData.angle = (i / wisps) * Math.PI * 2 + ((i * 0.37) % 1) * 0.3;
    sprite.userData.phase = (i * 0.618) % 1;
    sprite.userData.pace = 0.35 + ((i * 0.382) % 1) * 0.3;
    group.add(sprite);
    return sprite;
  });
  return {
    group,
    update(seconds: number, strength: number, reducedMotion: boolean) {
      group.visible = strength > 0.01;
      if (!group.visible) return;
      const time = reducedMotion ? 3 : seconds;
      for (const sprite of sprites) {
        const { angle, phase, pace } = sprite.userData as {
          angle: number;
          phase: number;
          pace: number;
        };
        const age = (time * pace + phase) % 1;
        // Out of the seam, curling outward, then up the head.
        const out = radius + 0.01 + age * 0.06;
        const swirl = angle + Math.sin(time * 0.7 + phase * 9) * 0.08 * age;
        sprite.position.set(
          Math.cos(swirl) * out,
          age * age * 0.35,
          Math.sin(swirl) * out,
        );
        sprite.scale.setScalar(0.03 + age * 0.14);
        sprite.material.opacity =
          Math.min(1, age / 0.1) * (1 - age) * 0.8 * strength;
      }
    },
    dispose() {
      for (const sprite of sprites) sprite.material.dispose();
      dot.texture.dispose();
    },
  };
}

/**
 * Soot on a round band of the vessel: smoke that came out of the seam and
 * ran up the metal, darkest at `seam` (the band's bottom or top edge) and
 * thinning away from it in streaks. An open cylinder of `radius`, `height`
 * metres tall, centred on the group's origin. `set` takes how dark it has
 * got, 0 (clean) to 1.
 */
export function createSootBand({
  radius = 0.25,
  height = 0.2,
  seam = 'bottom' as 'bottom' | 'top',
  seed = 1,
} = {}) {
  const px = 512;
  const py = 128;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = py;
  const c = canvas.getContext('2d')!;
  let a = seed * 9301 + 49297;
  const random = () => {
    a = (a * 16807) % 2147483647;
    return a / 2147483647;
  };
  // The canvas's top row is the band's top; the seam is at one edge.
  const seamY = seam === 'bottom' ? py : 0;
  const away = seam === 'bottom' ? -1 : 1;
  const wash = c.createLinearGradient(0, seamY, 0, py - seamY);
  wash.addColorStop(0, 'rgba(24, 20, 16, 0.85)');
  wash.addColorStop(0.35, 'rgba(24, 20, 16, 0.35)');
  wash.addColorStop(1, 'rgba(24, 20, 16, 0)');
  c.fillStyle = wash;
  c.fillRect(0, 0, px, py);
  // Streaks where the smoke ran up the metal, wrapping round the band.
  for (let s = 0; s < 70; s++) {
    const x0 = random() * px;
    const length = py * (0.25 + random() * 0.7);
    c.strokeStyle = `rgba(20, 16, 12, ${0.12 + random() * 0.25})`;
    c.lineWidth = 1 + random() * 4;
    c.beginPath();
    let x = x0;
    let y = seamY;
    c.moveTo(x, y);
    for (let t = 0; t < length; t += 6) {
      x += (random() - 0.5) * 3;
      y += away * 6;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const material = createPs1Material(
    {
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    },
    true,
  ) as MeshBasicMaterial;
  const mesh = new Mesh(
    new CylinderGeometry(radius, radius, height, 40, 1, true),
    material,
  );
  mesh.name = 'SootBand';
  mesh.userData.noCollision = true;
  mesh.visible = false;
  return {
    mesh,
    set(level: number) {
      const l = Math.max(0, Math.min(1, level));
      material.opacity = l;
      mesh.visible = l > 0.003;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
