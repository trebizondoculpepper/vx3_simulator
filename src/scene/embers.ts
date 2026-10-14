import { AdditiveBlending, Group, Sprite, SpriteMaterial } from 'three';
import { createCanvasTexture } from './screens';

/**
 * Embers rising off something hot: small orange sparks that drift up and
 * sideways, flicker, cool to red and go out. Built in the same units as
 * the smoke emitter, with the source at the origin.
 */
export function createEmbers(
  count = 24,
  {
    /**
     * Spat out of a face rather than rising off something hot: each spark
     * flies out along +z, arcs up a little and falls away.
     */
    spray = false,
  } = {},
) {
  const group = new Group();
  group.name = 'Embers';
  group.userData.noCollision = true;
  const spark = createCanvasTexture(8, 8);
  const gradient = spark.context.createRadialGradient(4, 4, 0, 4, 4, 4);
  gradient.addColorStop(0, 'rgba(255, 236, 170, 1)');
  gradient.addColorStop(0.4, 'rgba(255, 140, 40, 0.9)');
  gradient.addColorStop(1, 'rgba(255, 60, 10, 0)');
  spark.context.fillStyle = gradient;
  spark.context.fillRect(0, 0, 8, 8);
  spark.texture.needsUpdate = true;
  const sprites = Array.from({ length: count }, (_, i) => {
    const sprite = new Sprite(
      new SpriteMaterial({
        map: spark.texture,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        opacity: 0,
      }),
    );
    sprite.userData.noCollision = true;
    // Each spark has its own heading, rate and drift.
    sprite.userData.heading = (i * 2.399) % (Math.PI * 2);
    sprite.userData.rate = 0.35 + ((i * 0.618) % 1) * 0.4;
    group.add(sprite);
    return sprite;
  });
  return {
    group,
    /** Strength is 0 to 1. In reduced motion the sparks hang still. */
    update(seconds: number, strength: number, reducedMotion: boolean) {
      group.visible = strength > 0.001;
      if (!group.visible) return;
      const time = reducedMotion ? 4 : seconds;
      sprites.forEach((sprite, i) => {
        const { heading, rate } = sprite.userData as {
          heading: number;
          rate: number;
        };
        const age = (time * rate + i / count) % 1;
        if (spray) {
          // Out of the face, spreading, then falling.
          const spread = Math.cos(heading) * 0.35 * age;
          sprite.position.set(
            spread,
            0.35 * age - 1.1 * age * age,
            (0.25 + 0.2 * Math.abs(Math.sin(heading))) * age,
          );
        } else {
          const drift = age * 0.25 + Math.sin(time * 3 + i) * 0.03 * age;
          sprite.position.set(
            Math.cos(heading) * drift,
            age * 1.4,
            Math.sin(heading) * drift,
          );
        }
        sprite.scale.setScalar(0.04 * (1 - age * 0.6));
        const flicker = reducedMotion
          ? 1
          : 0.6 + 0.4 * Math.sin(time * 23 + i * 3.7);
        sprite.material.opacity =
          Math.min(1, age * 10) * (1 - age) * flicker * strength;
        sprite.material.color.setRGB(1, 1 - age * 0.6, 1 - age);
      });
    },
    dispose() {
      for (const sprite of sprites) sprite.material.dispose();
      spark.texture.dispose();
    },
  };
}
