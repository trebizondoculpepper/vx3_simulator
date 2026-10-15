import tapeManifest from '../../public/music/manifest.json';
import { createTapeMusic } from './tape-music';
import type { RackControls } from '../game/rack-controls';
import type { RigState } from '../game/rig';
import { writeSoundParameters } from './sound-parameters';
import type { SoundParameters } from './sound-parameters';
import { renderFireAlarm } from './fire-alarm';
import { createFireAnnouncements } from './fire-announcements';
import { createSpatialMix } from './spatial-mix';
import type { Emitter, SpatialMix, SpatialOptions } from './spatial-mix';
import type { ZZFXSound } from 'zzfx';
import { createRecordedEffects, isRecordedCue } from './recorded-effects';
import type { RecordedCue } from './recorded-effects';
import { createCoreVoice } from './core-voice';
import { coreVoiceParameters } from './core-voice-parameters';
import { createRigSounds } from './rig-sounds';
import { chamberPressure, isSealed } from '../game/column-prep';
import type { ColumnPrepState } from '../game/column-prep';

export type SoundCue =
  | 'toggle-up'
  | 'toggle-down'
  | 'knob'
  | 'selector'
  | 'button'
  | 'key'
  | 'rocker'
  | 'bakelite-switch'
  | 'ballast-start'
  | 'fire-call'
  | 'breaker-on'
  | 'breaker-off'
  | 'relay'
  | 'field-locked'
  | 'warning'
  | 'incident'
  | 'spark'
  | 'counter'
  | 'paper'
  | 'pencil'
  | 'purge'
  | 'drip'
  | 'printer'
  | 'door-open'
  | 'door-close';

type SoundBank = Record<
  Exclude<SoundCue, RecordedCue>,
  Pick<ZZFXSound, 'play'>
>;

/** Places in the rack that sounds come from, positioned by the scene. */
export type SoundSource =
  | 'museum'
  | 'supply'
  /** The foot of the VX3's grey cabinet A, by its A11 supply. */
  | 'cabinet-a'
  /** The foot of its olive cabinet B, by its B13 supply. */
  | 'cabinet-b'
  | 'valves'
  | 'spindle'
  | 'field'
  | 'monitor'
  | 'service'
  | 'printer'
  | 'computer'
  | 'cassette'
  | 'sink'
  | 'sprinkler'
  | 'sounder'
  | 'pa'
  | 'rectifier'
  | 'recirculator';

export type CassetteButton = 'play' | 'stop' | 'fast-forward';

const cassetteAssetUrls: Record<CassetteButton, URL> = {
  play: new URL('./assets/cassette-play.mp3', import.meta.url),
  stop: new URL('./assets/cassette-stop.mp3', import.meta.url),
  'fast-forward': new URL(
    './assets/cassette-fast-forward.mp3',
    import.meta.url,
  ),
};

/** How loud a powered cabinet's fan is, beside it. */
const CABINET_HUM = 0.003;

interface CabinetFan {
  /** Seconds (time constant) to wind up to speed, and to run down. */
  spinUp: number;
  spinDown: number;
  /** Where the rush of air through the grille is loudest, Hz. */
  airHz: number;
  /** The motor's rumble, below this, Hz. */
  rumbleHz: number;
  /** The blades passing: blades × revolutions per second, Hz. */
  bladeHz: number;
  /** How often the blade tone swells, Hz. */
  wobbleHz: number;
  /** The noise's playback rate, so the two fans' air never matches. */
  rate: number;
}

/** A cabinet's sound: its hum's power, its fan's speed, what the speed bends. */
interface CabinetSound {
  power: GainNode;
  spin: GainNode;
  pitched: { param: AudioParam; full: number }[];
  /** Whether it was last told it has power, once it has been told. */
  on: boolean | null;
}

/**
 * The beep each cabinet's electronics give as they come on: a pair of
 * notes, Hz, each this many seconds long, and how loud beside it.
 */
const CABINET_BEEPS: Record<
  'a' | 'b',
  { notes: number[]; length: number; gap: number; wave: OscillatorType }
> = {
  // Cabinet A: two short high pips.
  a: { notes: [1760, 1760], length: 0.07, gap: 0.09, wave: 'square' },
  // Cabinet B: a lower chirp, falling.
  b: { notes: [988, 740], length: 0.11, gap: 0.02, wave: 'triangle' },
};
const CABINET_BEEP_LEVEL = 0.05;

/** The share of full pitch a stopped fan's sound is bent down to. */
const FAN_STANDSTILL = 0.2;

