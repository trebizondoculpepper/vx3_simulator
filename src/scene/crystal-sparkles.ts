import { BoxGeometry, Group, Mesh } from 'three';
import type { Material } from 'three';
import { designate } from '../game/machine-parts';
import { createPs1Material } from '../rendering/ps1-material';

const COUNT = 48;
const COLOURS = ['#e9fbff', '#9fe6ff', '#c9b6ff', '#fff4c2'];

/**
 * Sparks shed by the time-dilation crystal when the ferrocores run: small
 * self-lit motes that burst outward, drift upward and shrink away. The
 * group's origin is the crystal's centre; sizes are in scene units.
 */
export function createCrystalSparkles(size = 0.05) {
  const group = new Group();
  const materials: Material[] = COLOURS.map((color) =>
    createPs1Material({ color }, true, true),
  );
  const geometry = new BoxGeometry(size, size, size);
  const sparks = Array.from({ length: COUNT }, (_, i) => {
    const mesh = new Mesh(geometry, materials[i % materials.length]);
    mesh.visible = false;
    designate(mesh, {
      machine: 'Time Dilation tell-tale',
      name: 'Sparkle',
      role: 'indicator',
    });
    group.add(mesh);
    return { mesh, life: 0, span: 1, vx: 0, vy: 0, vz: 0 };
  });
  let owed = 0;
  let next = 0;
  return {
    group,
    /**
     * Shed `rate` sparks a second; `spread` is how far they fly in a
     * second, in scene units.
     */
    update(delta: number, rate: number, spread: number, random = Math.random) {
      owed += rate * delta;
      while (owed >= 1) {
        owed -= 1;
        const spark = sparks[next];
        next = (next + 1) % sparks.length;
        const angle = random() * Math.PI * 2;
        const lift = random() * 2 - 1;
        const speed = spread * (0.4 + random() * 0.6);
        spark.vx = Math.cos(angle) * Math.sqrt(1 - lift * lift) * speed;
        spark.vy = lift * speed * 0.6 + spread * 0.25;
        spark.vz = Math.abs(Math.sin(angle)) * speed * 0.5;
        spark.span = 0.6 + random() * 0.8;
        spark.life = spark.span;
        spark.mesh.position.set(0, 0, 0);
        spark.mesh.visible = true;
      }
      for (const spark of sparks) {
        if (spark.life <= 0) continue;
        spark.life -= delta;
        if (spark.life <= 0) {
          spark.mesh.visible = false;
          continue;
        }
        spark.mesh.position.x += spark.vx * delta;
        spark.mesh.position.y += spark.vy * delta;
        spark.mesh.position.z += spark.vz * delta;
        spark.mesh.scale.setScalar(spark.life / spark.span);
        spark.mesh.rotation.z += delta * 6;
      }
      if (rate <= 0) owed = 0;
    },
    dispose() {
      geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
