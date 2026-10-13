import { defaultControlRecording } from './control-sound-defaults';
import { createRecordedEffects } from './recorded-effects';

/**
 * The concept rig's mechanical sounds: recorded control clicks and Web Audio one-shots
 * for every kind of control, and the continuous sounds of the column (the
 * rams' hydraulic pump while the head moves, the purge port's hiss). Create
 * after a user gesture, on the same context as the core's voice.
 */

export type ControlSound =
  | 'button'
  | 'key'
  | 'toggle'
  | 'rocker'
  | 'key-switch'
  | 'selector'
  | 'locked'
  | 'knob'
  | 'slide'
  | 'handwheel'
  | 'isolator'
  | 'clamp'
  | 'ram-stop';

interface Click {
  /** Band of the noise burst, Hz, and how narrow it is. */
  band: number;
  q: number;
  /** Seconds for the burst to die away. */
  decay: number;
  level: number;
  /** A low thump under the click: frequency and decay, or none. */
  thump?: [number, number];
  /** Repeated clicks, as a ratchet or a run of detents: count and gap. */
  repeat?: [number, number];
  /** A slow scrape instead of a snap: noise swept over this many seconds. */
  sweep?: number;
}

/** What each kind of control sounds like. */
export const controlSounds: Record<ControlSound, Click> = {
  // A soft mushroom thump with a small switch click in it.
  button: { band: 2600, q: 2, decay: 0.03, level: 0.45, thump: [95, 0.06] },
  // A light plastic tick.
  key: { band: 3800, q: 3, decay: 0.018, level: 0.35 },
  // A hard bat-handle snap.
  toggle: { band: 4200, q: 1.5, decay: 0.025, level: 0.7, thump: [180, 0.03] },
  // A heavier clack with some body.
  rocker: { band: 2200, q: 1.2, decay: 0.04, level: 0.7, thump: [120, 0.06] },
  // A small metallic ratchet: the lock turning.
  'key-switch': {
    band: 5200,
    q: 4,
    decay: 0.012,
    level: 0.45,
    repeat: [3, 0.035],
  },
  // A detent clunk as a selector clicks over.
  selector: { band: 1600, q: 2, decay: 0.035, level: 0.6, thump: [140, 0.05] },
  // A locked selector rattling against its stop.
  locked: {
    band: 900,
    q: 3,
    decay: 0.02,
    level: 0.5,
    repeat: [2, 0.05],
    thump: [80, 0.04],
  },
  // One faint detent.
  knob: { band: 3000, q: 4, decay: 0.012, level: 0.25 },
  // A short scrape and a click.
  slide: { band: 2400, q: 1, decay: 0.03, level: 0.35, sweep: 0.06 },
  // The valve's spindle squeaking round in its gland.
  handwheel: {
    band: 1300,
    q: 8,
    decay: 0.08,
    level: 0.35,
    repeat: [5, 0.16],
    sweep: 0.12,
  },
  // A heavy industrial clunk.
  isolator: { band: 700, q: 1.2, decay: 0.09, level: 0.9, thump: [60, 0.14] },
  // A toggle clamp snapping over.
  clamp: { band: 3400, q: 2.5, decay: 0.03, level: 0.6, thump: [160, 0.04] },
  // The head arriving at its stop.
  'ram-stop': { band: 500, q: 1, decay: 0.12, level: 0.8, thump: [55, 0.2] },
};