/** Cabinet A's fan is smaller and faster; B's is bigger and lower. */
const CABINET_FANS: Record<'a' | 'b', CabinetFan> = {
  a: {
    airHz: 1150,
    rumbleHz: 240,
    bladeHz: 147,
    wobbleHz: 0.31,
    rate: 1.04,
    spinUp: 2.6,
    spinDown: 4,
  },
  b: {
    airHz: 760,
    rumbleHz: 180,
    bladeHz: 118,
    wobbleHz: 0.23,
    rate: 0.93,
    spinUp: 3.8,
    spinDown: 5.5,
  },
};

type Channel =
  | 'humA'
  | 'humB'
  | 'heater'
  | 'spindle'
  | 'field'
  | 'strain'
  | 'rectifier'
  | 'sprinkler'
  | 'alarm'
  | 'recirculator';

const channelSources: Record<Channel, SoundSource> = {
  humA: 'cabinet-a',
  humB: 'cabinet-b',
  heater: 'valves',
  spindle: 'spindle',
  field: 'field',
  strain: 'monitor',
  rectifier: 'rectifier',
  sprinkler: 'sprinkler',
  alarm: 'sounder',
  recirculator: 'recirculator',
};

// Cues from the apparatus itself. Control clicks and the logbook are at
// the operator's fingertips, so they are never attenuated.
const cueSources: Partial<Record<SoundCue, SoundSource>> = {
  'breaker-on': 'supply',
  'breaker-off': 'supply',
  relay: 'valves',
  'field-locked': 'field',
  warning: 'field',
  incident: 'field',
  spark: 'service',
  purge: 'service',
  drip: 'sink',
  printer: 'printer',
  counter: 'monitor',
};

interface AudioGraph {
  context: AudioContext;
  master: GainNode;
  room: GainNode;
  humA: GainNode;
  humB: GainNode;
  cabinets: Record<'a' | 'b', CabinetSound>;
  heater: GainNode;
  spindle: GainNode;
  field: GainNode;
  strain: GainNode;
  rectifier: GainNode;
  sprinkler: GainNode;
  alarm: GainNode;
  recirculator: GainNode;
  fluorescent: GainNode;
  panners: Record<Channel, StereoPannerNode>;
  spindleTone: OscillatorNode;
  rotorPulse: OscillatorNode;
  bearingFilter: BiquadFilterNode;
  fieldA: OscillatorNode;
  fieldB: OscillatorNode;
  strainTone: OscillatorNode;
  sources: Array<OscillatorNode | AudioBufferSourceNode>;
  sounds: SoundBank;
  recordings: ReturnType<typeof createRecordedEffects>;
  columnVoice: ReturnType<typeof createCoreVoice>;
  columnMechanics: ReturnType<typeof createRigSounds>;
  columnGain: GainNode;
  columnPan: StereoPannerNode;
  setOneShotVolume: (volume: number) => void;
}

const parameters: SoundParameters = {
  roomGain: 0,
  heaterGain: 0,
  spindleGain: 0,
  spindleHz: 0,
  rotorHz: 0,
  fieldGain: 0,
  fieldHz: 0,
  fieldBeatHz: 0,
  strainGain: 0,
  strainHz: 0,
  counterClicksPerSecond: 0,
  sparkCracksPerSecond: 0,
};

function ramp(parameter: AudioParam, target: number, now: number) {
  parameter.setTargetAtTime(target, now, 0.07);
}

