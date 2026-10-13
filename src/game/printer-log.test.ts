import { describe, expect, it } from 'vitest';
import { createPrinterLog } from './printer-log';

describe('continuous printer log', () => {
  it('keeps timestamped operator actions in chronological order and wraps long lines', () => {
    const log = createPrinterLog(24);
    log.append('08:23  SPINDLE to 2.0.');
    log.append('08:24  Plant-room door opening.');
    expect(log.rows[0]).toBe('08:23  SPINDLE to 2.0.');
    expect(log.rows.slice(1).join(' ')).toBe('08:24  Plant-room door opening.');
    for (const row of log.rows) expect(row.length).toBeLessThanOrEqual(24);
  });

  it('has a bounded ink window while paper travel loops indefinitely', () => {
    const log = createPrinterLog(24, 16);
    for (let i = 0; i < 5000; i++) log.append(`EVENT ${i}`);
    expect(log.rows).toHaveLength(16);
    expect(log.rows.at(-1)).toBe('EVENT 4999');
    for (let i = 0; i < 5000; i++) log.step(1);
    expect(log.phase).toBeGreaterThanOrEqual(0);
    expect(log.phase).toBeLessThan(1);
  });

  it('prints queued actions, then stops feeding and making line cues while idle', () => {
    const log = createPrinterLog();
    log.append('08:23 TEST');
    expect(log.printing).toBe(true);
    expect(log.step(1)).toBe(true);
    expect(log.linesStarted).toBe(1);
    expect(log.printing).toBe(false);
    const afterPrint = log.phase;
    expect(log.step(1)).toBe(false);
    expect(log.phase).toBe(afterPrint);
    expect(log.linesStarted).toBe(0);
    expect(log.rows).toEqual(['08:23 TEST']);
  });
});

it('starts one sound cue per wrapped printed line, not per frame', () => {
  const log = createPrinterLog(10);
  log.append('abcdefghij klmnopqrst');
  log.step(0.01);
  expect(log.linesStarted).toBe(1);
  log.step(0.01);
  expect(log.linesStarted).toBe(0);
  log.step(0.15);
  expect(log.linesStarted).toBe(1);
  log.step(1);
  expect(log.linesStarted).toBe(0);
});
