import { Group, Sprite, SpriteMaterial } from 'three';
import { createCanvasTexture } from './screens';

/** How long a puff lasts, seconds. */
const PUFF_SECONDS = 0.9;

/**
 * The puff when a flanged joint closes: the air trapped between the faces
 * squeezed out all round the seam at once, carrying a little dust that
 * spreads outward, sinks a touch and fades. Built in metres round a ring
 * of `radius` in the group's x-z plane; `burst()` starts one.
 */
export function createSealPuff({ radius = 0.25, puffs = 32 } = {}) {
  const group = new Group();
  group.name = 'SealPuff';
  group.userData.noCollision = true;
  group.visible = false;
  const dot = createCanvasTexture(16, 16);
  const gradient = dot.context.createRadialGradient(8, 8, 0, 8, 8, 8);
  gradient.addColorStop(0, 'rgba(236, 232, 220, 1)');
  gradient.addColorStop(1, 'rgba(236, 232, 220, 0)');
  dot.context.fillStyle = gradient;
  dot.context.fillRect(0, 0, 16, 16);
  dot.texture.needsUpdate = true;
  const sprites = Array.from({ length: puffs }, (_, i) => {
    const sprite = new Sprite(
      new SpriteMaterial({
        map: dot.texture,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    sprite.userData.noCollision = true;
    // Evenly round the seam, each with its own speed and lift.
    sprite.userData.angle = (i / puffs) * Math.PI * 2;
    sprite.userData.speed = 0.7 + ((i * 0.618) % 1) * 0.6;
    sprite.userData.rise = ((i * 0.382) % 1) - 0.5;
    group.add(sprite);
    return sprite;
  });
  let age = Infinity;
  return {
    group,
    burst() {
      age = 0;
    },
    update(delta: number, reducedMotion: boolean) {
      age += delta;
      const life = age / PUFF_SECONDS;
      group.visible = life < 1 && !reducedMotion;
      if (!group.visible) return;
      // Fast out of the seam, then slowing as it spreads.
      const out = 1 - (1 - life) ** 3;
      for (const sprite of sprites) {
        const { angle, speed, rise } = sprite.userData as {
          angle: number;
          speed: number;
          rise: number;
        };
        const reach = radius + out * 0.09 * speed;
        sprite.position.set(
          Math.cos(angle) * reach,
          out * 0.012 * rise - life * life * 0.01,
          Math.sin(angle) * reach,
        );
        sprite.scale.setScalar(0.008 + out * 0.03);
        sprite.material.opacity = Math.min(1, life * 12) * (1 - life) * 0.75;
      }
    },
    dispose() {
      for (const sprite of sprites) sprite.material.dispose();
      dot.texture.dispose();
    },
  };
}
