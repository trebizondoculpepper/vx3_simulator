import { describe, expect, it } from 'vitest';
import { createRackControls } from '../game/rack-controls';
import { createRig } from '../game/rig';
import { soundParameters } from './sound-parameters';

describe('sound parameters', () => {
  it('leaves only room tone in a cold cabinet', () => {
    const sound = soundParameters(createRig(), createRackControls());
    expect(sound.roomGain).toBeGreaterThan(0);
    expect(sound.spindleGain).toBe(0);
    expect(sound.counterClicksPerSecond).toBe(0);
  });

  it('raises motor, field and warning sounds with the rig state', () => {
    const rig = createRig();
    rig.controls.mains = true;
    rig.heater = 0.8;
    rig.spindle = 0.7;
    rig.field = 0.6;
    rig.instability = 0.75;
    rig.strain = 0.5;
    const sound = soundParameters(rig, createRackControls());
    expect(sound.heaterGain).toBeGreaterThan(0);
    expect(sound.spindleHz).toBeGreaterThan(65);
    expect(sound.rotorHz).toBeGreaterThan(6);
    expect(sound.fieldBeatHz).toBeGreaterThan(2);
    expect(sound.strainGain).toBeGreaterThan(0);
    expect(sound.counterClicksPerSecond).toBeGreaterThan(1);
  });

  it('only runs the spark gap with AUX 1 up and mains on', () => {
    const rig = createRig();
    const controls = createRackControls();
    controls.toggles.aux1 = true;
    expect(soundParameters(rig, controls).sparkCracksPerSecond).toBe(0);
    rig.controls.mains = true;
    expect(soundParameters(rig, controls).sparkCracksPerSecond).toBeGreaterThan(
      0,
    );
  });

  it('raises motor pitch and rotation pulse rate with spindle speed', () => {
    const rig = createRig();
    rig.spindle = 0.2;
    const slow = soundParameters(rig, createRackControls());
    rig.spindle = 0.8;
    const fast = soundParameters(rig, createRackControls());
    expect(fast.spindleHz).toBeGreaterThan(slow.spindleHz);
    expect(fast.rotorHz).toBeGreaterThan(slow.rotorHz);
  });
});
