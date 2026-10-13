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

  it('stops sprinkler flow 45 seconds after it begins without restarting under a latched alarm', () => {
    const fire = createFireIncident();
    const heat = createOverheatState();
    pressFireCall(fire);
    stepFireIncident(fire, heat, false, 3.1);
    expect(fire.water).toBe(true);
    const events = stepFireIncident(fire, heat, false, 45.1);
    expect(events).toContain('water-stopped');
    expect(fire.water).toBe(false);
    expect(fire.sprinklerSpent).toBe(true);
    stepFireIncident(fire, heat, false, 10);
    expect(fire.water).toBe(false);
    expect(resetFirePanel(fire, 0)).toBe(true);
    expect(pressFireCall(fire)).toBe(true);
    stepFireIncident(fire, heat, false, 3.1);
    expect(fire.water).toBe(true);
  });

  it('also shuts water off 45 seconds after an electrical ruin', () => {
    const fire = createFireIncident();
    const heat = createOverheatState();
    pressFireCall(fire);
    stepFireIncident(fire, heat, true, 8.1);
    expect(fire.ruinCause).toBe('short');
    expect(fire.water).toBe(true);
    expect(stepFireIncident(fire, heat, false, 40)).toContain('water-stopped');
    expect(fire.water).toBe(false);
  });
});
