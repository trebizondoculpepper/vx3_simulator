import { describe, expect, it } from 'vitest';
import { rackModules } from './rack-catalogue';
import {
  RACK_METRE,
  RACK_UNIT,
  faceLayerOffset,
  layoutModule,
  moduleBands,
  validateModuleLayout,
} from './rack-layout';
import type { RackModule } from './rack-catalogue';
import type { FaceLayer } from './rack-layout';

describe('rack faceplate grid', () => {
  it('lays out every module without overprinting its title or neighbours', () => {
    for (const module of rackModules)
      expect(validateModuleLayout(module, RACK_UNIT), module.id).toEqual([]);
  });

  it('keeps every part legible after scaling it into its cell', () => {
    for (const module of rackModules)
      for (const part of layoutModule(module, RACK_UNIT).parts)
        expect(part.scale, `${module.id} ${part.kind}`).toBeGreaterThan(0.55);
  });

  it('keeps the title, body and footer bands apart', () => {
    for (const units of [1, 2, 3, 4]) {
      const { title, body, footer, height } = moduleBands(units, RACK_UNIT);
      expect(title.y + title.height / 2).toBeLessThan(height / 2);
      expect(title.y - title.height / 2).toBeGreaterThan(
        body.y + body.height / 2,
      );
      expect(body.y - body.height / 2).toBeGreaterThanOrEqual(
        footer.y + footer.height / 2 - 1e-9,
      );
    }
  });

  it('reports a gauge pushed into a neighbouring control', () => {
    const crowded: RackModule = {
      id: 'test-a',
      maker: 'VOLT XOCCULA',
      title: 'TEST',
      units: 3,
      finish: '#000',
      controls: [{ kind: 'mains', label: 'MAINS', column: 0 }],
      instruments: [{ kind: 'heater', column: 1 }],
      provenance: 'invented',
    };
    expect(validateModuleLayout(crowded, RACK_UNIT)).not.toEqual([]);
  });

  it('stacks the faceplate layers 1 mm apart, metal at the back and labels in front', () => {
    const order: FaceLayer[] = ['metal', 'branding', 'controls', 'labels'];
    order.forEach((layer, i) =>
      expect(faceLayerOffset(layer)).toBeCloseTo(i * 0.001 * RACK_METRE),
    );
  });
});
