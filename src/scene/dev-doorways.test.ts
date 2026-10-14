import { Texture } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { devDoors } from '../game/dev-room-links';
import { slide } from '../game/walk-collision';
import { createDevDoorways } from './dev-doorways';

vi.mock('./screens', () => ({
  createLabelTexture: () => ({
    texture: new Texture(),
    width: 256,
    height: 48,
  }),
}));
afterEach(() => vi.unstubAllGlobals());

describe('walk-through development doors', () => {
  it('blocks a shut door, opens it, and travels only after crossing its threshold', () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    const doors = devDoors('dev2', { minX: -5, maxX: 5, minZ: -5, maxZ: 5 }, 1);
    const passages = createDevDoorways('dev2', doors, 0, 1);
    const door = passages.entries[0];
    expect(
      slide(passages.solids(), -4, door.door.z, -2, 0, 0.25).x,
    ).toBeGreaterThan(-5);
    passages.update(1, -5.4, door.door.z);
    expect(dispatchEvent).not.toHaveBeenCalled();
    door.toggle();
    passages.update(1, -4.5, door.door.z);
    expect(passages.solids()).toHaveLength(1);
    expect(dispatchEvent).not.toHaveBeenCalled();
    passages.update(0.1, -5.4, door.door.z);
    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(dispatchEvent.mock.calls[0][0].detail).toEqual({
      to: 'dev1',
      from: 'dev2',
    });
    passages.update(0.1, -5.4, door.door.z);
    expect(dispatchEvent).toHaveBeenCalledOnce();
    passages.arrival('dev1');
    passages.update(0.1, -5.4, door.door.z);
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
    passages.dispose();
  });
  it('arrives inside the open doorway facing into the room at the correct scale', () => {
    const passages = createDevDoorways(
      'dev3',
      [{ to: 'dev2', side: 'west', x: -30, z: 40 }],
      -8,
      10,
    );
    const pose = passages.arrival('dev2');
    expect(pose?.x).toBeCloseTo(-22.5);
    expect(pose?.z).toBeCloseTo(40);
    expect(Math.sin(pose!.yaw)).toBeCloseTo(1);
    expect(passages.solids()).toHaveLength(0);
    passages.dispose();
  });

  it('blocks the corridor south entrance across its width, and returns facing north', () => {
    const passages = createDevDoorways(
      'corridor',
      [{ to: 'dev0', side: 'south', x: 8, z: 12 }],
      0,
      1,
    );
    expect(slide(passages.solids(), 8.35, 11, 0, 2, 0.25).z).toBeLessThan(12);
    const pose = passages.arrival('dev0');
    expect(pose?.x).toBeCloseTo(8);
    expect(pose?.z).toBeCloseTo(11.25);
    expect(pose?.yaw).toBeCloseTo(0);
    passages.dispose();
  });
});
