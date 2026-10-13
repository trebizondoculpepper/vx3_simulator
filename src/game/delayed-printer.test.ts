import { expect, it } from 'vitest';
import { createDelayedPrinter } from './delayed-printer';

it('delays printing 1–2 seconds without reordering successive actions', () => {
  const lines: string[] = [];
  const delays = [1, 0];
  const printer = createDelayedPrinter(
    (line) => lines.push(line),
    () => delays.shift()!,
  );
  printer.queue('Supply on');
  printer.step(0.5);
  printer.queue('Flow opened');
  printer.step(1.49);
  expect(lines).toEqual([]);
  printer.step(0.02);
  expect(lines).toEqual(['Supply on', 'Flow opened']);
  printer.step(10);
  expect(lines).toHaveLength(2);
});

it('prints at the one-second lower bound', () => {
  const lines: string[] = [];
  const printer = createDelayedPrinter(
    (line) => lines.push(line),
    () => 0,
  );
  printer.queue('Supply off');
  printer.step(0.99);
  expect(lines).toEqual([]);
  printer.step(0.01);
  expect(lines).toEqual(['Supply off']);
});
