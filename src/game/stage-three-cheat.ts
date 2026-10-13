import { createColumnPrep, REGULATOR } from './column-prep';
import type { ColumnPrepState } from './column-prep';

/** End of cold-start Stage 3: sealed, purged and pressurised, before drive start. */
export function prepareStageThree(state: ColumnPrepState) {
  Object.assign(state, createColumnPrep(), {
    lift: 0,
    liftTarget: 0,
    clamped: true,
    inletOpen: true,
    outletOpen: false,
    air: 0,
    xenon: REGULATOR,
  });
}
