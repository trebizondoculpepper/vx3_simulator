import type { RackControls } from '../game/rack-controls';
import type { RigState } from '../game/rig';
import { writeSoundParameters } from './sound-parameters';
import type { SoundParameters } from './sound-parameters';
import type { ZZFXSound } from 'zzfx';

export type SoundCue =
  | 'toggle-up'
  | 'toggle-down'
  | 'knob'
  | 'selector'
  | 'button'
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
  | 'purge';

type SoundBank = Record<SoundCue, ZZFXSound>;

interface AudioGraph {
  context: AudioContext;
  master: GainNode;
  room: GainNode;
  hum: GainNode;
  heater: GainNode;
  spindle: GainNode;
  field: GainNode;
  strain: GainNode;
  spindleTone: OscillatorNode;
  rotorPulse: OscillatorNode;
  bearingFilter: BiquadFilterNode;
  fieldA: OscillatorNode;
  fieldB: OscillatorNode;
  strainTone: OscillatorNode;
  sources: Array<OscillatorNode | AudioBufferSourceNode>;
  sounds: SoundBank;
  setOneShotVolume: (volume: number) => void;
}

const parameters: SoundParameters = {
  roomGain: 0,
  humGain: 0,
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
  const gain = (pan: number) => {
    const node = context.createGain();
    node.gain.value = 0;
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    node.connect(panner).connect(master);
    return node;
  };
  const room = gain(-0.05);
  const hum = gain(0.1);
  const heater = gain(-0.2);
  const spindle = gain(-0.25);
  const field = gain(0.2);
  const strain = gain(0.15);
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
  oscillator('sine', 50, hum, 1);
  oscillator('sine', 100, hum, 0.28);
  oscillator('sine', 150, hum, 0.1);
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
  noise.start();
  sources.push(noise);

  // ZzFX parameter order: volume, variation, Hz, attack, sustain, release, shape, curve, slide, ...
  const sounds: SoundBank = {
    // Bat-handle switch snaps, with a slightly heavier downward return.
    'toggle-up': new library.ZZFXSound([
      0.34, 0.04, 550, 0, 0.014, 0.025, 4, 1.2, -220,
    ]),
    'toggle-down': new library.ZZFXSound([
      0.38, 0.04, 390, 0, 0.018, 0.03, 4, 1.3, -180,
    ]),
    // Fine detent and larger rotary ratchet.
    knob: new library.ZZFXSound([
      0.22, 0.03, 750, 0, 0.008, 0.018, 4, 1.1, -340,
    ]),
    selector: new library.ZZFXSound([
      0.35, 0.04, 300, 0, 0.03, 0.055, 4, 1.4, -120,
    ]),
    // Rubber mushroom button and low-pressure purge valve.
    button: new library.ZZFXSound([
      0.25, 0.04, 190, 0, 0.025, 0.07, 3, 1.3, -95,
    ]),
    purge: new library.ZZFXSound([
      0.16, 0.06, 480, 0.02, 0.17, 0.14, 4, 1, -180, 0, 0, 0, 0.72,
    ]),
    // Spring-loaded mains breaker and relay chatter.
    'breaker-on': new library.ZZFXSound([
      0.54, 0.03, 170, 0, 0.04, 0.08, 4, 1.4, -85,
    ]),
    'breaker-off': new library.ZZFXSound([
      0.48, 0.03, 130, 0, 0.05, 0.11, 4, 1.3, -65,
    ]),
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
  return {
    context,
    master,
    room,
    hum,
    heater,
    spindle,
    field,
    strain,
    spindleTone,
    rotorPulse,
    bearingFilter,
    fieldA,
    fieldB,
    strainTone,
    sources,
    sounds,
    setOneShotVolume: (volume) => {
      library.ZZFX.volume = volume;
    },
  };
}

export function createSoundEngine() {
  let graph: AudioGraph | null = null;
  let loading: Promise<void> | null = null;
  let disposed = false;
  let visible = true;
  let volume = 0.55;
  let muted = false;
  let nextCounter = 0;
  let nextSpark = 0;
  const pending: SoundCue[] = [];

  const setMix = (nextVolume: number, nextMuted: boolean) => {
    volume = Math.max(0, Math.min(1, nextVolume));
    muted = nextMuted;
    if (!graph) return;
    const level = muted ? 0 : volume;
    graph.master.gain.setTargetAtTime(level, graph.context.currentTime, 0.03);
    graph.setOneShotVolume(level * 0.16);
  };
  const playNow = (cue: SoundCue) => {
    if (!graph || muted || !visible || graph.context.state !== 'running')
      return;
    const pan =
      cue === 'paper' || cue === 'pencil' ? 0.4 : cue === 'spark' ? -0.35 : 0;
    graph.sounds[cue].play(1, 1, 1, pan);
  };
  const unlock = (): Promise<void> => {
    if (disposed || !visible) return Promise.resolve();
    if (loading) return loading;
    loading = (async () => {
      if (!graph) graph = createGraph(await import('zzfx'));
      setMix(volume, muted);
      if (graph.context.state === 'suspended') await graph.context.resume();
      while (pending.length) playNow(pending.shift()!);
    })()
      .catch((error: unknown) => {
        console.warn('VX3 audio could not start.', error);
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  };
  const play = (cue: SoundCue) => {
    if (muted || disposed || !visible) return;
    if (graph?.context.state === 'running') playNow(cue);
    else {
      pending.push(cue);
      void unlock();
    }
  };
  const update = (
    state: RigState,
    controls: RackControls,
    reducedMotion: boolean,
  ) => {
    if (!graph || !visible) return;
    const { context } = graph;
    writeSoundParameters(state, controls, parameters);
    const now = context.currentTime;
    ramp(graph.room.gain, parameters.roomGain, now);
    ramp(graph.hum.gain, parameters.humGain, now);
    ramp(graph.heater.gain, parameters.heaterGain, now);
    ramp(graph.spindle.gain, parameters.spindleGain, now);
    ramp(graph.field.gain, parameters.fieldGain, now);
    ramp(graph.strain.gain, parameters.strainGain, now);
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
  const setVisible = (nextVisible: boolean) => {
    visible = nextVisible;
    if (!graph) return;
    if (visible) void unlock();
    else void graph.context.suspend();
  };
  const dispose = () => {
    disposed = true;
    pending.length = 0;
    if (!graph) return;
    graph.master.gain.value = 0;
    for (const source of graph.sources) source.stop();
    graph.master.disconnect();
  };
  return { unlock, play, update, setMix, setVisible, dispose };
}
