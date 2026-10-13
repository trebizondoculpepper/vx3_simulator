import type { CoreVoiceParameters } from './core-voice-parameters';

/**
 * The ferrocore's voice: a Web Audio patch driven every frame by
 * `coreVoiceParameters`. Create it only after a user gesture, on whatever
 * context the rest of the sound uses, and connect it to that context's
 * output.
 *
 * The patch:
 *
 *   modulator ─▶ fm depth ─▶ carrier.frequency
 *   carrier + sub ─────────────────┐
 *   ring (shimmer A × shimmer B) ──┤
 *                                  ▼
 *       resonant lowpass (swept by the revolution LFO)
 *                                  ▼
 *       sweep gain (revolution LFO) ─▶ pulse gain (pulse LFO)
 *                                  ▼
 *       muffle lowpass (the chamber's steel) ─▶ level ─▶ out
 *   tick noise ─▶ bandpass ─▶ tick envelope ─▶ muffle
 *
 * Ticks are scheduled from the core's angle, so each one lands as a tie
 * bar passes, in step with the picture.
 */
export function createCoreVoice(context: BaseAudioContext) {
  const now = () => context.currentTime;
  // The first update sets everything at once, so the voice never swoops
  // down from the oscillators' default pitch.
  let first = true;
  const glide = (param: AudioParam, value: number, seconds = 0.08) =>
    first
      ? param.setValueAtTime(value, now())
      : param.setTargetAtTime(value, now(), seconds);

  // `out` carries the drone; `master` also takes the one-off crackle, so
  // a silenced drone does not silence its own catastrophe.
  const master = context.createGain();
  const out = context.createGain();
  out.gain.value = 0;
  out.connect(master);
  const muffle = context.createBiquadFilter();
  muffle.type = 'lowpass';
  muffle.frequency.value = 900;
  muffle.connect(out);

  // The full-power pulse, and the once-per-revolution sweep.
  const pulse = context.createGain();
  pulse.gain.value = 1;
  pulse.connect(muffle);
  const pulseLfo = context.createOscillator();
  const pulseDepth = context.createGain();
  pulseDepth.gain.value = 0;
  pulseLfo.connect(pulseDepth).connect(pulse.gain);
  const sweep = context.createGain();
  sweep.gain.value = 1;
  sweep.connect(pulse);
  const sweepLfo = context.createOscillator();
  sweepLfo.frequency.value = 0;
  const sweepDepth = context.createGain();
  sweepDepth.gain.value = 0;
  sweepLfo.connect(sweepDepth).connect(sweep.gain);

  // The tone's resonant filter, opened and closed by the same sweep.
  const tone = context.createBiquadFilter();
  tone.type = 'lowpass';
  tone.Q.value = 6;
  tone.frequency.value = 200;
  tone.connect(sweep);
  const filterSweep = context.createGain();
  filterSweep.gain.value = 0;
  sweepLfo.connect(filterSweep).connect(tone.frequency);

  // The FM drone and its sub-octave.
  const carrier = context.createOscillator();
  carrier.type = 'triangle';
  const modulator = context.createOscillator();
  const fmDepth = context.createGain();
  fmDepth.gain.value = 0;
  modulator.connect(fmDepth).connect(carrier.frequency);
  const carrierLevel = context.createGain();
  carrierLevel.gain.value = 0.55;
  carrier.connect(carrierLevel).connect(tone);
  const sub = context.createOscillator();
  const subLevel = context.createGain();
  subLevel.gain.value = 0.35;
  sub.connect(subLevel).connect(tone);

  // The shimmer: one sine ring-modulated by another at an unrelated
  // frequency, so its partials belong to no scale.
  const shimmerA = context.createOscillator();
  const shimmerB = context.createOscillator();
  const ring = context.createGain();
  ring.gain.value = 0;
  shimmerA.connect(ring);
  shimmerB.connect(ring.gain);
  const shimmerLevel = context.createGain();
  shimmerLevel.gain.value = 0;
  ring.connect(shimmerLevel).connect(tone);

  // Ticks: short bursts of filtered noise.
  const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const tickSource = context.createBufferSource();
  tickSource.buffer = noise;
  tickSource.loop = true;
  const tickBand = context.createBiquadFilter();
  tickBand.type = 'bandpass';
  tickBand.frequency.value = 1800;
  tickBand.Q.value = 3;
  const tickEnvelope = context.createGain();
  tickEnvelope.gain.value = 0;
  tickSource.connect(tickBand).connect(tickEnvelope).connect(muffle);

  const sources = [
    pulseLfo,
    sweepLfo,
    carrier,
    modulator,
    sub,
    shimmerA,
    shimmerB,
    tickSource,
  ];
  for (const source of sources) source.start();

  let lastTick = -1;
  let silenced = false;

  return {
    /** Connect the voice to the rest of the sound. */
    output: master as AudioNode,
    /**
     * Follow the core. `spinAngle` is its angle, 0 to 1 revolution, so the
     * ticks can land on the tie bars.
     */
    update(p: CoreVoiceParameters, spinAngle: number) {
      if (silenced) return;
      glide(out.gain, p.gain * 0.3, 0.15);
      glide(carrier.frequency, p.pitchHz);
      glide(sub.frequency, p.pitchHz / 2);
      glide(modulator.frequency, p.pitchHz * p.fmRatio);
      glide(fmDepth.gain, p.pitchHz * p.fmRatio * p.fmIndex);
      glide(tone.frequency, p.filterHz);
      glide(shimmerA.frequency, p.shimmerHz[0]);
      glide(shimmerB.frequency, p.shimmerHz[1]);
      glide(shimmerLevel.gain, p.shimmer * 0.35, 0.3);
      // The sweep: the level dips and the filter closes once per turn.
      glide(sweepLfo.frequency, p.whooshHz, 0.3);
      glide(sweep.gain, 1 - p.whooshDepth / 2, 0.3);
      glide(sweepDepth.gain, p.whooshDepth / 2, 0.3);
      glide(filterSweep.gain, p.filterHz * 0.45 * p.whooshDepth, 0.3);
      glide(pulseLfo.frequency, p.pulseHz, 0.3);
      glide(pulse.gain, 1 - p.pulseDepth, 0.3);
      glide(pulseDepth.gain, p.pulseDepth, 0.3);
      glide(muffle.frequency, p.muffleHz, 0.25);
      // A tick each time a tie bar comes round.
      const bar = Math.floor(spinAngle * 4);
      if (p.ticksPerSecond > 0.2 && p.tickLevel > 0 && bar !== lastTick) {
        const t = now();
        tickEnvelope.gain.cancelScheduledValues(t);
        tickEnvelope.gain.setValueAtTime(p.tickLevel * 0.5, t);
        tickEnvelope.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      }
      lastTick = bar;
      first = false;
    },
    /**
     * The flux inductance catastrophe: the drone's pitch collapses like a
     * tape stopping, and the voice dies.
     */
    collapse() {
      if (silenced) return;
      silenced = true;
      const t = now();
      for (const osc of [carrier, sub, modulator, shimmerA]) {
        osc.frequency.cancelScheduledValues(t);
        osc.frequency.setValueAtTime(osc.frequency.value, t);
        osc.frequency.exponentialRampToValueAtTime(4, t + 1.8);
      }
      glide(tone.frequency, 120, 0.6);
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(Math.max(out.gain.value, 0.25), t);
      out.gain.linearRampToValueAtTime(0.3, t + 0.4);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    },
    /** Burnout: the drone cuts out under a crackle and a fizz. */
    burnout() {
      if (silenced) return;
      silenced = true;
      const t = now();
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      // A burst of crackle: noise through a bright band, gated at random.
      const crackle = context.createBufferSource();
      crackle.buffer = noise;
      const band = context.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 3200;
      band.Q.value = 0.8;
      const gate = context.createGain();
      gate.gain.value = 0;
      for (let at = 0; at < 1.4; at += 0.012 + Math.random() * 0.05)
        gate.gain.setValueAtTime(
          Math.random() < 0.55 ? (0.6 * (1.4 - at)) / 1.4 : 0,
          t + at,
        );
      gate.gain.setValueAtTime(0, t + 1.45);
      crackle.connect(band).connect(gate).connect(master);
      crackle.start(t);
      crackle.stop(t + 1.5);
    },
    /** Bring the voice back after a fault is acknowledged. */
    reset() {
      if (!silenced) return;
      silenced = false;
      const t = now();
      for (const param of [
        carrier.frequency,
        sub.frequency,
        modulator.frequency,
        shimmerA.frequency,
        out.gain,
      ]) {
        param.cancelScheduledValues(t);
        param.setValueAtTime(param.value, t);
      }
    },
    dispose() {
      for (const source of sources) source.stop();
      master.disconnect();
    },
  };
}

export type CoreVoice = ReturnType<typeof createCoreVoice>;
