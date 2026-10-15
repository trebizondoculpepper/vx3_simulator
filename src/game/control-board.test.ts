import { describe, expect, it } from 'vitest';
import {
  DRIVE_FAULT,
  acknowledge,
  annunciators,
  boardHandles,
  boardView,
  createBoard,
  latchFault,
  pressHandle,
  startLampTest,
  stepBoard,
} from './control-board';
import { createRackControls, toggleIds } from './rack-controls';
import { createRig } from './rig';
import { createSafetyTelltales } from './safety-telltales';
import { createColumnPrep } from './column-prep';

function inputs() {
  return {
    rig: createRig(),
    controls: createRackControls(),
    telltales: createSafetyTelltales(),
  };
}

const INSTAB = annunciators.findIndex((window) => window.label === 'INSTAB');
const faultTiles = (tiles: boolean[]) => [tiles[DRIVE_FAULT], tiles[INSTAB]];

describe('board handles', () => {
  it('repeat every primary rack switch exactly once, plus the mains', () => {
    const toggles = boardHandles.flatMap((handle) =>
      handle.action.kind === 'toggle' ? [handle.action.id] : [],
    );
    // The board is a remote for the primary panels; the second panel of
    // each pair keeps its own switches.
    const local = [
      'chromoAux',
      'chromoA',
      'chromoB',
      'governorEngage',
      'plasmaOn',
      'detectorBlatz',
    ];
    expect([...toggles].sort()).toEqual(
      toggleIds.filter((id) => !local.includes(id)).sort(),
    );
    expect(
      boardHandles.filter((handle) => handle.action.kind === 'mains'),
    ).toHaveLength(1);
    expect(boardHandles).toHaveLength(18);
  });

  it('follow the rack switches they repeat', () => {
    const board = createBoard();
    const state = inputs();
    const ht = boardHandles.findIndex((handle) => handle.label === 'HT');
    state.controls.toggles.ht = false;
    expect(boardView(board, state).handles[ht]).toBe(false);
    state.controls.toggles.ht = true;
    expect(boardView(board, state).handles[ht]).toBe(true);
  });

  it('spring momentary handles back after a moment', () => {
    const board = createBoard();
    const state = inputs();
    const quitt = boardHandles.findIndex((handle) => handle.label === 'QUITT');
    pressHandle(board, quitt);
    expect(boardView(board, state).handles[quitt]).toBe(true);
    stepBoard(board, state, 0.5);
    expect(boardView(board, state).handles[quitt]).toBe(false);
  });
});

describe('alarm windows', () => {
  it('flash until acknowledged, then burn steady until the cause clears', () => {
    const board = createBoard();
    const state = inputs();
    state.rig.controls.mains = true;
    state.rig.instability = 0.9;
    stepBoard(board, state, 0.1);
    expect(board.alarms[DRIVE_FAULT]).toBe('unacknowledged');
    const frames = [0, 1, 2, 3].map(() => {
      stepBoard(board, state, 0.2);
      return faultTiles(boardView(board, state).tiles)[0];
    });
    expect(frames).toContain(true);
    expect(frames).toContain(false);

    expect(acknowledge(board, state)).toBe(true);
    for (let i = 0; i < 4; i++) {
      stepBoard(board, state, 0.2);
      expect(faultTiles(boardView(board, state).tiles)).toEqual([true, true]);
    }

    state.rig.instability = 0;
    stepBoard(board, state, 0.1);
    expect(board.alarms[DRIVE_FAULT]).toBe('normal');
    expect(faultTiles(boardView(board, state).tiles)).toEqual([false, false]);
  });

  it('keep flashing after an incident until someone acknowledges', () => {
    const board = createBoard();
    const state = inputs();
    latchFault(board);
    stepBoard(board, state, 1);
    expect(board.alarms[DRIVE_FAULT]).toBe('unacknowledged');
    acknowledge(board, state);
    expect(board.alarms[DRIVE_FAULT]).toBe('normal');
    expect(acknowledge(board, state)).toBe(false);
  });
});

describe('board lamps', () => {
  it('light everything for the lamp test, then go back', () => {
    const board = createBoard();
    const state = inputs();
    startLampTest(board);
    const view = boardView(board, state);
    expect([...view.tiles, ...view.grid, ...view.status]).not.toContain(false);
    stepBoard(board, state, 3.1);
    expect(boardView(board, state).grid).not.toContain(true);
  });

  it('show each channel as a bargraph across its row of the grid', () => {
    const board = createBoard();
    const state = inputs();
    state.rig.controls.mains = true;
    state.rig.heater = 1;
    state.rig.spindle = 0.5;
    const { grid } = boardView(board, state);
    expect(grid.slice(0, 8).filter(Boolean)).toHaveLength(8);
    expect(grid.slice(8, 16).filter(Boolean)).toHaveLength(4);
    expect(grid.slice(16, 24).filter(Boolean)).toHaveLength(0);
  });

  it('give every alarm window its own warning', () => {
    expect(annunciators).toHaveLength(18);
    expect(new Set(annunciators.map((window) => window.label)).size).toBe(18);
  });

  it('show what is wrong with the vessel once NETZ is on', () => {
    const board = createBoard();
    const prep = createColumnPrep();
    const state = {
      ...inputs(),
      plantPowered: true,
      recirculatorWorking: false,
      xenonFlowSlpm: 0,
      gen2: { prep },
      exhaustPpm: 0,
    };
    const lit = () => {
      stepBoard(board, state, 0.1);
      acknowledge(board, state);
      return annunciators
        .filter((_, i) => boardView(board, state).tiles[i])
        .map((window) => window.label);
    };
    expect(lit()).toEqual([]);
    state.rig.controls.mains = true;
    expect(lit()).toEqual(['KOPF OFFEN', 'XE FLUSS', 'UMWÄLZUNG']);
    prep.lift = 0;
    prep.clamped = true;
    expect(lit()).toContain('O2 KESSEL');
    expect(lit()).not.toContain('KOPF OFFEN');
    state.exhaustPpm = 120;
    expect(lit()).toContain('ABGAS');
  });

  it('warn that the plant master is off, whatever else is happening', () => {
    const board = createBoard();
    const state = { ...inputs(), plantPowered: false };
    stepBoard(board, state, 0.1);
    acknowledge(board, state);
    expect(boardView(board, state).tiles[0]).toBe(true);
    state.plantPowered = true;
    stepBoard(board, state, 0.1);
    expect(boardView(board, state).tiles[0]).toBe(false);
  });
});
