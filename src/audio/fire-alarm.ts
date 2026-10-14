/**
 * The building's fire alarm: the sounders on the BZ-3 fire panel's loop,
 * heard together in the lab's concrete.
 *
 * Its character comes from a recording of a German "Hausalarm" (see
 * CREDITS.md), analysed for pitch and timing and then synthesised from
 * scratch; nothing of the recording is used. That recording has three
 * sounders: a piezo at about 3.1 kHz pulsing half a second on and half a
 * second off; in its gaps a buzzer stepping between two pitches (its
 * harmonics at 1.65, 2.48 and 3.30 kHz, then 2.04 and 3.07 kHz); and,
 * further off, a sounder sweeping down from about 3.25 to 2.1 kHz in a
 * third of a second. Ours keeps that arrangement, at our own pitches.
 */

/** One second: the piezo, then the buzzer's two notes in its gap. */
export const ALARM_CYCLE = 1;
/** The far sounder's sweep, which fits the cycle evenly. */
export const SWEEP_PERIOD = 0.4;
/** The rendered loop: whole cycles and whole sweeps, so it joins cleanly. */
export const ALARM_LOOP = 4;

export const PIEZO_HZ = 3080;
/** The buzzer's two notes (fundamentals; its harmonics carry it). */
export const BUZZER_HZ = [820, 1010] as const;
export const SWEEP_FROM_HZ = 3250;
export const SWEEP_TO_HZ = 2100;

/** A note's span within the cycle, in seconds. */
interface Span {
  from: number;
  to: number;
}

export const PIEZO_SPAN: Span = { from: 0, to: 0.48 };
export const BUZZER_SPANS: readonly [Span, Span] = [
  { from: 0.5, to: 0.72 },
  { from: 0.74, to: 0.97 },
];
const SWEEP_LENGTH = 0.32;

/** Level at `t` within a span: 6 ms rises and falls, nothing outside it. */
function gate(t: number, { from, to }: Span, edge = 0.006) {
  if (t < from || t >= to) return 0;
  return Math.min(1, (t - from) / edge, (to - t) / edge);
}

/** What is sounding at time `t` (seconds), for tests and the renderer. */
export function alarmAt(t: number) {
  const inCycle = ((t % ALARM_CYCLE) + ALARM_CYCLE) % ALARM_CYCLE;
  const inSweep = ((t % SWEEP_PERIOD) + SWEEP_PERIOD) % SWEEP_PERIOD;
  const sweepShare = Math.min(1, inSweep / SWEEP_LENGTH);
  return {
    piezo: gate(inCycle, PIEZO_SPAN),
    buzzer: BUZZER_SPANS.map((span) => gate(inCycle, span)) as [number, number],
    sweep: gate(inSweep, { from: 0, to: SWEEP_LENGTH }, 0.012),
    /** The far sounder falls exponentially through its sweep. */
    sweepHz: SWEEP_FROM_HZ * (SWEEP_TO_HZ / SWEEP_FROM_HZ) ** sweepShare,
  };
}

/**
 * Render the loop at `sampleRate`: mono samples in [-1, 1]. Every note
 * starts and ends silent, so the loop has no click where it joins, and
 * the room's short reflections wrap round its end.
 */
export function renderFireAlarm(sampleRate: number): Float32Array {
  const length = Math.round(ALARM_LOOP * sampleRate);
  const dry = new Float32Array(length);
  const tau = Math.PI * 2;
  let piezoPhase = 0;
  const buzzerPhase = [0, 0];
  let sweepPhase = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const now = alarmAt(t);
    // The piezo: nearly pure, a little second harmonic, a faint 80 Hz
    // roughness from its drive.
    piezoPhase += (tau * PIEZO_HZ) / sampleRate;
    const piezo =
      (Math.sin(piezoPhase) + 0.1 * Math.sin(2 * piezoPhase)) *
      (1 - 0.08 * (1 + Math.sin(tau * 80 * t)));
    // The buzzer: a hard, horn-like tone whose fundamental is weak and
    // whose second to fourth harmonics carry it.
    let buzzer = 0;
    for (let n = 0; n < 2; n++) {
      if (!now.buzzer[n]) {
        buzzerPhase[n] = 0;
        continue;
      }
      buzzerPhase[n] += (tau * BUZZER_HZ[n]) / sampleRate;
      const p = buzzerPhase[n];
      buzzer +=
        now.buzzer[n] *
        (0.25 * Math.sin(p) +
          0.9 * Math.sin(2 * p) +
          0.7 * Math.sin(3 * p) +
          0.6 * Math.sin(4 * p) +
          0.2 * Math.sin(5 * p));
    }
    // The far sounder, through a wall: quieter, its top softened.
    if (now.sweep) sweepPhase += (tau * now.sweepHz) / sampleRate;
    else sweepPhase = 0;
    const sweep = Math.sin(sweepPhase) + 0.15 * Math.sin(2 * sweepPhase);
    dry[i] = 0.5 * now.piezo * piezo + 0.2 * buzzer + 0.14 * now.sweep * sweep;
  }
  // The lab's bare concrete: a few short reflections, wrapping round.
  const taps: [number, number][] = [
    [0.019, 0.32],
    [0.037, 0.22],
    [0.061, 0.14],
    [0.097, 0.08],
  ];
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let v = dry[i];
    for (const [delay, level] of taps)
      v += level * dry[(i - Math.round(delay * sampleRate) + length) % length];
    out[i] = v;
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < length; i++) out[i] *= 0.9 / peak;
  return out;
}
