import { Group, Sprite, SpriteMaterial } from 'three';
import { createCanvasTexture } from './screens';

/**
 * Heavy gas escaping from a nozzle: a fast jet that leaves the nozzle
 * along its own axis (local -y), slows, then sinks and spreads out along
 * whatever it lands on, as xenon (four and a half times as dense as air)
 * does. Built in metres with the nozzle's mouth at the origin.
 */
export function createGasVent({
  puffs = 28,
  /** How far below the nozzle the gas lands and starts to spread, metres. */
  floorDrop = 0.03,
  /** How far it spreads across the floor, metres. */
  spread = 0.22,
} = {}) {
  const group = new Group();
  group.name = 'GasVent';
  group.userData.noCollision = true;
  const puff = createCanvasTexture(16, 16);
  const gradient = puff.context.createRadialGradient(8, 8, 0, 8, 8, 8);
  gradient.addColorStop(0, 'rgba(226, 234, 255, 1)');
  gradient.addColorStop(1, 'rgba(226, 234, 255, 0)');
  puff.context.fillStyle = gradient;
  puff.context.fillRect(0, 0, 16, 16);
  puff.texture.needsUpdate = true;
  const sprites = Array.from({ length: puffs }, (_, i) => {
    const material = new SpriteMaterial({
      map: puff.texture,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    const sprite = new Sprite(material);
    sprite.userData.noCollision = true;
    // Each puff spreads out along its own heading once it lands.
    sprite.userData.heading = (i * 2.399) % (Math.PI * 2);
    group.add(sprite);
    return sprite;
  });
  return {
    group,
    /**
     * Strength is 0 (shut) to 1 (full blast). In reduced motion the gas is
     * shown, frozen, rather than hidden.
     */
    update(seconds: number, strength: number, reducedMotion: boolean) {
      const time = reducedMotion ? 3 : seconds;
      const rate = 0.9 + strength * 0.8;
      sprites.forEach((sprite, index) => {
        const age = (time * rate + index / puffs) % 1;
        const heading = sprite.userData.heading as number;
        const flicker = Math.sin(time * 13 + index * 1.7) * 0.004;
        // The jet: out along -y for the first fifth of its life.
        const jet = Math.min(1, age / 0.2);
        const fall = jet * floorDrop;
        // Then a slow spread, lowest and widest at the end.
        const settle = Math.max(0, (age - 0.2) / 0.8);
        const reach = Math.sqrt(settle) * spread;
        sprite.position.set(
          Math.cos(heading) * reach + flicker,
          -fall - settle * 0.01,
          Math.sin(heading) * reach,
        );
        sprite.scale.setScalar(0.012 + jet * 0.02 + settle * 0.07);
        sprite.material.opacity =
          Math.min(1, age / 0.05) * (1 - settle) * 0.55 * strength;
      });
      group.visible = strength > 0.001;
    },
    dispose() {
      for (const sprite of sprites) sprite.material.dispose();
      puff.texture.dispose();
    },
  };
}
