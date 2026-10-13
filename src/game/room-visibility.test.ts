import { describe, expect, it } from 'vitest';
import { visibleRooms } from './room-visibility';

describe('visibleRooms', () => {
  it('hides the plant room from inside the lab', () => {
    expect(visibleRooms('lab')).toEqual({
      lab: true,
      plant: false,
      corridor: true,
    });
  });

  it('hides the lab from inside the plant room', () => {
    expect(visibleRooms('plant')).toEqual({
      lab: false,
      plant: true,
      corridor: true,
    });
  });

  it('draws everything from the corridor, where both doors are in view', () => {
    expect(visibleRooms('corridor')).toEqual({
      lab: true,
      plant: true,
      corridor: true,
    });
  });
});
