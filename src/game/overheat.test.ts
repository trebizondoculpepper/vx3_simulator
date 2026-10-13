import { describe, expect, it } from 'vitest';
import { createRackControls } from './rack-controls';
import { createRig } from './rig';
import { networkOutputs } from './safety-telltales';
import { createOverheatState, stepOverheat } from './overheat';
import { REDLINES, redlineFraction, redlineOverrun } from './redlines';

describe('redline limits', () => {
  it('places every marked limit at the same fraction used by its gauge', () => {
    expect(redlineFraction('spindle')).toBe(0.85);
    expect(redlineFraction('field')).toBe(0.85);
    expect(redlineFraction('load')).toBe(6.5 / 8);
    expect(redlineOverrun('load', REDLINES.load.limit)).toBe(0);
    expect(redlineOverrun('load', REDLINES.load.fullScale)).toBe(1);
  });

  it('can reach the supply redline with the existing controls', () => {
    const rig = createRig();
    const controls = createRackControls();
    rig.controls.mains = true;
    rig.heater = 1;
    rig.spindle = 1;
    rig.field = 1;
    controls.toggles.aux1 = true;
    controls.toggles.aux2 = true;
    controls.toggles.chromoAux = true;
    controls.knobs.ampGain = 1;
    expect(networkOutputs(rig, controls).powerKw).toBeGreaterThan(
      REDLINES.load.limit,
    );
  });
});

describe('device overheating', () => {
  it('heats faster further beyond the limit, then cools below it', () => {
    const slight = createOverheatState();
    const severe = createOverheatState();
    stepOverheat(slight, { spindle: 0.87, field: 0, load: 0 }, 10);
    stepOverheat(severe, { spindle: 1, field: 0, load: 0 }, 10);
    expect(severe.heat.spindle).toBeGreaterThan(slight.heat.spindle);
    const hot = severe.heat.spindle;
    stepOverheat(severe, { spindle: 0, field: 0, load: 0 }, 10);
    expect(severe.heat.spindle).toBeLessThan(hot);
  });

  it('announces smoke once and lets laboratory smoke vent when the machine cools', () => {
    const state = createOverheatState();
    const high = { spindle: 1, field: 0, load: 0 };
    expect(stepOverheat(state, high, 5)).toEqual([]);
    expect(stepOverheat(state, high, 5)).toEqual(['spindle']);
    expect(stepOverheat(state, high, 10)).toEqual([]);
    expect(state.smoke.spindle).toBeGreaterThan(0);
    const roomSmoke = state.roomSmoke;
    stepOverheat(state, { spindle: 0, field: 0, load: 0 }, 40);
    expect(state.smoke.spindle).toBe(0);
    expect(state.roomSmoke).toBeLessThan(roomSmoke);
  });
});
