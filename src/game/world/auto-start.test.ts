import { describe, expect, it } from 'vitest';
import { createAutoStart } from './auto-start';
import { coldStart } from './scenarios';
import { createWorld } from './world';

const still = () => 0.5;

describe('the automatic cold start', () => {
  it('works the procedure one control at a time to full operation', () => {
    const world = createWorld();
    const auto = createAutoStart(coldStart);
    const lines: string[] = [];
    let seconds = 0;
    while (!auto.done && seconds < 600) {
      const { line } = auto.advance(world, 0.1, still);
      if (line) lines.push(line);
      world.tick(0.1, still);
      seconds += 0.1;
    }
    expect(auto.done).toBe(true);
    expect(world.read('plant.fullyOperational')).toBe(true);
    // Each control was worked in its own moment, and the waits were short.
    expect(
      lines.filter((l) => l.includes('→') || /: [a-z]/.test(l)).length,
    ).toBeGreaterThan(10);
    expect(seconds).toBeLessThan(120);
  });
});
