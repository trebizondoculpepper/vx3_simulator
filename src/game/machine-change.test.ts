import { expect, it } from 'vitest';
import { describeMachineChange } from './machine-change';

it('names individual power changes even when another switch keeps the machine off', () => {
  const before = JSON.stringify({
    powerSelections: { isolator: false, mains: false, cabinet: true },
  });
  const after = JSON.stringify({
    powerSelections: { isolator: true, mains: false, cabinet: true },
  });
  expect(describeMachineChange('Supply isolator', before, after)).toBe(
    'Supply isolator switched on.',
  );
  expect(describeMachineChange('Supply isolator', after, before)).toBe(
    'Supply isolator switched off.',
  );
});

it('describes valve positions and numeric settings', () => {
  expect(
    describeMachineChange(
      'Vessel',
      '{"column":{"inletOpen":false,"setpoint":300}}',
      '{"column":{"inletOpen":true,"setpoint":350}}',
    ),
  ).toBe('Vessel — inlet opened; setpoint set to 350.');
});
