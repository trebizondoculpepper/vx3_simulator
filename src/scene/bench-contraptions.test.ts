import { describe, expect, it } from 'vitest';
import {
  benchContraptionLayout,
  contraptionHalfWidths,
} from './bench-contraptions';

// Positions along the west bench, in metres from its north end, as built in
// west-workbench.ts: a 3.6 m bench, the vice's jaws reaching 0.35 m, and
// the 0.56 m wide cassette player centred 1.13 m from the south end.
const benchLength = 3.6;
const viceEnd = 0.35;
const cassetteStart = benchLength - 1.13 - 0.28;
const socketPitch = { first: 0.4, every: 0.6 };

describe('bench contraptions layout', () => {
  const spans = benchContraptionLayout.along.map((centre, i) => [
    centre - contraptionHalfWidths[i],
    centre + contraptionHalfWidths[i],
  ]);

  it('keeps the machines apart, north to south', () => {
    for (let i = 1; i < spans.length; i++)
      expect(spans[i][0]).toBeGreaterThan(spans[i - 1][1]);
  });

  it('keeps them clear of the vice and the cassette player', () => {
    expect(spans[0][0]).toBeGreaterThan(viceEnd);
    expect(spans[spans.length - 1][1]).toBeLessThan(cassetteStart);
  });

  it('plugs each into its own trunking socket', () => {
    const sockets = benchContraptionLayout.sockets;
    expect(new Set(sockets).size).toBe(sockets.length);
    for (const socket of sockets)
      expect(
        ((socket - socketPitch.first) / socketPitch.every) % 1,
      ).toBeCloseTo(0);
  });
});
