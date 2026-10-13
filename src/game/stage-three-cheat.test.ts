import { expect, it } from 'vitest';
import {
  AMBIENT,
  createColumnPrep,
  stepColumnPrep,
  WORKING_PRESSURE,
} from './column-prep';
import { atmospherePermit } from './gen2-wiring';
import { prepareStageThree } from './stage-three-cheat';
it('recovers a failed vessel to the end of Stage 3 and leaves the core cold', () => {
  const state = createColumnPrep();
  state.failure = 'burnout';
  state.temperature = 3500;
  prepareStageThree(state);
  expect(atmospherePermit(state, true)).toBe(true);
  expect(atmospherePermit(state, false)).toBe(false);
  expect(state.outletOpen).toBe(false);
  expect(state.inletOpen).toBe(true);
  expect(state.xenon).toBeGreaterThanOrEqual(WORKING_PRESSURE);
  for (let i = 0; i < 100; i++)
    stepColumnPrep(state, 0.1, { powered: false, ramsPowered: true });
  expect(state.temperature).toBe(AMBIENT);
  expect(state.failure).toBeNull();
  expect(state.spinRate).toBe(0);
  expect(atmospherePermit(state, true)).toBe(true);
});
