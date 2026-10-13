import { describe, expect, it } from 'vitest';
import {
  acknowledge,
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

function inputs() {
  return {
    rig: createRig(),
    controls: createRackControls(),
    telltales: createSafetyTelltales(),
  };
}

const faultTiles = (tiles: boolean[]) => [tiles[5], tiles[11], tiles[17]];

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
    expect(board.alarms.fault).toBe('unacknowledged');
    const frames = [0, 1, 2, 3].map(() => {
      stepBoard(board, state, 0.2);
      return faultTiles(boardView(board, state).tiles)[0];
    });
    expect(frames).toContain(true);
    expect(frames).toContain(false);

    expect(acknowledge(board, state)).toBe(true);
    for (let i = 0; i < 4; i++) {
      stepBoard(board, state, 0.2);
      expect(faultTiles(boardView(board, state).tiles)).toEqual([
        true,
        true,
        true,
      ]);
    }

    state.rig.instability = 0;
    stepBoard(board, state, 0.1);
    expect(board.alarms.fault).toBe('normal');
    expect(faultTiles(boardView(board, state).tiles)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('keep flashing after an incident until someone acknowledges', () => {
    const board = createBoard();
    const state = inputs();
    latchFault(board);
    stepBoard(board, state, 1);
    expect(board.alarms.fault).toBe('unacknowledged');
    acknowledge(board, state);
    expect(board.alarms.fault).toBe('normal');
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

  it('report mains and running plant on the annunciators', () => {
    const board = createBoard();
    const state = inputs();
    expect(boardView(board, state).tiles.slice(0, 6)).toEqual(
      Array(6).fill(false),
    );
    state.rig.controls.mains = true;
    state.rig.spindle = 0.6;
    const tiles = boardView(board, state).tiles.slice(0, 6);
    expect(tiles[0]).toBe(true);
    expect(tiles[1]).toBe(true);
    expect(tiles[2]).toBe(false);
  });

  it('warns on the western bay when plant power is on but xenon recirculation has stopped', () => {
    const board = createBoard();
    const state = {
      ...inputs(),
      plantPowered: false,
      recirculatorWorking: false,
    };
    expect(boardView(board, state).tiles[4]).toBe(false);
    state.plantPowered = true;
    expect(boardView(board, state).tiles[4]).toBe(true);
    stepBoard(board, state, 0.5);
    expect(boardView(board, state).tiles[4]).toBe(false);
    state.recirculatorWorking = true;
    stepBoard(board, state, 0.5);
    expect(boardView(board, state).tiles[4]).toBe(false);
  });
});
