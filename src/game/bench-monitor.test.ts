import { describe, expect, it } from 'vitest';
import {
  BBC_BOOT_SECONDS,
  benchPage,
  bbcPages,
  benchScreen,
  benchWarnings,
  createBenchComputer,
} from './bench-monitor';
import { createRackControls, applyRack } from './rack-controls';
import { createRig, stepRig } from './rig';
import { XENON_SPINDLE_LIMIT } from './xenon-supply';

function running(spindle: number, xenonFlowSlpm: number) {
  const rig = createRig();
  rig.controls.mains = true;
  rig.spindle = spindle;
  return { rig, xenonFlowSlpm, plantPowered: true };
}

describe('bench monitor', () => {
  it('offers xenon commissioning advice even before the spindle becomes hazardous', () => {
    const warnings = benchWarnings(running(XENON_SPINDLE_LIMIT - 0.05, 0));
    expect(warnings[0]).toBe('XENONZUFUHR UNZUREICHEND');
    expect(warnings).toContain('KAEFIG OEFFNEN; XENON AUFDREHEN');
  });

  it('prioritises excessive spindle speed when the xenon circuit is unpressurised', () => {
    const warnings = benchWarnings(running(0.6, 0.5));
    expect(warnings[0]).toBe('SPINDELDREHZAHL ZU HOCH');
    expect(warnings).toContain('XENONZUFUHR UNZUREICHEND');
    expect(benchWarnings(running(0.6, 3))).toEqual([]);
  });

  it('keeps the fault and remedy readable throughout the flashing attention marker', () => {
    const on = benchScreen(running(0.6, 0), true).lines;
    const off = benchScreen(running(0.6, 0), false).lines;
    expect(on.map(([text]) => text)).toContain('*** ACHTUNG ***');
    expect(off.map(([text]) => text)).not.toContain('*** ACHTUNG ***');
    for (const lines of [on, off])
      expect(lines.map(([text]) => text)).toContain(
        'DREHZAHL AM ANTRIEB SENKEN.',
      );
  });

  it('shows live spindle speed and xenon flow', () => {
    const { lines } = benchScreen(running(0.5, 3), true);
    expect(lines.map(([text]) => text)).toContain('SPINDEL  1800 U/MIN');
    expect(lines.map(([text]) => text)).toContain('XENON    3.0 SLPM');
  });

  it('distinguishes missing master power from an open rack switch', () => {
    const inputs = running(0, 0);
    expect(benchWarnings({ ...inputs, plantPowered: false })[0]).toBe(
      'STROMVERSORGUNG AUS',
    );
    inputs.rig.controls.mains = false;
    expect(benchWarnings(inputs)).toEqual([
      'MASCHINE AUSGESCHALTET',
      'NETZ AM OSTPULT SCHLIESSEN',
    ]);
  });

  it('warns about overspeed with sufficient gas and about exceeding a lowered governor limit', () => {
    const inputs = running(0.95, 3);
    expect(benchWarnings(inputs)[0]).toBe('SPINDELDREHZAHL ZU HOCH');
    inputs.rig.spindle = 0.5;
    inputs.rig.controls.governor = 0.3;
    expect(benchWarnings(inputs)[0]).toBe('SPINDELDREHZAHL ZU HOCH');
    inputs.rig.spindle = 0.3;
    expect(benchWarnings(inputs)).toEqual([]);
  });

  it('clears the screen on every restart, shows the ROM boot and then diagnostics', () => {
    const computer = createBenchComputer();
    const inputs = running(0.5, 3);
    expect(benchScreen(inputs, false, computer.elapsed).lines).toEqual([]);
    computer.step(0.2);
    expect(benchScreen(inputs, false, computer.elapsed).lines[0][0]).toBe(
      'BBC Computer 32K',
    );
    computer.step(BBC_BOOT_SECONDS);
    expect(computer.booted).toBe(true);
    expect(benchScreen(inputs, false, computer.elapsed).lines[0][0]).toContain(
      'BETRIEBSDIAGNOSE',
    );
    computer.reset();
    expect(computer.booted).toBe(false);
    expect(benchScreen(inputs, false, computer.elapsed).lines).toEqual([]);
    computer.step(1);
    computer.reset();
    expect(computer.elapsed).toBe(0);
    expect(inputs.rig.controls.mains).toBe(true);
    expect(inputs.rig.spindle).toBe(0.5);
  });

  it('keeps every status page inside the tube text area', () => {
    for (const inputs of [
      running(0.95, 0),
      running(0.5, 3),
      { ...running(0, 0), plantPowered: false },
    ]) {
      const lines = benchScreen(inputs, true).lines;
      expect(lines.length).toBeLessThanOrEqual(18);
      for (const [text] of lines)
        expect(text.length, text).toBeLessThanOrEqual(36);
    }
  });
});

