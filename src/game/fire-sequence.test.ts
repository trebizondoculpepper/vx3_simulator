import { expect, it } from 'vitest';
import {
  createFireIncident,
  pressFireCall,
  stepFireIncident,
} from './fire-incident';
import { createOverheatState } from './overheat';
import { fireBeaconLit } from './fire-sequence';

it('starts the alarm immediately and the sprinkler three seconds later', () => {
  const fire = createFireIncident();
  const heat = createOverheatState();
  pressFireCall(fire);
  expect(fire.alarm).toBe(true);
  expect(fire.water).toBe(false);
  stepFireIncident(fire, heat, false, 2.99);
  expect(fire.water).toBe(false);
  stepFireIncident(fire, heat, false, 0.02);
  expect(fire.water).toBe(true);
});
it('flashes twice a second, goes dark on reset and stays steady in reduced motion', () => {
  expect(
    [0.1, 0.3, 0.6, 0.8].map((time) => fireBeaconLit(true, time, false)),
  ).toEqual([true, false, true, false]);
  expect(fireBeaconLit(false, 0.1, false)).toBe(false);
  expect(fireBeaconLit(true, 0.3, true)).toBe(true);
});
