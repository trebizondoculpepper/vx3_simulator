export type TapeMode = 'play' | 'stop' | 'fast-forward';
export interface TapeTrack {
  title: string;
  url: string;
  loopStartSeconds: number;
  loopEndSeconds: number;
}
export const tapeSpeed = (mode: TapeMode) =>
  mode === 'stop' ? 0 : mode === 'fast-forward' ? 5 : 1;
export const tapeVolume = (mode: TapeMode) =>
  mode === 'stop' ? 0 : mode === 'fast-forward' ? 0.25 : 1;

/** One cassette, progressing through all tracks and repeating at its end. */
export function createTapeTransport(tracks: readonly TapeTrack[]) {
  if (
    !tracks.length ||
    tracks.some((track) => track.loopEndSeconds <= track.loopStartSeconds)
  )
    throw new Error('Tape has no playable tracks');
  let mode: TapeMode = 'stop';
  let index = 0;
  let position = 0;
  return {
    get mode() {
      return mode;
    },
    get index() {
      return index;
    },
    get position() {
      return position;
    },
    get track() {
      return tracks[index];
    },
    press(next: TapeMode) {
      mode = next;
    },
    advance(seconds: number) {
      position += Math.max(0, seconds) * tapeSpeed(mode);
      while (
        position >=
        tracks[index].loopEndSeconds - tracks[index].loopStartSeconds
      ) {
        position -=
          tracks[index].loopEndSeconds - tracks[index].loopStartSeconds;
        index = (index + 1) % tracks.length;
      }
    },
  };
}