it('selects clues for the real ferrocore start-up sequence and only acknowledges actual motion', () => {
  const rig = createRig();
  const rack = createRackControls();
  const inputs = { rig, rack, xenonFlowSlpm: 0, plantPowered: false };
  expect(benchPage(inputs)).toBe('master-off');
  inputs.plantPowered = true;
  expect(benchPage(inputs)).toBe('rack-off');
  rig.controls.mains = true;
  expect(benchPage(inputs)).toBe('xenon-low');
  inputs.xenonFlowSlpm = 3;
  expect(benchPage(inputs)).toBe('heaters');
  rig.heater = 0.8;
  rack.toggles.spin = false;
  expect(benchPage(inputs)).toBe('drive-off');
  rack.toggles.spin = true;
  rack.knobs.governor = 0;
  applyRack(rack, rig.controls);
  expect(benchPage(inputs)).toBe('governor');
  rack.knobs.governor = 1;
  applyRack(rack, rig.controls);
  expect(benchPage(inputs)).toBe('drive-ready');
  rack.knobs.spindle = 0.2;
  applyRack(rack, rig.controls);
  expect(benchPage(inputs)).toBe('starting');
  rig.spindle = 0.2;
  expect(benchPage(inputs)).toBe('cores-turning');
  inputs.xenonFlowSlpm = 0;
  expect(benchPage(inputs)).toBe('xenon-low');
  rig.spindle = 0.6;
  expect(benchPage(inputs)).toBe('speed-high');
});

it('all pre-rendered clue pages fit the tube and use the same fixed twelve-row layout', () => {
  for (const lines of Object.values(bbcPages)) {
    expect(lines).toHaveLength(12);
    for (const [text] of lines)
      expect(text.length, text).toBeLessThanOrEqual(36);
  }
});

it('can reach the ferrocore clue milestone by warming and driving the real rig, with no field excitation', () => {
  const rig = createRig();
  const rack = createRackControls();
  rack.knobs.spindle = 0.2;
  rack.knobs.field = 0;
  applyRack(rack, rig.controls);
  rig.controls.mains = true;
  const inputs = { rig, rack, xenonFlowSlpm: 3, plantPowered: true };
  expect(benchPage(inputs)).toBe('heaters');
  for (let frame = 0; frame < 600; frame++) stepRig(rig, 1 / 60, () => 0.5);
  expect(rig.spindle).toBeCloseTo(0.2);
  expect(rig.field).toBe(0);
  expect(benchPage(inputs)).toBe('cores-turning');
});

it('ships pre-rendered assets containing every displayed clue', () => {
  const assets = import.meta.glob<string>('../../public/screens/bbc/*.svg', {
    eager: true,
    query: '?raw',
    import: 'default',
  });
  for (const [id, lines] of Object.entries(bbcPages)) {
    const svg = assets[`../../public/screens/bbc/${id}.svg`];
    expect(svg).toContain('viewBox="0 0 320 240"');
    for (const [text] of lines.filter(([text]) => text))
      expect(svg, id).toContain(text);
  }
});

it('shows the vessel page while the atmosphere is not ready', () => {
  const inputs = running(0, 0);
  expect(benchPage({ ...inputs, permit: false })).toBe('vessel');
  expect(benchWarnings({ ...inputs, permit: false })).toContain(
    'KESSEL NICHT BEREIT',
  );
  expect(benchPage({ ...inputs, permit: true })).not.toBe('vessel');
});
