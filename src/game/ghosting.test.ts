import { describe, expect, it } from 'vitest';
import { createGhosting, defaultGhostingSettings } from './ghosting';
import type { Pose } from './ghosting';

const at = (yaw = 0, x = 0): Pose => ({ x, z: 0, yaw, pitch: 0 });
const on = () =>
  createGhosting({ ...defaultGhostingSettings(), strength: 0.6 });

/** Hold still for `seconds` in tenths; returns the snapshot taken. */
const hold = (
  g: ReturnType<typeof createGhosting>,
  seconds: number,
  yaw = 0,
) => {
  let taken: number | null = null;
  for (let t = 0; t < seconds - 1e-9; t += 0.1)
    taken = g.step(0.1, at(yaw)).take ?? taken;
  return taken;
};

describe('perceptual ghosting', () => {
  it('takes a snapshot once the view has held still a moment', () => {
    const g = on();
    expect(hold(g, 0.2)).toBeNull();
    const taken = hold(g, 0.3);
    expect(taken).not.toBeNull();
    expect(g.held).toBe(taken);
    // One snapshot per stillness, however long it lasts.
    expect(hold(g, 2)).toBeNull();
  });

  it('lets the snapshot go as a ghost when the view moves', () => {
    const g = on();
    const taken = hold(g, 0.6);
    const { released } = g.step(0.1, at(0.2));
    expect(released).toBe(taken);
    expect(g.ghosts).toEqual([
      { snapshot: taken, opacity: 0.6, scale: 1, blur: 0, age: 0 },
    ]);
    expect(g.held).toBeNull();
  });

  it('fades the ghost over the fade time, then drops it', () => {
    const g = createGhosting({
      ...defaultGhostingSettings(),
      strength: 1,
      fadeSeconds: 1,
      drift: 0.1,
    });
    hold(g, 0.6);
    g.step(0.1, at(0.2));
    // Keep turning, so no new stillness is taken.
    for (let k = 1; k <= 5; k++) g.step(0.1, at(0.2 + k * 0.2));
    expect(g.ghosts[0].opacity).toBeCloseTo(0.5);
    expect(g.ghosts[0].scale).toBeCloseTo(1.05);
    for (let k = 6; k <= 11; k++) g.step(0.1, at(0.2 + k * 0.2));
    expect(g.ghosts).toHaveLength(0);
  });

  it('blurs the ghost as it fades, quickly at first', () => {
    const g = createGhosting({
      ...defaultGhostingSettings(),
      strength: 1,
      fadeSeconds: 1,
      blur: 0.04,
    });
    hold(g, 0.6);
    g.step(0.1, at(0.2));
    expect(g.ghosts[0].blur).toBe(0);
    for (let k = 1; k <= 3; k++) g.step(0.1, at(0.2 + k * 0.2));
    // Under a third of the way through its fade, over half its final blur.
    const early = g.ghosts[0].blur;
    expect(early).toBeGreaterThan(0.02);
    expect(early).toBeLessThan(0.025);
    for (let k = 4; k <= 9; k++) g.step(0.1, at(0.2 + k * 0.2));
    expect(g.ghosts[0].blur).toBeGreaterThan(early);
    expect(g.ghosts[0].blur).toBeLessThanOrEqual(0.04);
  });

  it('does not count a slow drift or a small twitch as moving', () => {
    const g = on();
    const taken = hold(g, 0.6);
    // 5° a second, under the 12° threshold.
    g.step(0.1, at((0.5 * Math.PI) / 180));
    expect(g.ghosts).toHaveLength(0);
    expect(g.held).toBe(taken);
  });

  it('counts walking as moving', () => {
    const g = on();
    hold(g, 0.6);
    expect(g.step(0.1, at(0, 0.1)).released).not.toBeNull();
  });

  it('keeps at most MOST ghosts, the newest', () => {
    const g = createGhosting({
      ...defaultGhostingSettings(),
      strength: 1,
      fadeSeconds: 100,
      most: 2,
    });
    const made: number[] = [];
    for (let k = 0; k < 4; k++) {
      made.push(hold(g, 0.6, k)!);
      g.step(0.1, at(k + 0.5));
      g.step(0.1, at(k + 1));
    }
    expect(g.ghosts.map((ghost) => ghost.snapshot)).toEqual(made.slice(2));
    expect(g.inUse()).toEqual(new Set(made.slice(2)));
  });

  it('makes no ghosts at zero strength', () => {
    const g = createGhosting();
    hold(g, 0.6);
    g.step(0.1, at(0.5));
    expect(g.ghosts).toHaveLength(0);
  });
});