function createGraph(library: typeof import('zzfx')): AudioGraph {
  const context = library.ZZFX.audioContext;
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);
  const panners = {} as Record<Channel, StereoPannerNode>;
  const gain = (pan: number, channel?: Channel) => {
    const node = context.createGain();
    node.gain.value = 0;
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    node.connect(panner).connect(master);
    if (channel) panners[channel] = panner;
    return node;
  };
  const room = gain(-0.05);
  // Each cabinet's supply transformer hums at the mains frequency.
  const humA = gain(-0.1, 'humA');
  const humB = gain(0.1, 'humB');
  const heater = gain(-0.2, 'heater');
  const spindle = gain(-0.25, 'spindle');
  const field = gain(0.2, 'field');
  const strain = gain(0.15, 'strain');
  const rectifier = gain(0, 'rectifier');
  const sprinkler = gain(0, 'sprinkler');
  const alarm = gain(0, 'alarm');
  // The fire alarm's sounders, rendered once and looped (fire-alarm.ts).
  const alarmSamples = renderFireAlarm(context.sampleRate);
  const alarmBuffer = context.createBuffer(
    1,
    alarmSamples.length,
    context.sampleRate,
  );
  alarmBuffer.getChannelData(0).set(alarmSamples);
  const recirculator = gain(0, 'recirculator');
  const fluorescent = gain(0);
  const sources: Array<OscillatorNode | AudioBufferSourceNode> = [];
  const oscillator = (
    type: OscillatorType,
    hz: number,
    destination: AudioNode,
    level = 1,
  ) => {
    const node = context.createOscillator();
    node.type = type;
    node.frequency.value = hz;
    const branch = context.createGain();
    branch.gain.value = level;
    node.connect(branch).connect(destination);
    node.start();
    sources.push(node);
    return node;
  };
  oscillator('sine', 72, recirculator, 0.6);
  oscillator('sine', 144, recirculator, 0.12);
  // Each cabinet: its supply transformer's faint hum, on the moment it
  // has power, and its cooling fan, which spins up over a few seconds
  // (and runs down when switched off), rising in pitch and level.
  const cabinets = {} as Record<'a' | 'b', CabinetSound>;
  for (const [id, destination] of [
    ['a', humA],
    ['b', humB],
  ] as const) {
    const power = context.createGain();
    power.gain.value = 0;
    power.connect(destination);
    oscillator('sine', 50, power, 0.12);
    oscillator('sine', 100, power, 0.04);
    const spin = context.createGain();
    spin.gain.value = 0;
    spin.connect(destination);
    cabinets[id] = { power, spin, pitched: [], on: null };
  }
  oscillator('sawtooth', 100, rectifier, 0.6);
  oscillator('square', 50, rectifier, 0.22);
  oscillator('sawtooth', 301, rectifier, 0.08);
  const spindleTone = oscillator('sawtooth', 65, spindle, 0.33);
  oscillator('sine', 32, spindle, 0.55);
  const rotorPulse = context.createOscillator();
  rotorPulse.type = 'triangle';
  rotorPulse.frequency.value = 6;
  const rotorDepth = context.createGain();
  rotorDepth.gain.value = 0.2;
  rotorPulse.connect(rotorDepth);
  rotorPulse.start();
  sources.push(rotorPulse);
  const fieldA = oscillator('sine', 48, field, 0.65);
  const fieldB = oscillator('sine', 48.15, field, 0.42);
  const strainTone = oscillator('sine', 500, strain, 1);

  const noiseBuffer = context.createBuffer(
    1,
    context.sampleRate * 2,
    context.sampleRate,
  );
  const samples = noiseBuffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const noise = context.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;
  const roomFilter = context.createBiquadFilter();
  roomFilter.type = 'lowpass';
  roomFilter.frequency.value = 420;
  const heaterFilter = context.createBiquadFilter();
  heaterFilter.type = 'highpass';
  heaterFilter.frequency.value = 1400;
  const fanFilter = context.createBiquadFilter();
  fanFilter.type = 'lowpass';
  fanFilter.frequency.value = 750;
  noise.connect(fanFilter).connect(recirculator);
  // Each cabinet's cooling fan: air rushing through its grille, the
  // motor's rumble, and the tone of its blades passing, which wobbles a
  // little. Two fans of different makes, so each cabinet has its own
  // pitch and the pair beat slowly against each other.
  const fans: [CabinetSound, CabinetFan, number][] = [
    [cabinets.a, CABINET_FANS.a, 0.11],
    [cabinets.b, CABINET_FANS.b, 0.53],
  ];
  for (const [cabinet, fan, offset] of fans) {
    const destination = cabinet.spin;
    const air = context.createBufferSource();
    air.buffer = noiseBuffer;
    air.loop = true;
    air.playbackRate.value = fan.rate;
    const grille = context.createBiquadFilter();
    grille.type = 'bandpass';
    grille.frequency.value = fan.airHz;
    grille.Q.value = 0.8;
    const airLevel = context.createGain();
    airLevel.gain.value = 1.4;
    air.connect(grille).connect(airLevel).connect(destination);
    const motor = context.createBiquadFilter();
    motor.type = 'lowpass';
    motor.frequency.value = fan.rumbleHz;
    const motorLevel = context.createGain();
    motorLevel.gain.value = 0.9;
    air.connect(motor).connect(motorLevel).connect(destination);
    air.start(0, offset * noiseBuffer.duration);
    sources.push(air);
    cabinet.pitched.push(
      { param: air.playbackRate, full: fan.rate },
      { param: grille.frequency, full: fan.airHz },
      { param: motor.frequency, full: fan.rumbleHz },
    );
    const blades = context.createGain();
    blades.gain.value = 0.16;
    blades.connect(destination);
    const tone = context.createOscillator();
    tone.type = 'triangle';
    tone.frequency.value = fan.bladeHz;
    tone.connect(blades);
    tone.start();
    sources.push(tone);
    cabinet.pitched.push({ param: tone.frequency, full: fan.bladeHz });
    for (const { param, full } of cabinet.pitched)
      param.value = full * FAN_STANDSTILL;
    // The blade tone swells and fades as the bearing settles.
    const wobble = context.createOscillator();
    wobble.frequency.value = fan.wobbleHz;
    const depth = context.createGain();
    depth.gain.value = 0.06;
    wobble.connect(depth).connect(blades.gain);
    wobble.start();
    sources.push(wobble);
  }
  const alarmLoop = context.createBufferSource();
  alarmLoop.buffer = alarmBuffer;
  alarmLoop.loop = true;
  alarmLoop.connect(alarm);
  alarmLoop.start();
  sources.push(alarmLoop);
  noise.connect(roomFilter).connect(room);
  noise.connect(heaterFilter).connect(heater);
  const bearingFilter = context.createBiquadFilter();
  bearingFilter.type = 'bandpass';
  bearingFilter.frequency.value = 650;
  bearingFilter.Q.value = 0.8;
  const bearingPulse = context.createGain();
  bearingPulse.gain.value = 0.3;
  rotorDepth.connect(bearingPulse.gain);
  noise.connect(bearingFilter).connect(bearingPulse).connect(spindle);
  // Water rushing through the heads, with a lower splatter layer. Both
  // branches share the existing seamless noise source and follow room audio.
  const sprayHigh = context.createBiquadFilter();
  sprayHigh.type = 'highpass';
  sprayHigh.frequency.value = 650;
  const sprayLow = context.createBiquadFilter();
  sprayLow.type = 'lowpass';
  sprayLow.frequency.value = 4300;
  const sprayHiss = context.createGain();
  sprayHiss.gain.value = 0.68;
  noise
    .connect(sprayHigh)
    .connect(sprayLow)
    .connect(sprayHiss)
    .connect(sprinkler);
  const splashLow = context.createBiquadFilter();
  splashLow.type = 'lowpass';
  splashLow.frequency.value = 900;
  const splashGain = context.createGain();
  splashGain.gain.value = 0.25;
  noise.connect(splashLow).connect(splashGain).connect(sprinkler);
  noise.start();
  sources.push(noise);

  // ZzFX parameter order: volume, variation, Hz, attack, sustain, release, shape, curve, slide, ...
  const sounds: SoundBank = {
    drip: new library.ZZFXSound([
      0.045, 0.015, 1250, 0, 0.025, 0.11, 0, 1.5, -650, 0, 0, 0, 0, 0.15,
    ]),
    // Mechanical buttons use a recorded press; purge remains procedural.
    'fire-call': new library.ZZFXSound([
      0.46, 0.025, 370, 0, 0.018, 0.11, 4, 1.2, -260, 0, 0, 0, 0.045,
    ]),
    purge: new library.ZZFXSound([
      0.16, 0.06, 480, 0.02, 0.17, 0.14, 4, 1, -180, 0, 0, 0, 0.72,
    ]),
    // Relay chatter remains a machine sound.
    relay: new library.ZZFXSound([
      0.22, 0.05, 310, 0, 0.045, 0.08, 4, 1, -230, 0, 0, 0, 0.035,
    ]),
    // Two close tones from inside the field chassis; a sick relay buzz at warning.
    'field-locked': new library.ZZFXSound([
      0.16, 0.01, 620, 0.01, 0.11, 0.19, 0, 1, 85, 0, 150, 0.09,
    ]),
    warning: new library.ZZFXSound([
      0.16, 0.03, 245, 0.01, 0.13, 0.18, 2, 1, -18, 0, 0, 0, 0.035,
    ]),
    // Muffled rack thump, irregular gap crack and Geiger tick.
    incident: new library.ZZFXSound([
      0.48, 0.09, 92, 0, 0.12, 0.38, 4, 1, -60, 0, 0, 0, 0, 0.34,
    ]),
    spark: new library.ZZFXSound([
      0.25, 0.15, 800, 0, 0.012, 0.055, 4, 1, -380, 0, 0, 0, 0, 0.68,
    ]),
    counter: new library.ZZFXSound([
      0.14, 0.08, 950, 0, 0.004, 0.018, 4, 1, -500,
    ]),
    // Notebook paper and pencil; intentionally quiet in the room mix.
    paper: new library.ZZFXSound([
      0.15, 0.06, 360, 0.025, 0.07, 0.14, 4, 1, -130, 0, 0, 0, 0, 0.56,
    ]),
    pencil: new library.ZZFXSound([
      0.08, 0.06, 600, 0, 0.035, 0.065, 4, 1, -250, 0, 0, 0, 0, 0.7,
    ]),
  };
  const recordings = createRecordedEffects(context, master);
  const columnVoice = createCoreVoice(context);
  const columnMechanics = createRigSounds(context);
  const columnGain = context.createGain();
  const columnPan = context.createStereoPanner();
  columnGain.gain.value = 0;
  columnVoice.output.connect(columnGain);
  columnMechanics.output.connect(columnGain);
  columnGain.connect(columnPan).connect(master);
  return {
    context,
    master,
    room,
    humA,
    humB,
    cabinets,
    heater,
    spindle,
    field,
    strain,
    rectifier,
    sprinkler,
    alarm,
    recirculator,
    fluorescent,
    panners,
    spindleTone,
    rotorPulse,
    bearingFilter,
    fieldA,
    fieldB,
    strainTone,
    sources,
    sounds,
    recordings,
    columnVoice,
    columnMechanics,
    columnGain,
    columnPan,
    setOneShotVolume: (volume) => {
      library.ZZFX.volume = volume;
    },
  };
}

