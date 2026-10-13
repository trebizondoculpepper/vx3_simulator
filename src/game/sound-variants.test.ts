import { expect, it } from 'vitest';
import { createVariantPicker } from './sound-variants';
it('uses all five samples per set without adjacent repeats', () => {
  const pick = createVariantPicker(5, () => 0.3);
  const chosen = Array.from({ length: 50 }, pick);
  for (let i = 0; i < chosen.length; i += 5)
    expect(new Set(chosen.slice(i, i + 5)).size).toBe(5);
  for (let i = 1; i < chosen.length; i++)
    expect(chosen[i]).not.toBe(chosen[i - 1]);
});
