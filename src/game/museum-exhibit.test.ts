import { describe, expect, it } from 'vitest';
import { createMuseumExhibitModel } from './museum-exhibit';

describe('museum demonstration', () => {
  it('ignores START throughout startup, the one-minute demonstration and rundown', () => {
    const m = createMuseumExhibitModel();
    expect(m.start()).toBe(true);
    m.tick(15);
    expect(m.rig.spindle).toBeGreaterThan(0.3);
    expect(m.rig.spindle).toBeLessThan(0.6);
    expect(m.start()).toBe(false);
    m.tick(15);
    expect(m.phase).toBe('running');
    m.tick(59);
    expect(m.phase).toBe('running');
    expect(m.rig.spindle).toBeCloseTo(1);
    expect(m.start()).toBe(false);
    m.tick(1);
    expect(m.phase).toBe('stopping');
    expect(m.start()).toBe(false);
    m.tick(8);
    expect(m.phase).toBe('inactive');
    expect(m.rig.spindle).toBe(0);
    expect(m.start()).toBe(true);
  });
  it('leaves visitor inputs alone and is independent of other copies', () => {
    const m = createMuseumExhibitModel();
    const other = createMuseumExhibitModel();
    m.start();
    m.tick(30);
    m.settings.knobs.spindle = 0.4;
    m.tick(5);
    expect(m.rig.spindle).toBeCloseTo(0.4);
    expect(other.rig.spindle).toBe(0);
    m.tick(63);
    expect(m.settings.knobs.spindle).toBe(0.4);
    expect(m.settings.mains).toBe(true);
  });
  it('cannot generate a field, instability or incidents under any visitor settings', () => {
    const m = createMuseumExhibitModel();
    m.start();
    m.settings.knobs.field = 1;
    m.settings.knobs.trim = 0;
    m.settings.knobs.plasmaNull = 1;
    m.settings.knobs.ratio = 1;
    m.tick(90);
    expect(m.rig.field).toBe(0);
    expect(m.rig.instability).toBe(0);
    expect(m.rig.strain).toBe(0);
    expect(m.rig.incidents).toBe(0);
  });
});
