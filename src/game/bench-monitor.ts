import pages from './bbc-pages.json';
import type { RackControls } from './rack-controls';
import { deltaScore, YALGETH_LIMIT } from './rig';
import type { RigState } from './rig';
import { XENON_MIN_FLOW_SLPM, xenonHazard, xenonReady } from './xenon-supply';

export interface BenchInputs {
  rig: RigState;
  xenonFlowSlpm: number;
  /** The computer and lights have a separate supply from the apparatus. */
  plantPowered?: boolean;
  rack?: RackControls;
  /**
   * The drive's atmosphere permit from the column's vessel: false while it
   * is not sealed, purged, pressurised and recirculating.
   */
  permit?: boolean;
}

export type ScreenLine = [text: string, ink: string];
export const MODE7 = {
  white: '#f2f2ee',
  yellow: '#f4e04a',
  cyan: '#5fe0e8',
  green: '#6ef06e',
  red: '#f04a3c',
};

export type BbcPageId = keyof typeof pages;
export const bbcPageIds = Object.keys(pages) as BbcPageId[];
export const bbcPages = pages;

export const BBC_BOOT_SECONDS = 3;
export function createBenchComputer() {
  let elapsed = 0;
  return {
    reset() {
      elapsed = 0;
    },
    step(delta: number) {
      elapsed = Math.min(BBC_BOOT_SECONDS, elapsed + Math.max(0, delta));
    },
    get elapsed() {
      return elapsed;
    },
    get booted() {
      return elapsed >= BBC_BOOT_SECONDS;
    },
  };
}

export function spindleTooHigh({ rig, xenonFlowSlpm }: BenchInputs) {
  return (
    rig.controls.mains &&
    (xenonHazard(rig.spindle, xenonFlowSlpm) ||
      rig.spindle > Math.min(0.85, rig.controls.governor ?? 1) + 0.025)
  );
}

/** Status pages are original German text for this installation. */
export function benchWarnings(inputs: BenchInputs): string[] {
  const { rig, xenonFlowSlpm, plantPowered = true } = inputs;
  if (!plantPowered)
    return ['STROMVERSORGUNG AUS', 'HAUPTSCHALTER EINSCHALTEN'];
  if (!rig.controls.mains)
    return ['MASCHINE AUSGESCHALTET', 'NETZ AM OSTPULT SCHLIESSEN'];
  const warnings: string[] = [];
  if (inputs.permit === false)
    warnings.push('HEIZUNG GESPERRT', 'KESSEL SPUELEN UND FUELLEN');
  if (spindleTooHigh(inputs))
    warnings.push('SPINDELDREHZAHL ZU HOCH', 'DREHZAHL AM ANTRIEB SENKEN');
  if (!xenonReady(xenonFlowSlpm))
    warnings.push(
      'XENONZUFUHR UNZUREICHEND',
      'KAEFIG OEFFNEN; XENON AUFDREHEN',
      `MINDESTFLUSS ${XENON_MIN_FLOW_SLPM.toFixed(1)} SLPM`,
    );
  return warnings;
}

export function benchScreen(
  inputs: BenchInputs,
  flashOn: boolean,
  bootElapsed = BBC_BOOT_SECONDS,
) {
  if (bootElapsed < 0.15)
    return {
      lines: [] as ScreenLine[],
      warnings: [],
      cursor: false,
      page: undefined,
    };
  const boot: ScreenLine[] = [
    ['BBC Computer 32K', MODE7.white],
    ['', ''],
    ['Acorn DFS', MODE7.white],
    ['', ''],
    ['BASIC', MODE7.white],
    ['', ''],
  ];
  if (bootElapsed < BBC_BOOT_SECONDS) {
    if (bootElapsed < 0.8) boot.splice(2);
    else if (bootElapsed >= 1.4)
      boot.push(
        ['>CHAIN "VX3CAL"', MODE7.white],
        ['', ''],
        ['DIAGNOSE WIRD GELADEN...', MODE7.cyan],
      );
    return {
      lines: boot,
      warnings: [],
      cursor: bootElapsed >= 0.8,
      page: undefined,
    };
  }
  const { rig, xenonFlowSlpm } = inputs;
  const warnings = benchWarnings(inputs);
  const page = benchPage(inputs);
  const lines = pages[page].map(([text, ink]) => [text, ink] as ScreenLine);
  lines.push(
    [
      `SPINDEL  ${String(Math.round(rig.spindle * 3600)).padStart(4, '0')} U/MIN`,
      MODE7.green,
    ],
    [
      `XENON    ${Math.max(0, xenonFlowSlpm).toFixed(1)} SLPM`,
      xenonReady(xenonFlowSlpm) ? MODE7.green : MODE7.yellow,
    ],
    [
      `DELTA    ${deltaScore(rig).toFixed(3)} / ${YALGETH_LIMIT.toFixed(3)}`,
      MODE7.green,
    ],
    ['', ''],
    ['BBC ANKLICKEN: NEUSTART', MODE7.cyan],
  );
  if (
    warnings.length &&
    flashOn &&
    rig.controls.mains &&
    inputs.plantPowered !== false
  )
    lines[3] = ['*** ACHTUNG ***', MODE7.red];
  return { lines, warnings, cursor: false, page };
}

/** Clues follow the actual prerequisites for the spindle-driven carousel. */
export function benchPage(inputs: BenchInputs): BbcPageId {
  const { rig, rack, xenonFlowSlpm } = inputs;
  if (inputs.plantPowered === false) return 'master-off';
  if (!rig.controls.mains) return 'rack-off';
  if (inputs.permit === false) return 'vessel';
  if (spindleTooHigh(inputs)) return 'speed-high';
  if (!xenonReady(xenonFlowSlpm)) return 'xenon-low';
  if (rig.spindle > 0.1 && rig.heater > 0.5) return 'cores-turning';
  if (rig.heater <= 0.5) return 'heaters';
  if (rack && !rack.toggles.spin) return 'drive-off';
  if ((rig.controls.governor ?? 1) <= 0.05) return 'governor';
  if (rig.controls.spindle <= 0.05) return 'drive-ready';
  return 'starting';
}
