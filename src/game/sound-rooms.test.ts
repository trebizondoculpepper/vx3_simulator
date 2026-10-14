import { describe, expect, it } from 'vitest';
import { roomAt, transmission } from './sound-rooms';

const plan = {
  lab: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 },
  plant: { minX: -6, maxX: -1, minZ: 0, maxZ: 10 },
  museum: { minX: 0, maxX: 10, minZ: 14, maxZ: 24 },
};

describe('sound rooms', () => {
  it('places points in the lab, the plant room or the corridor', () => {
    expect(roomAt(plan, 5, 5)).toBe('lab');
    expect(roomAt(plan, -3, 5)).toBe('plant');
    expect(roomAt(plan, 5, 12)).toBe('corridor');
    expect(roomAt(plan, 5, 18)).toBe('museum');
  });

  it('silences the plant room completely while its door is shut', () => {
    for (const listener of ['lab', 'corridor'] as const)
      expect(
        transmission('plant', listener, { lab: 1, plant: 0, museum: 0 }),
      ).toBe(0);
    expect(
      transmission('plant', 'plant', { lab: 0, plant: 0, museum: 0 }),
    ).toBe(1);
  });

  it('lets sound through in proportion to how far the doors are open', () => {
    expect(
      transmission('plant', 'corridor', { lab: 0, plant: 0.5, museum: 0 }),
    ).toBe(0.5);
    // From the plant room to the lab, sound goes through both doors.
    expect(
      transmission('plant', 'lab', { lab: 0.5, plant: 0.5, museum: 0 }),
    ).toBe(0.25);
    expect(transmission('lab', 'plant', { lab: 1, plant: 1, museum: 0 })).toBe(
      1,
    );
    expect(
      transmission('museum', 'lab', { lab: 0.5, plant: 0, museum: 0.5 }),
    ).toBe(0.25);
  });
});

it('keeps quiet room-only sounds inside the lab even with both doors open', () => {
  expect(
    transmission('lab', 'lab', { lab: 1, plant: 1, museum: 0 }, true),
  ).toBe(1);
  expect(
    transmission('lab', 'plant', { lab: 1, plant: 1, museum: 0 }, true),
  ).toBe(0);
  expect(
    transmission('lab', 'corridor', { lab: 1, plant: 1, museum: 0 }, true),
  ).toBe(0);
});
