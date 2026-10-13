/**
 * What the ferrocore sounds like, as plain numbers for the Web Audio patch
 * in `core-voice.ts`. Pure, so it can be tested without an AudioContext.
 *
 * Cold, the core is silent. Active, it is a low FM growl that climbs in
 * pitch and brightens with temperature, from about 35 Hz at activation to
 * about 110 Hz at full power, gaining inharmonic partials on the way. Its
 * spin sweeps the level and filter once per revolution, like a rotating
 * speaker, and each of its four tie bars ticks as it passes. At full power
 * an inharmonic shimmer comes in and the whole voice pulses in time with
 * the core's visible pulse. Sealed in the steel chamber it is muffled.
 */

export interface CoreVoiceInput {
  kelvin: number;
  /** The brightness control, 0 to 1. */
  brightness: number;
  /** Revolutions per second. */
  spinRate: number;
  /** Whether the core is down in the chamber, heard through its walls. */
  sealed: boolean;
  failed: boolean;
}

export interface CoreVoiceParameters {
  /** Overall level, 0 to 1. */
  gain: number;
  /** The drone's fundamental, Hz. */
  pitchHz: number;
  /** FM modulator frequency as a ratio of the fundamental; not a whole number, so the partials are inharmonic. */
  fmRatio: number;
  /** FM depth as a multiple of the modulator frequency. */
  fmIndex: number;
  /** The resonant filter's centre, Hz. */
  filterHz: number;
  /** Level of the ring-modulated shimmer, 0 to 1. */
  shimmer: number;
  /** The ring modulator's two frequencies, Hz. */
  shimmerHz: [number, number];
  /** The once-per-revolution sweep: rate in Hz and depth 0 to 1. */
  whooshHz: number;
  whooshDepth: number;
  /** Tie bars passing per second, and how loud each tick is, 0 to 1. */
  ticksPerSecond: number;
  tickLevel: number;
  /** The full-power pulse: rate in Hz and depth 0 to 1. */
  pulseHz: number;
  pulseDepth: number;
  /** The muffling lowpass, Hz: low when sealed in steel. */
  muffleHz: number;
}

/** The temperatures the voice is scaled between, matching the vessel model. */
export const VOICE_ACTIVATION_K = 800;
export const VOICE_FULL_POWER_K = 3200;
export const VOICE_LOW_HZ = 35;
export const VOICE_HIGH_HZ = 110;
/** The core's visible pulse at full power, 5.5 radians per second. */
export const PULSE_HZ = 5.5 / (2 * Math.PI);
/** Tie bars across the core's coils. */
export const TIE_BARS = 4;
/** The revolution rate at which the sweep and ticks are at their deepest. */
const FULL_SPIN = 1.4;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

export function coreVoiceParameters(
  input: CoreVoiceInput,
): CoreVoiceParameters {
  const heat = clamp(
    (input.kelvin - VOICE_ACTIVATION_K) /
      (VOICE_FULL_POWER_K - VOICE_ACTIVATION_K),
  );
  // It fades in over the last 150 K before activation, so it never clicks on.
  const awake = smoothstep(
    VOICE_ACTIVATION_K - 150,
    VOICE_ACTIVATION_K,
    input.kelvin,
  );
  const full = input.kelvin >= VOICE_FULL_POWER_K;
  const pitchHz = VOICE_LOW_HZ * (VOICE_HIGH_HZ / VOICE_LOW_HZ) ** heat;
  const spin = clamp(input.spinRate / FULL_SPIN);
  return {
    gain: input.failed
      ? 0
      : clamp(input.brightness) *
        awake *
        (0.35 + 0.65 * smoothstep(0, 0.3, heat)),
    pitchHz,
    fmRatio: 1.414 + heat * 0.31,
    fmIndex: 0.4 + heat * 2.4,
    filterHz: 160 + heat * 2600,
    shimmer: smoothstep(0.7, 1, heat),
    shimmerHz: [pitchHz * 3.17, pitchHz * 2.76 + 7],
    whooshHz: input.spinRate,
    whooshDepth: 0.55 * spin,
    ticksPerSecond: input.spinRate * TIE_BARS,
    tickLevel: 0.6 * spin,
    pulseHz: PULSE_HZ,
    pulseDepth: full ? 0.28 : 0,
    muffleHz: input.sealed ? 900 : 12000,
  };
}
