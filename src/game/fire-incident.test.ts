import { describe, expect, it } from 'vitest';
import { createOverheatState } from './overheat';
import {
  createFireIncident,
  pressFireCall,
  resetFirePanel,
  stepFireIncident,
} from './fire-incident';

describe('fire incident', () => {
  it('requires sustained smoke before alarm, then delays water', () => {
    const fire = createFireIncident();
    const heat = createOverheatState();
    heat.roomSmoke = 0.3;
    expect(stepFireIncident(fire, heat, false, 10)).not.toContain('alarm');
    heat.roomSmoke = 0.1;
    stepFireIncident(fire, heat, false, 0.1);
    heat.roomSmoke = 0.3;
    expect(stepFireIncident(fire, heat, false, 19)).not.toContain('alarm');
    expect(stepFireIncident(fire, heat, false, 1.1)).toContain('alarm');
    expect(stepFireIncident(fire, heat, false, 2.8)).not.toContain('water');
    expect(stepFireIncident(fire, heat, false, 0.3)).toContain('water');
  });

  it('allows isolation within the live-water grace period', () => {
    const fire = createFireIncident();
    const heat = createOverheatState();
    expect(pressFireCall(fire)).toBe(true);
    stepFireIncident(fire, heat, true, 7);
    expect(fire.water).toBe(true);
    expect(fire.ruinCause).toBeNull();
    stepFireIncident(fire, heat, false, 5);
    expect(fire.liveWater).toBe(0);
    expect(fire.ruinCause).toBeNull();
    expect(resetFirePanel(fire, 0)).toBe(true);
    expect(fire.water).toBe(false);
    expect(fire.puddle).toBeGreaterThan(0);
  });

  it('ruins a live rig after five seconds of water', () => {
    const fire = createFireIncident();
    const heat = createOverheatState();
    pressFireCall(fire);
    const events = stepFireIncident(fire, heat, true, 8.1);
    expect(events).toContain('water');
    expect(events).toContain('ruined-short');
    expect(fire.ruinCause).toBe('short');
    expect(resetFirePanel(fire, 0)).toBe(false);
    // Once it is out, reset silences the alarm and shuts the water, and
    // the lab stays ruined.
    fire.extinguished = true;
    expect(resetFirePanel(fire, 0.3)).toBe(false);
    expect(resetFirePanel(fire, 0)).toBe(true);
    expect(fire.alarm).toBe(false);
    expect(fire.water).toBe(false);
    expect(fire.ruinCause).toBe('short');
  });

  it('counts sustained fire before the delayed smoke alarm', () => {
    const fire = createFireIncident();
    const heat = createOverheatState();
    heat.heat.spindle = 0.95;
    expect(stepFireIncident(fire, heat, true, 45.1)).toContain('ruined-fire');
    expect(fire.ruinCause).toBe('fire');
  });

  it('refuses reset while smoke or flames remain', () => {
    const fire = createFireIncident();
    const heat = createOverheatState();
    heat.heat.field = 0.95;
    stepFireIncident(fire, heat, true, 0.1);
    expect(resetFirePanel(fire, 0)).toBe(false);
    heat.heat.field = 0.8;
    stepFireIncident(fire, heat, false, 0.1);
    expect(resetFirePanel(fire, 0.3)).toBe(false);
    expect(resetFirePanel(fire, 0)).toBe(true);
  });

  it('runs the sprinklers until the panel is reset, then can run them again', () => {
    const fire = createFireIncident();
    const heat = createOverheatState();
    pressFireCall(fire);
    stepFireIncident(fire, heat, false, 3.1);
    expect(fire.water).toBe(true);
    stepFireIncident(fire, heat, false, 600);
    expect(fire.water).toBe(true);
    expect(fire.alarm).toBe(true);
    expect(resetFirePanel(fire, 0)).toBe(true);
    expect(fire.water).toBe(false);
    expect(fire.alarm).toBe(false);
    expect(pressFireCall(fire)).toBe(true);
    stepFireIncident(fire, heat, false, 3.1);
    expect(fire.water).toBe(true);
  });

  it('keeps the water on after an electrical ruin until the panel is reset', () => {
    const fire = createFireIncident();
    const heat = createOverheatState();
    pressFireCall(fire);
    stepFireIncident(fire, heat, true, 8.1);
    expect(fire.ruinCause).toBe('short');
    stepFireIncident(fire, heat, false, 600);
    expect(fire.water).toBe(true);
    fire.extinguished = true;
    expect(resetFirePanel(fire, 0)).toBe(true);
    expect(fire.water).toBe(false);
    expect(fire.ruinCause).toBe('short');
  });
});
