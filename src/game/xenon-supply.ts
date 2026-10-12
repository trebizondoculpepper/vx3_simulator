/** Fictional installation's commissioning threshold, in standard litres/minute. */
export const XENON_MIN_FLOW_SLPM = 2;

/** The supply gauge dips a little under load, then recovers when flow stops. */
export function xenonSourcePressure(contents: number, flowFraction: number) {
  const remaining = Math.max(0, Math.min(1, contents));
  const flow = Math.max(0, Math.min(1, flowFraction));
  return remaining * (1 - 0.08 * flow);
}

export function xenonReady(flowSlpm: number) {
  return Number.isFinite(flowSlpm) && flowSlpm >= XENON_MIN_FLOW_SLPM;
}

/**
 * Xenon is required for safe operation, but nothing enforces it: the rig
 * starts and runs without it. Above this spindle speed an unpressurised
 * circuit is a hazard, and the bench monitor says so.
 */
export const XENON_SPINDLE_LIMIT = 0.3;

/** Strain added per second while the spindle runs on an unpressurised circuit. */
export const XENON_HAZARD_STRAIN_PER_SECOND = 0.02;

export function xenonHazard(spindle: number, flowSlpm: number) {
  return spindle > XENON_SPINDLE_LIMIT && !xenonReady(flowSlpm);
}
