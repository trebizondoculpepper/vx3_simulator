import { AdditiveBlending, Group, Sprite, SpriteMaterial } from 'three';
import { createCanvasTexture } from './screens';

/** Small layered flames for a burning faceplate, in metre-scale local units. */
export function createFlamePlume(count = 12) {
  const group = new Group();
  group.name = 'Faceplate fire';
  group.userData.noCollision = true;
  const art = createCanvasTexture(64, 128);
  const c = art.context;
  const glow = c.createRadialGradient(32, 93, 2, 32, 75, 59);
  glow.addColorStop(0, 'rgba(255,246,180,1)');
  glow.addColorStop(0.25, 'rgba(255,181,52,.95)');
  glow.addColorStop(0.62, 'rgba(246,68,12,.65)');
  glow.addColorStop(1, 'rgba(174,20,3,0)');
  c.fillStyle = glow;
  c.beginPath();
  c.moveTo(32, 8);
  c.bezierCurveTo(58, 48, 64, 86, 43, 119);
  c.quadraticCurveTo(32, 127, 20, 119);
  c.bezierCurveTo(-1, 86, 7, 46, 32, 8);
  c.fill();
  art.texture.needsUpdate = true;
  const tongues = Array.from({ length: count }, () => {
    const sprite = new Sprite(
      new SpriteMaterial({
        map: art.texture,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        opacity: 0,
      }),
    );
    sprite.userData.noCollision = true;
    group.add(sprite);
    return sprite;
  });
  return {
    group,
    update(seconds: number, strength: number, reducedMotion: boolean) {
      group.visible = strength > 0;
      if (!group.visible) return;
      const time = reducedMotion ? 3 : seconds;
      tongues.forEach((sprite, i) => {
        const age = (time * (1.1 + (i % 3) * 0.19) + i / count) % 1;
        const lane = ((i * 7) % count) / (count - 1) - 0.5;
        sprite.position.set(
          lane * 0.22 + Math.sin(time * 7 + i) * 0.016 * age,
          age * 0.34,
          0.02 + (i % 3) * 0.009,
        );
        sprite.scale.set(
          (0.09 + (1 - age) * 0.1) * strength,
          (0.24 + (1 - age) * 0.2) * strength,
          1,
        );
        sprite.material.opacity =
          (1 - age) *
          (reducedMotion ? 0.75 : 0.65 + 0.25 * Math.sin(time * 19 + i)) *
          strength;
      });
    },
    dispose() {
      for (const sprite of tongues) sprite.material.dispose();
      art.texture.dispose();
    },
  };
}
