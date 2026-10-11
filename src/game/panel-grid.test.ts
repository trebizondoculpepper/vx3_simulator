import { describe, expect, it } from 'vitest';
import { PANEL_SAFE_MARGIN, cellRect, type PanelSpec } from './panel-grid';

describe('panel faceplate safe zone', () => {
  it('keeps edge-mounted instruments inside the handle clearance', () => {
    const panel: PanelSpec = {
      units: 2,
      controls: [],
      instruments: [
        {
          id: 'left',
          kind: 'analogue-meter',
          label: 'LEFT',
          cell: [0, 0],
          shows: 'left',
        },
        {
          id: 'right',
          kind: 'analogue-meter',
          label: 'RIGHT',
          cell: [10, 0],
          shows: 'right',
        },
      ],
    };
    const left = cellRect(panel, panel.instruments[0]);
    const right = cellRect(panel, panel.instruments[1]);
    expect(left.x - left.width / 2).toBeCloseTo(PANEL_SAFE_MARGIN);
    expect(right.x + right.width / 2).toBeCloseTo(1 - PANEL_SAFE_MARGIN);
  });
});