export function createRigSounds(context: BaseAudioContext) {
  const output = context.createGain();
  const recordings = createRecordedEffects(context, output);
  void recordings
    .preload()
    .catch((error) => console.warn('Control recordings unavailable.', error));
  output.gain.value = 0.8;
  const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

  const burst = (click: Click, at: number) => {
    const source = context.createBufferSource();
    source.buffer = noise;
    source.playbackRate.value = 0.8 + Math.random() * 0.4;
    const band = context.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = click.band * (0.94 + Math.random() * 0.12);
    band.Q.value = click.q;
    const envelope = context.createGain();
    const length = (click.sweep ?? 0) + click.decay;
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(
      click.level,
      at + (click.sweep ?? 0.002),
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
    if (click.sweep)
      band.frequency.exponentialRampToValueAtTime(
        click.band * 1.6,
        at + length,
      );
    source.connect(band).connect(envelope).connect(output);
    source.start(at, Math.random() * 0.5);
    source.stop(at + length + 0.02);
    if (click.thump) {
      const [hz, decay] = click.thump;
      const thump = context.createOscillator();
      thump.frequency.setValueAtTime(hz * 1.6, at);
      thump.frequency.exponentialRampToValueAtTime(hz, at + decay);
      const gain = context.createGain();
      gain.gain.setValueAtTime(click.level * 0.8, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      thump.connect(gain).connect(output);
      thump.start(at);
      thump.stop(at + decay + 0.02);
    }
  };

  // The rams' hydraulic pump: a buzzing motor and a whine that rises as it
  // works, heard only while the head moves.
  const pump = context.createOscillator();
  pump.type = 'sawtooth';
  pump.frequency.value = 98;
  const whine = context.createOscillator();
  whine.frequency.value = 620;
  const pumpFilter = context.createBiquadFilter();
  pumpFilter.type = 'lowpass';
  pumpFilter.frequency.value = 900;
  const pumpLevel = context.createGain();
  pumpLevel.gain.value = 0;
  const whineLevel = context.createGain();
  whineLevel.gain.value = 0.08;
  pump.connect(pumpFilter);
  whine.connect(whineLevel).connect(pumpFilter);
  pumpFilter.connect(pumpLevel).connect(output);

  // The purge port's hiss: noise through a bright band, with a little
  // flutter, following the vent's strength.
  const hissSource = context.createBufferSource();
  hissSource.buffer = noise;
  hissSource.loop = true;
  const hissBand = context.createBiquadFilter();
  hissBand.type = 'bandpass';
  hissBand.frequency.value = 3200;
  hissBand.Q.value = 0.6;
  const hissLevel = context.createGain();
  hissLevel.gain.value = 0;
  hissSource.connect(hissBand).connect(hissLevel).connect(output);

  for (const source of [pump, whine, hissSource]) source.start();

  return {
    output: output as AudioNode,
    /** One control's sound, now. */
    play(kind: ControlSound) {
      const recording = defaultControlRecording(kind);
      if (recording) {
        void recordings.play(recording, 1, 0);
        return;
      }
      const click = controlSounds[kind];
      const at = context.currentTime + 0.005;
      const [count, gap] = click.repeat ?? [1, 0];
      for (let i = 0; i < count; i++)
        burst(
          { ...click, level: click.level * (1 - i * 0.12) },
          at + i * gap * (0.85 + Math.random() * 0.3),
        );
    },
    /**
     * The column's continuous sounds: whether the rams are moving (and
     * which way), and how hard the purge port is venting, 0 to 1.
     */
    update({ rams, venting }: { rams: -1 | 0 | 1; venting: number }) {
      const t = context.currentTime;
      pumpLevel.gain.setTargetAtTime(rams ? 0.18 : 0, t, 0.08);
      // The pump labours lifting and eases lowering.
      pump.frequency.setTargetAtTime(rams > 0 ? 104 : 92, t, 0.2);
      whine.frequency.setTargetAtTime(rams > 0 ? 680 : 560, t, 0.3);
      hissLevel.gain.setTargetAtTime(venting * 0.35, t, 0.12);
      hissBand.frequency.setTargetAtTime(2400 + venting * 1600, t, 0.2);
    },
    dispose() {
      recordings.dispose();
      for (const source of [pump, whine, hissSource]) source.stop();
      output.disconnect();
    },
  };
}

export type RigSounds = ReturnType<typeof createRigSounds>;