export function createSoundEngine() {
  let tapeMusic: ReturnType<typeof createTapeMusic> | null = null;
  let announcements: ReturnType<typeof createFireAnnouncements> | null = null;
  let tapeRequest = 0;
  let bootBuffer: Promise<AudioBuffer> | null = null;
  let bootSource: AudioBufferSourceNode | null = null;
  let bootRequest = 0;
  const cassetteBuffers: Partial<Record<CassetteButton, Promise<AudioBuffer>>> =
    {};
  let cassetteSource: AudioBufferSourceNode | null = null;
  let cassetteRequest = 0;
  let plantPowered = false;
  let sprinklersActive = false;
  let fireAlarmActive = false;
  let pendingAllClear = false;
  let paGain: GainNode | null = null;
  let paPan: StereoPannerNode | null = null;
  let paWall: BiquadFilterNode | null = null;
  let recirculatorWorking = false;
  const cabinetPower = { a: false, b: false };
  let graph: AudioGraph | null = null;
  let loading: Promise<void> | null = null;
  let disposed = false;
  let visible = true;
  let volume = 0.55;
  let muted = false;
  let nextCounter = 0;
  let nextSpark = 0;
  const pending: Array<[SoundCue, SoundSource | undefined]> = [];
  let spatial: SpatialMix | null = null;
  let panned = false;
  // How much of each source gets through the doors to the listener's room.
  const transmitted = new Map<SoundSource, number>();
  const distanceGain = (source: SoundSource | undefined) =>
    spatial && source
      ? spatial.gain(source) * (transmitted.get(source) ?? 1)
      : 1;

  /** A cabinet's power-on beep, from where it stands. */
  const beep = (id: 'a' | 'b') => {
    if (!graph || muted) return;
    const { context, master } = graph;
    const source = id === 'a' ? 'cabinet-a' : 'cabinet-b';
    const level = CABINET_BEEP_LEVEL * distanceGain(source);
    if (level <= 0) return;
    const { notes, length, gap, wave } = CABINET_BEEPS[id];
    const pan = context.createStereoPanner();
    pan.pan.value = spatial?.pan(source) ?? 0;
    pan.connect(master);
    let at = context.currentTime + 0.02;
    for (const hz of notes) {
      const note = context.createOscillator();
      note.type = wave;
      note.frequency.value = hz;
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(level, at + 0.005);
      envelope.gain.setValueAtTime(level, at + length - 0.015);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
      note.connect(envelope).connect(pan);
      note.start(at);
      note.stop(at + length + 0.02);
      at += length + gap;
    }
  };
  const setMix = (nextVolume: number, nextMuted: boolean) => {
    volume = Math.max(0, Math.min(1, nextVolume));
    muted = nextMuted;
    if (!graph) return;
    const level = muted ? 0 : volume;
    graph.master.gain.setTargetAtTime(level, graph.context.currentTime, 0.03);
    graph.setOneShotVolume(level * 0.16);
  };
  /** `at` places the sound somewhere other than its usual source. */
  const playNow = (cue: SoundCue, at?: SoundSource) => {
    if (!graph || muted || !visible || graph.context.state !== 'running')
      return;
    const source = at ?? cueSources[cue];
    if (isRecordedCue(cue)) {
      void graph.recordings.play(
        cue,
        distanceGain(source),
        source && spatial ? spatial.pan(source) : 0,
      );
      return;
    }
    if (spatial && source) {
      const gain = distanceGain(source);
      if (gain > 0) graph.sounds[cue].play(gain, 1, 1, spatial.pan(source));
      return;
    }
    const pan =
      cue === 'paper' || cue === 'pencil' ? 0.4 : cue === 'spark' ? -0.35 : 0;
    graph.sounds[cue].play(1, 1, 1, pan);
  };
  const unlock = (): Promise<void> => {
    if (disposed || !visible) return Promise.resolve();
    if (loading) return loading;
    loading = (async () => {
      if (!graph) {
        graph = createGraph(await import('zzfx'));
        const current = graph;
        paGain = current.context.createGain();
        paGain.gain.value = 0;
        paPan = current.context.createStereoPanner();
        paWall = current.context.createBiquadFilter();
        paWall.type = 'lowpass';
        paWall.frequency.value = 3400;
        paGain.connect(paWall).connect(paPan).connect(current.master);
        announcements = createFireAnnouncements(current.context, paGain);
        void announcements
          .preload()
          .catch((error) => console.warn('Fire PA could not preload.', error));
        if (pendingAllClear) {
          pendingAllClear = false;
          announcements.cancel();
        } else announcements.setAlarm(fireAlarmActive);
        void graph.recordings
          .preload()
          .catch((error) =>
            console.warn('Sound recordings could not preload.', error),
          );
        void fetch(
          new URL('./assets/fluorescent-room-tone.wav', import.meta.url),
        )
          .then((response) => {
            if (!response.ok)
              throw new Error('Fluorescent room tone unavailable');
            return response.arrayBuffer();
          })
          .then((bytes) => current.context.decodeAudioData(bytes))
          .then((buffer) => {
            if (disposed) return;
            const source = current.context.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(current.fluorescent);
            source.start();
            current.sources.push(source);
          })
          .catch((error) =>
            console.warn('Fluorescent ambience unavailable.', error),
          );
      }
      setMix(volume, muted);
      if (graph.context.state === 'suspended') await graph.context.resume();
      while (pending.length) playNow(...pending.shift()!);
    })()
      .catch((error: unknown) => {
        console.warn('VX3 audio could not start.', error);
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  };
  const play = (cue: SoundCue, at?: SoundSource) => {
    // Ambient sounds must not accumulate before the first audio gesture.
    if (
      (cue === 'drip' || cue === 'printer') &&
      graph?.context.state !== 'running'
    )
      return;
    if (muted || disposed || !visible) return;
    if (graph?.context.state === 'running') playNow(cue, at);
    else {
      pending.push([cue, at]);
      void unlock();
    }
  };
  /** The reference video's 3–5 second BBC startup, played at the computer. */
  const playComputerBoot = async () => {
    const request = ++bootRequest;
    bootSource?.stop();
    bootSource = null;
    if (muted || disposed || !visible) return;
    await unlock();
    if (!graph || graph.context.state !== 'running') return;
    const current = graph;
    if (!bootBuffer)
      bootBuffer = fetch(
        new URL('./assets/bbc-model-b-boot.wav', import.meta.url),
      )
        .then((response) => {
          if (!response.ok) throw new Error('BBC boot sound unavailable');
          return response.arrayBuffer();
        })
        .then((bytes) => current.context.decodeAudioData(bytes));
    try {
      const buffer = await bootBuffer;
      if (request !== bootRequest || muted || disposed || !visible) return;
      const source = current.context.createBufferSource();
      const gain = current.context.createGain();
      const pan = current.context.createStereoPanner();
      source.buffer = buffer;
      gain.gain.value = 0.22 * distanceGain('computer');
      pan.pan.value = spatial?.pan('computer') ?? 0;
      source.connect(gain).connect(pan).connect(current.master);
      bootSource = source;
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        pan.disconnect();
        if (bootSource === source) bootSource = null;
      };
      source.start();
    } catch (error) {
      bootBuffer = null;
      console.warn('BBC boot sound could not play.', error);
    }
  };
  /** Short CC0 recordings of a real cassette transport, played at the bench. */
  const playCassetteButton = async (button: CassetteButton) => {
    const request = ++cassetteRequest;
    cassetteSource?.stop();
    cassetteSource = null;
    if (muted || disposed || !visible) return;
    await unlock();
    if (!graph || graph.context.state !== 'running') return;
    const current = graph;
    cassetteBuffers[button] ??= fetch(cassetteAssetUrls[button])
      .then((response) => {
        if (!response.ok) throw new Error('Cassette sound unavailable');
        return response.arrayBuffer();
      })
      .then((bytes) => current.context.decodeAudioData(bytes));
    try {
      const buffer = await cassetteBuffers[button];
      if (request !== cassetteRequest || muted || disposed || !visible) return;
      const source = current.context.createBufferSource();
      const gain = current.context.createGain();
      const pan = current.context.createStereoPanner();
      source.buffer = buffer;
      gain.gain.value = 0.6 * distanceGain('cassette');
      pan.pan.value = spatial?.pan('cassette') ?? 0;
      source.connect(gain).connect(pan).connect(current.master);
      cassetteSource = source;
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        pan.disconnect();
        if (cassetteSource === source) cassetteSource = null;
      };
      source.start();
    } catch (error) {
      delete cassetteBuffers[button];
      console.warn('Cassette transport sound could not play.', error);
    }
  };
  let columnMoving = false;
  let columnClamped: boolean | undefined;
  let columnFailure: ColumnPrepState['failure'] | undefined;
  const updateColumn = (state: ColumnPrepState) => {
    if (!graph || !visible || graph.context.state !== 'running') return;
    const moving = !state.clamped && state.lift !== state.liftTarget;
    if (columnMoving && !moving) graph.columnMechanics.play('ram-stop');
    if (columnClamped !== undefined && state.clamped !== columnClamped)
      graph.columnMechanics.play('clamp');
    columnMoving = moving;
    columnClamped = state.clamped;
    graph.columnMechanics.update({
      rams: moving ? (state.liftTarget > state.lift ? 1 : -1) : 0,
      venting:
        isSealed(state) && state.outletOpen
          ? Math.min(1, chamberPressure(state))
          : 0,
    });
    if (columnFailure !== undefined && state.failure !== columnFailure) {
      if (state.failure === 'flux-inductance') graph.columnVoice.collapse();
      else if (state.failure === 'burnout') graph.columnVoice.burnout();
      else graph.columnVoice.reset();
    }
    columnFailure = state.failure;
    graph.columnVoice.update(
      coreVoiceParameters({
        kelvin: state.temperature,
        brightness: state.brightness,
        spinRate: state.spinRate,
        sealed: state.lift < 0.03,
        failed: state.failure !== null,
      }),
      state.spinAngle,
    );
    const now = graph.context.currentTime;
    graph.columnGain.gain.setTargetAtTime(
      0.3 * distanceGain('spindle'),
      now,
      0.05,
    );
    graph.columnPan.pan.setTargetAtTime(
      spatial?.pan('spindle') ?? 0,
      now,
      0.05,
    );
  };
  const setTapeTransport = async (mode: CassetteButton) => {
    const ownRequest = ++tapeRequest;
    if (mode === 'stop') {
      tapeMusic?.press('stop');
      return;
    }
    await unlock();
    if (!graph || disposed || ownRequest !== tapeRequest) return;
    tapeMusic ??= createTapeMusic(
      graph.context,
      graph.master,
      tapeManifest.tracks,
      () => ({
        gain: distanceGain('cassette'),
        pan: spatial?.pan('cassette') ?? 0,
      }),
    );
    tapeMusic.press(mode);
  };
  const update = (
    state: RigState,
    controls: RackControls,
    reducedMotion: boolean,
  ) => {
    if (!graph || !visible) return;
    tapeMusic?.update();
    announcements?.update();
    const { context } = graph;
    writeSoundParameters(state, controls, parameters);
    const now = context.currentTime;
    if (paGain && paPan && paWall) {
      ramp(paGain.gain, 1.2 * distanceGain('pa'), now);
      ramp(paPan.pan, spatial?.pan('pa') ?? 0, now);
      const throughDoor = transmitted.get('pa') ?? 1;
      ramp(paWall.frequency, 1500 + throughDoor * 1900, now);
    }
    ramp(graph.room.gain, parameters.roomGain, now);
    ramp(
      graph.recirculator.gain,
      recirculatorWorking ? 0.06 * distanceGain('recirculator') : 0,
      now,
    );
    ramp(
      graph.rectifier.gain,
      plantPowered ? 0.22 * distanceGain('rectifier') : 0,
      now,
    );
    ramp(
      graph.sprinkler.gain,
      sprinklersActive ? 0.32 * distanceGain('sprinkler') : 0,
      now,
    );
    ramp(
      graph.alarm.gain,
      fireAlarmActive
        ? (announcements?.speaking ? 0.045 : 0.3) * distanceGain('sounder')
        : 0,
      now,
    );
    ramp(graph.humA.gain, CABINET_HUM * distanceGain('cabinet-a'), now);
    ramp(graph.humB.gain, CABINET_HUM * distanceGain('cabinet-b'), now);
    for (const id of ['a', 'b'] as const) {
      const cabinet = graph.cabinets[id];
      const on = cabinetPower[id];
      if (cabinet.on === on) continue;
      // Switched on, it beeps; already on when the sound started, it
      // just spins up.
      if (on && cabinet.on === false) beep(id);
      cabinet.on = on;
      // The hum is there at once; the fan winds up, or runs down.
      const fan = CABINET_FANS[id];
      const constant = on ? fan.spinUp : fan.spinDown;
      cabinet.power.gain.setTargetAtTime(on ? 1 : 0, now, 0.05);
      cabinet.spin.gain.setTargetAtTime(on ? 1 : 0, now, constant);
      for (const { param, full } of cabinet.pitched)
        param.setTargetAtTime(
          full * (on ? 1 : FAN_STANDSTILL),
          now,
          constant * 1.3,
        );
    }
    ramp(
      graph.heater.gain,
      parameters.heaterGain * distanceGain('valves'),
      now,
    );
    ramp(
      graph.spindle.gain,
      parameters.spindleGain * distanceGain('spindle'),
      now,
    );
    ramp(graph.field.gain, parameters.fieldGain * distanceGain('field'), now);
    ramp(
      graph.strain.gain,
      parameters.strainGain * distanceGain('monitor'),
      now,
    );
    if (spatial && !panned) {
      for (const [channel, source] of Object.entries(channelSources))
        ramp(graph.panners[channel as Channel].pan, spatial.pan(source), now);
      panned = true;
    }
    ramp(graph.spindleTone.frequency, parameters.spindleHz, now);
    ramp(graph.rotorPulse.frequency, parameters.rotorHz, now);
    ramp(graph.bearingFilter.frequency, 500 + state.spindle * 900, now);
    const wobble = reducedMotion
      ? 0
      : Math.sin(now * (2 + state.instability * 5)) * state.instability * 2.5;
    ramp(graph.fieldA.frequency, parameters.fieldHz + wobble, now);
    ramp(
      graph.fieldB.frequency,
      parameters.fieldHz +
        (reducedMotion ? 0.15 : parameters.fieldBeatHz) -
        wobble,
      now,
    );
    ramp(graph.strainTone.frequency, parameters.strainHz, now);
    if (parameters.counterClicksPerSecond > 0 && now >= nextCounter) {
      playNow('counter');
      nextCounter =
        now -
        Math.log(Math.max(0.001, Math.random())) /
          parameters.counterClicksPerSecond;
    }
    if (parameters.sparkCracksPerSecond > 0 && now >= nextSpark) {
      playNow('spark');
      nextSpark =
        now -
        Math.log(Math.max(0.001, Math.random())) /
          parameters.sparkCracksPerSecond;
    }
    if (!parameters.counterClicksPerSecond) nextCounter = now;
    if (!parameters.sparkCracksPerSecond) nextSpark = now;
  };
  /** Tell the engine where each source is in the world. */
  const setSources = (
    sources: ReadonlyArray<Emitter & { id: SoundSource }>,
    options: SpatialOptions,
  ) => {
    spatial = createSpatialMix(sources, options);
  };
  /**
   * Place the listener each frame. Distances are only recalculated after
   * a real move, and pans only after a turn; otherwise this does nothing.
   */
  /**
   * Set the share of a source that reaches the listener's room through the
   * doors in between: 1 in the same room, 0 behind a shut door.
   */
  const setTransmission = (source: SoundSource, share: number) => {
    transmitted.set(source, share);
  };
  const listen = (x: number, y: number, z: number, yaw: number) => {
    if (!spatial) return;
    const moved = spatial.move(x, y, z);
    if (spatial.face(yaw) || moved) panned = false;
  };
  const setVisible = (nextVisible: boolean) => {
    visible = nextVisible;
    if (!graph) return;
    if (visible) void unlock();
    else void graph.context.suspend();
  };
  const dispose = () => {
    disposed = true;
    tapeRequest++;
    tapeMusic?.dispose();
    announcements?.dispose();
    paGain?.disconnect();
    paWall?.disconnect();
    paPan?.disconnect();
    bootRequest++;
    bootSource?.stop();
    cassetteRequest++;
    cassetteSource?.stop();
    pending.length = 0;
    if (!graph) return;
    graph.master.gain.value = 0;
    graph.recordings.dispose();
    graph.columnVoice.dispose();
    graph.columnMechanics.dispose();
    for (const source of graph.sources) source.stop();
    graph.master.disconnect();
  };
  return {
    setFluorescent(level: number) {
      if (!graph) return;
      graph.fluorescent.gain.setTargetAtTime(
        0.03 * Math.max(0, Math.min(1, level)),
        graph.context.currentTime,
        0.12,
      );
    },
    setPlantPower(on: boolean) {
      plantPowered = on;
    },
    setRecirculator(on: boolean) {
      recirculatorWorking = on;
    },
    /** Whether each of the VX3's cabinets has power: each hums while it does. */
    setCabinetPower(a: boolean, b: boolean) {
      cabinetPower.a = a;
      cabinetPower.b = b;
    },
    setSprinklers(on: boolean) {
      sprinklersActive = on;
    },
    /** The fire alarm's sounders, while the panel is in alarm. */
    setFireAlarm(on: boolean) {
      fireAlarmActive = on;
      if (on) pendingAllClear = false;
      announcements?.setAlarm(on);
    },
    announceFireCancelled() {
      fireAlarmActive = false;
      pendingAllClear = !announcements;
      announcements?.cancel();
    },
    resetFireAnnouncements() {
      fireAlarmActive = false;
      pendingAllClear = false;
      announcements?.reset();
    },
    unlock,
    playComputerBoot,
    playCassetteButton,
    setTapeTransport,
    play,
    update,
    updateColumn,
    setMix,
    setSources,
    setTransmission,
    listen,
    setVisible,
    dispose,
  };
}
