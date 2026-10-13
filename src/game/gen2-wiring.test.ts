import { describe, expect, it } from 'vitest';
import {
  FULL_BOTTLE,
  FULL_POWER,
  MAXIMUM,
  createColumnPrep,
} from './column-prep';
import {
  feedFromLine,
  gen2Activity,
  gen2Alarms,
  gen2BoardReadings,
  gen2PowerKw,
  gen2Powered,
} from './gen2-wiring';
import { boardView, createBoard, stepBoard } from './control-board';
import { createRig } from './rig';
import { createRackControls } from './rack-controls';
import { createSafetyTelltales } from './safety-telltales';

describe('gen2 wiring', () => {
  it('needs the plant master, the rig and the east board all closed', () => {
    const on = { plantPowered: true, rigOn: true, remoteMains: true };
    expect(gen2Powered(on)).toBe(true);
    expect(gen2Powered({ ...on, plantPowered: false })).toBe(false);
    expect(gen2Powered({ ...on, rigOn: false })).toBe(false);
    expect(gen2Powered({ ...on, remoteMains: false })).toBe(false);
  });

  it('refills the buffer from the xenon line only at working flow', () => {
    const state = createColumnPrep();
    state.supply = 10;
    feedFromLine(state, 1, 10);
    expect(state.supply).toBe(10);
    feedFromLine(state, 3, 10);
    expect(state.supply).toBeCloseTo(14.5);
    feedFromLine(state, 3, 1000);
    expect(state.supply).toBe(FULL_BOTTLE);
  });

  it('draws nothing off, and stays under the 6.5 kW limit at full power', () => {
    const state = createColumnPrep();
    expect(gen2PowerKw(state, false)).toBe(0);
    state.temperature = FULL_POWER;
    expect(gen2PowerKw(state, true)).toBeLessThan(6.5);
    state.temperature = MAXIMUM;
    expect(gen2PowerKw(state, true)).toBeGreaterThan(5);
  });

  it('is active only while the core is hot and whole', () => {
    const state = createColumnPrep();
    expect(gen2Activity(state)).toBe(0);
    state.temperature = FULL_POWER;
    state.spinRate = 1.4;
    expect(gen2Activity(state)).toBeCloseTo(1);
    state.failure = 'burnout';
    expect(gen2Activity(state)).toBe(0);
  });

  it('raises STÖRUNG on a failure and DRUCK on a starved core', () => {
    const state = createColumnPrep();
    expect(gen2Alarms(state)).toEqual({ pressure: false, fault: false });
    state.temperature = 1500;
    expect(gen2Alarms(state).pressure).toBe(true);
    state.failure = 'flux-inductance';
    expect(gen2Alarms(state).fault).toBe(true);
  });

  it('reads an open chamber as all air, and every channel within 0 to 1', () => {
    const state = createColumnPrep();
    const readings = gen2BoardReadings(state, true, 0.25);
    expect(readings.instability).toBe(1);
    for (const value of Object.values(readings)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('lights the board from the column once it is installed', () => {
    const prep = createColumnPrep();
    prep.outletOpen = true;
    prep.failure = 'burnout';
    const inputs = {
      rig: createRig(),
      controls: createRackControls(),
      telltales: createSafetyTelltales(),
      gen2: { prep, powered: true },
    };
    const board = createBoard();
    stepBoard(board, inputs, 0.1);
    const tiles = boardView(board, inputs).tiles.slice(0, 6);
    // NETZ and PUMPE lit; STÖRUNG flashing on (the flasher starts lit).
    expect(tiles[0]).toBe(true);
    expect(tiles[1]).toBe(true);
    expect(tiles[2]).toBe(false);
    expect(tiles[5]).toBe(true);
  });
});
