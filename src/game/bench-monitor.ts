import { deltaScore, YALGETH_LIMIT } from './rig';
import type { RigState } from './rig';
import { XENON_MIN_FLOW_SLPM, xenonHazard } from './xenon-supply';

/**
 * What the calibration program on the bench BBC Micro shows on the Cub:
 * live spindle and Delta readings, and any warnings, which flash in red the
 * way Mode 7 flashing text does.
 */

export interface BenchInputs {
  rig: RigState;
  xenonFlowSlpm: number;
}

/** Hazards the program knows to look for, worst first. */
export function benchWarnings({ rig, xenonFlowSlpm }: BenchInputs): string[] {
  const warnings: string[] = [];
  if (rig.controls.mains && xenonHazard(rig.spindle, xenonFlowSlpm))
    warnings.push(
      'XENON CIRCUIT NOT PRESSURISED',
      `FLOW ${Math.max(0, xenonFlowSlpm).toFixed(1)} SLPM  NEED ${XENON_MIN_FLOW_SLPM.toFixed(1)}`,
    );
  return warnings;
}

export type ScreenLine = [text: string, ink: string];

export const MODE7 = {
  white: '#f2f2ee',
  yellow: '#f4e04a',
  cyan: '#5fe0e8',
  green: '#6ef06e',
  red: '#f04a3c',
};

/** The screen's text lines; warning lines are blank in the flash's off phase. */
export function benchScreen(inputs: BenchInputs, flashOn: boolean) {
  const { rig } = inputs;
  const rpm = rig.controls.mains ? Math.round(rig.spindle * 3600) : 0;
  const delta = rig.controls.mains ? deltaScore(rig) : 0;
  const warnings = benchWarnings(inputs);
  const lines: ScreenLine[] = [
    ['BBC Computer 32K', MODE7.white],
    ['', ''],
    ['Acorn DFS', MODE7.white],
    ['', ''],
    ['BASIC', MODE7.white],
    ['', ''],
    ['>CHAIN "VX3CAL"', MODE7.white],
    ['', ''],
    ['VX3 FIELD CALIBRATION  1.4', MODE7.yellow],
    ['UNIV. LEIPZIG  RAUM -02 17', MODE7.cyan],
    ['', ''],
    [`SPINDLE  ${String(rpm).padStart(4, '0')} RPM`, MODE7.green],
    [`DELTA    ${delta.toFixed(3)} / ${YALGETH_LIMIT.toFixed(3)}`, MODE7.green],
    ['', ''],
  ];
  if (warnings.length)
    for (const [i, warning] of warnings.entries())
      lines.push([
        flashOn ? (i === 0 ? `** ${warning} **` : warning) : '',
        MODE7.red,
      ]);
  else lines.push(['PRESS SPACE TO SAMPLE', MODE7.white]);
  return { lines, warnings };
}
