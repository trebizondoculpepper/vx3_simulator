import type { RigState } from './rig';

/**
 * What happens to the room when the ferrocores wake up. Nothing here is
 * dangerous on its own; it is just that, near running cores, colour
 * channels breathe out of step with one another, π stops being quite π,
 * space bends and the time-dilation crystal sheds sparks.
 */

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

/**
 * How active the ferrocores are, 0 to 1. They wake as the drum spins past
 * a fifth of full speed and grow stronger with the field.
 */
export function ferrocoreActivity(rig: RigState) {
  return clamp(smoothstep(0.2, 0.9, rig.spindle) * (0.7 + 0.3 * rig.field));
}

export interface AnomalyEffects {
  /** Multipliers for the red, green and blue channels. */
  channels: [number, number, number];
  /** The local value of π. */
  pi: number;
  /** How far space is bent, 0 (flat) to 1. */
  warp: number;
  /** Sparks shed by the time-dilation crystal per second. */
  sparkleRate: number;
}

/** Each colour channel breathes on its own slow cycle, all well under 1 Hz. */
export const CHANNEL_HZ = [0.31, 0.47, 0.73] as const;

export function anomalyEffects(
  activity: number,
  seconds: number,
  reducedMotion: boolean,
): AnomalyEffects {
  const a = clamp(activity);
  const depth = reducedMotion ? 0 : 0.28 * a;
  const channels = CHANNEL_HZ.map(
    (hz, i) => 1 + depth * Math.sin(seconds * hz * Math.PI * 2 + i * 2.1),
  ) as [number, number, number];
  // π wanders slowly, further the harder the cores run.
  const pi =
    Math.PI +
    a *
      a *
      (0.035 * Math.sin(seconds * 0.13) + 0.012 * Math.sin(seconds * 0.71));
  return {
    channels,
    pi,
    warp: reducedMotion ? 0 : a ** 1.5,
    sparkleRate: a > 0.05 ? 4 + a * 36 : 0,
  };
}

/** Stages for the operator's log: 0 dormant, 1 active, 2 strongly active. */
export function anomalyStage(activity: number) {
  return activity > 0.6 ? 2 : activity > 0.15 ? 1 : 0;
}
