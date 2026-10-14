import { describe, expect, it } from 'vitest';
import { visibleRooms } from './room-visibility';

const closed = { lab: 0, plant: 0, museum: 0 };

describe('visibleRooms', () => {
  it('keeps only the occupied room and corridor from a shut room', () => {
    expect(visibleRooms('lab', closed)).toEqual({
      lab: true,
      plant: false,
      museum: false,
      corridor: true,
    });
    expect(visibleRooms('plant', closed)).toEqual({
      lab: false,
      plant: true,
      museum: false,
      corridor: true,
    });
    expect(visibleRooms('museum', closed)).toEqual({
      lab: false,
      plant: false,
      museum: true,
      corridor: true,
    });
  });

  it('draws door leaves of every adjoining room from the corridor', () => {
    expect(visibleRooms('corridor', closed)).toEqual({
      lab: true,
      plant: true,
      museum: true,
      corridor: true,
    });
  });

  it('sees into another room only when both corridor links are open', () => {
    expect(visibleRooms('lab', { lab: 1, plant: 0, museum: 1 }).museum).toBe(
      true,
    );
    expect(visibleRooms('lab', { lab: 0, plant: 1, museum: 1 }).museum).toBe(
      false,
    );
  });
});
