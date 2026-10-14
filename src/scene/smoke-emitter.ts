import { Group, Sprite, SpriteMaterial } from 'three';
import { createCanvasTexture } from './screens';

/**
 * Reusable low-resolution smoke plume for cigarettes and overheating gear.
 * `colour` is the smoke's, as r, g, b: pale for steam, dark for a fire.
 */
export function createSmokeEmitter(puffCount = 14, colour = '222, 222, 216') {
  const group = new Group();
  group.name = 'SmokeEmitter';
  group.userData.noCollision = true;
  const puff = createCanvasTexture(16, 16);
  const gradient = puff.context.createRadialGradient(8, 8, 0, 8, 8, 8);
  gradient.addColorStop(0, `rgba(${colour}, 1)`);
  gradient.addColorStop(1, `rgba(${colour}, 0)`);
  puff.context.fillStyle = gradient;
  puff.context.fillRect(0, 0, 16, 16);
  puff.texture.needsUpdate = true;
  const sprites = Array.from({ length: puffCount }, () => {
    const material = new SpriteMaterial({
      map: puff.texture,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const sprite = new Sprite(material);
    sprite.userData.noCollision = true;
    group.add(sprite);
    return sprite;
  });
  return {
    group,
    /** Strength is 0 to 1. The plume is frozen, but still shown, in reduced motion. */
    update(seconds: number, strength: number, reducedMotion: boolean) {
      const time = reducedMotion ? 7 : seconds;
      sprites.forEach((sprite, index) => {
        const age = (time * 0.16 + index / puffCount) % 1;
        const curl = Math.sin(age * 5 + time * 0.6 + index * 0.7) * 0.07 * age;
        sprite.position.set(
          curl + age * 0.06,
          age * 1.15,
          Math.cos(age * 4 + time * 0.4) * 0.03 * age,
        );
        sprite.scale.setScalar(0.035 + age * 0.26);
        sprite.material.opacity =
          Math.min(1, age / 0.08) * (1 - age) * 0.62 * strength;
      });
    },
    dispose() {
      for (const sprite of sprites) sprite.material.dispose();
      puff.texture.dispose();
    },
  };
}
