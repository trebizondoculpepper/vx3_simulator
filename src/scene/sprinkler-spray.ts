import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Group,
  Points,
  PointsMaterial,
} from 'three';

const DROPS = 90;
const SPLASHES = 24;
const fraction = (value: number) => value - Math.floor(value);

/** A modest PS1-style droplet fan whose origin is its parent sprinkler head. */
export function createSprinklerSpray(
  worldUnitsPerMetre: number,
  fallDistance: number,
  seed: number,
) {
  const m = worldUnitsPerMetre;
  const group = new Group();
  group.name = 'SprinklerDroplets';
  group.visible = false;
  const positions = new Float32Array(DROPS * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage),
  );
  const material = new PointsMaterial({
    color: '#b8e9f3',
    size: 0.022 * m,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  group.add(points);
  const splashPositions = new Float32Array(SPLASHES * 3);
  const splashGeometry = new BufferGeometry();
  splashGeometry.setAttribute(
    'position',
    new BufferAttribute(splashPositions, 3).setUsage(DynamicDrawUsage),
  );
  const splashMaterial = new PointsMaterial({
    color: '#d9f4fa',
    size: 0.016 * m,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const splashes = new Points(splashGeometry, splashMaterial);
  splashes.frustumCulled = false;
  group.add(splashes);
  return {
    group,
    update(seconds: number, active: boolean, reducedMotion: boolean) {
      group.visible = active;
      if (!active) return;
      geometry.setDrawRange(0, reducedMotion ? 35 : DROPS);
      splashGeometry.setDrawRange(0, reducedMotion ? 8 : SPLASHES);
      for (let i = 0; i < DROPS; i++) {
        const phase = fraction(
          seconds * (0.85 + fraction(i * 0.618) * 0.55) +
            fraction(i * 0.382 + seed * 0.173),
        );
        const angle = i * 2.399963 + seed;
        const radius = (0.12 + fraction(i * 0.754) * 0.7) * m * phase;
        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = -fallDistance * phase * phase;
        positions[i * 3 + 2] = Math.sin(angle) * radius;
      }
      geometry.attributes.position.needsUpdate = true;
      for (let i = 0; i < SPLASHES; i++) {
        const phase = fraction(
          seconds * 2.9 + fraction(i * 0.414 + seed * 0.13),
        );
        const angle = i * 2.399963 + seed;
        const landingRadius = (0.18 + fraction(i * 0.754) * 0.64) * m;
        const splashRadius = phase * 0.065 * m;
        splashPositions[i * 3] =
          Math.cos(angle) * (landingRadius + splashRadius);
        splashPositions[i * 3 + 1] =
          -fallDistance + 0.015 * m + Math.sin(phase * Math.PI) * 0.065 * m;
        splashPositions[i * 3 + 2] =
          Math.sin(angle) * (landingRadius + splashRadius);
      }
      splashGeometry.attributes.position.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      splashGeometry.dispose();
      splashMaterial.dispose();
    },
  };
}
