import source from './start-scene.ts?raw';
import { expect, it } from 'vitest';
import { createWorld } from '../game/world/world';

it('every literal world read in the live scene names an existing graph vertex', () => {
  const ids = new Set(
    [...source.matchAll(/world\.read(?:<[^>]+>)?\(\s*['"]([^'"]+)['"]/g)].map(
      (match) => match[1],
    ),
  );
  expect(ids.size).toBeGreaterThan(20);
  const world = createWorld();
  for (const id of ids)
    expect(() => world.read(id), `Scene binding ${id}`).not.toThrow();
});
