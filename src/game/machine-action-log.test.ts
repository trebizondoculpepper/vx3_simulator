import { describe, expect, it } from 'vitest';
import { createMachineActionLog } from './machine-action-log';

describe('machine action printing', () => {
  it('keeps room events, autonomous readings and refused inputs off the printer', () => {
    const model = { xenon: 0, supply: false };
    const printed: string[] = [];
    const log = createMachineActionLog(
      () => JSON.stringify(model),
      (line) => printed.push(line),
      () => {},
    );
    log.record('Cold start');
    log.run('Door', () => log.record('Door opened'));
    log.run('Light', () => log.record('Light on'));
    log.run('Blocked valve', () => log.record('Open cage first'));
    log.record('Temperature rising');
    expect(printed).toEqual([]);
    log.run('Flow', () => {
      model.xenon = 5;
      log.record('Flow to 5 SLPM');
    });
    expect(printed).toEqual(['Flow to 5 SLPM']);
  });
  it('prints a real update once, including inputs that previously had no log message', () => {
    let setting = 0;
    const printed: string[] = [];
    const log = createMachineActionLog(
      () => String(setting),
      (line) => printed.push(line),
      (label) => log.record(label),
    );
    log.run('Activation adjusted', () => {
      setting = 1;
    });
    log.run('Activation at end stop', () => {});
    log.run('Supply selected', () => {
      log.run('Relay', () => {
        setting = 2;
        log.record('Supply on');
      });
    });
    expect(printed).toEqual(['Activation adjusted', 'Supply on']);
  });
});
