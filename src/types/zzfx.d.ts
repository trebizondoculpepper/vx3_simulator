// Type declarations for zzfx 1.4.0, which ships plain JavaScript.
// Parameter order: volume, randomness, frequency, attack, sustain, release,
// shape, shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime,
// noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo, filter.
declare module 'zzfx' {
  export type ZzfxParameters = (number | undefined)[];

  export function zzfx(...parameters: ZzfxParameters): AudioBufferSourceNode;

  export const ZZFX: {
    volume: number;
    sampleRate: number;
    /** Created when the module is imported; starts suspended until a user gesture. */
    audioContext: AudioContext;
    play(...parameters: ZzfxParameters): AudioBufferSourceNode;
    playSamples(
      sampleChannels: number[][],
      volumeScale?: number,
      rate?: number,
      pan?: number,
      loop?: boolean,
    ): AudioBufferSourceNode;
    buildSamples(...parameters: ZzfxParameters): number[];
    getNote(semitoneOffset?: number, rootNoteFrequency?: number): number;
  };

  /** A pre-built sound, cached once and replayed cheaply. */
  export class ZZFXSound {
    constructor(zzfxSound?: ZzfxParameters);
    play(
      volume?: number,
      pitch?: number,
      randomnessScale?: number,
      pan?: number,
      loop?: boolean,
    ): AudioBufferSourceNode | undefined;
  }
}
