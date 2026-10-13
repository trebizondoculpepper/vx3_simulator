import { RATIO_NEUTRAL } from './rig';
import type { TripReport } from './rig';
import { XENON_MIN_FLOW_SLPM } from './xenon-supply';

/** What else was going on in the installation when the breaker went. */
export interface TripContext {
  xenonFlowSlpm: number;
}

const amount = (error: number) =>
  Math.abs(error) > 0.15 ? 'well' : 'a little';

/**
 * The teleprinter's fault printout after a trip. It names the dominant
 * source of strain and points at the settings that fed it, as clues rather
 * than instructions: the operator still has to work out the fix.
 */
export function tripClues(report: TripReport, context: TripContext): string[] {
  const lines = ['STÖRUNG · HAUPTSCHALTER AUSGELÖST.'];
  const clues: string[] = [];
  if (report.hazardShare >= 0.5)
    clues.push(
      `Strain built with the spindle running on a dry xenon circuit: ${context.xenonFlowSlpm.toFixed(1)} SLPM, commissioning minimum ${XENON_MIN_FLOW_SLPM.toFixed(1)}.`,
    );
  if (report.fieldShare >= 0.25) {
    clues.push('The H-B field ran off equilibrium before the trip.');
    if (Math.abs(report.trimError) > 0.05)
      clues.push(
        `BLATZ TRIM sat ${amount(report.trimError)} ${report.trimError > 0 ? 'above' : 'below'} the balance point.`,
      );
    if (Math.abs(report.nullOffset) > 0.1)
      clues.push('NULL was off centre; the plasma never quite settled.');
    if (Math.abs(report.drift) > 0.08 && !report.grounded)
      clues.push('Heavy drift on the trace, and GND? was open.');
    if (Math.abs(report.ratio - RATIO_NEUTRAL) > 0.15)
      clues.push(
        'RATIO was off its factory mark, which moves the balance point.',
      );
  }
  if (Math.abs(report.bandError) > 0.3)
    clues.push(
      'BAND was far from the field strength, so strain was slow to clear.',
    );
  if (clues.length === 0)
    clues.push(
      'No single setting stands out. Strain had been creeping for a while.',
    );
  return [...lines, ...clues];
}
