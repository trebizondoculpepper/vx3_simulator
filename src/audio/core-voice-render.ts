import { createCoreVoice } from './core-voice';
import { coreVoiceParameters } from './core-voice-parameters';
import type { CoreVoiceInput } from './core-voice-parameters';

/**
 * Render the core's voice offline through set scenes, for listening to
 * without running the rig. Used by the developer room; browser only.
 */

export type CoreVoiceScene =
  'warm-up' | 'full-power' | 'flux-inductance' | 'burnout';

interface Scene {
  seconds: number;
  /** The core at time t, before spin, which follows the temperature. */
  at(t: number): Omit<CoreVoiceInput, 'spinRate'>;
  /** A catastrophe at this time, if any. */
  failAt?: { t: number; kind: 'collapse' | 'burnout' };
}

const scenes: Record<CoreVoiceScene, Scene> = {
  // Cold to full power over fourteen seconds, then a few seconds spinning.
  'warm-up': {
    seconds: 18,
    at: (t) => ({
      kelvin: 293 + (4000 - 293) * Math.min(1, (t / 14) ** 1.4),
      brightness: 0.8,
      sealed: true,
      failed: false,
    }),
  },
  'full-power': {
    seconds: 10,
    at: () => ({ kelvin: 3900, brightness: 0.8, sealed: true, failed: false }),
  },
  'flux-inductance': {
    seconds: 7,
    at: () => ({ kelvin: 3900, brightness: 0.8, sealed: true, failed: false }),
    failAt: { t: 3.5, kind: 'collapse' },
  },
  burnout: {
    seconds: 5,
    at: () => ({ kelvin: 1800, brightness: 0.8, sealed: true, failed: false }),
    failAt: { t: 2, kind: 'burnout' },
  },
};

const STEP = 0.02;

export async function renderCoreVoice(scene: CoreVoiceScene) {
  const plan = scenes[scene];
  const sampleRate = 44100;
  const context = new OfflineAudioContext(
    1,
    Math.ceil(plan.seconds * sampleRate),
    sampleRate,
  );
  const voice = createCoreVoice(context);
  voice.output.connect(context.destination);
  // The same spin law as the vessel model, so the ticks and sweep match it.
  let spinRate =
    scene === 'full-power' || scene === 'flux-inductance' ? 1.4 : 0;
  let spinAngle = 0;
  const frame = (t: number) => {
    const core = plan.at(t);
    const target = core.kelvin >= 3200 ? 1.4 : 0;
    spinRate += (target - spinRate) * Math.min(1, STEP * 0.8);
    spinAngle = (spinAngle + spinRate * STEP) % 1;
    if (plan.failAt && t >= plan.failAt.t) {
      if (plan.failAt.kind === 'collapse') voice.collapse();
      else voice.burnout();
      return;
    }
    voice.update(coreVoiceParameters({ ...core, spinRate }), spinAngle);
  };
  for (let t = STEP; t < plan.seconds - STEP; t += STEP) {
    const at = t;
    void context.suspend(at).then(() => {
      frame(at);
      void context.resume();
    });
  }
  frame(0);
  const rendered = await context.startRendering();
  return encodeWav(rendered.getChannelData(0), sampleRate);
}

/** 16-bit mono PCM WAV, normalised so the quietest scene is still audible. */
function encodeWav(samples: Float32Array, sampleRate: number) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const scale = peak > 0 ? 0.89 / peak : 1;
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) =>
    view.setInt16(
      44 + i * 2,
      Math.max(-1, Math.min(1, s * scale)) * 0x7fff,
      true,
    ),
  );
  return new Uint8Array(buffer);
}
