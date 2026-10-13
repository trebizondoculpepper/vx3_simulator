import {
  createTapeTransport,
  tapeSpeed,
  tapeVolume,
} from '../game/tape-transport';
import type { TapeMode, TapeTrack } from '../game/tape-transport';

/** Buffered playback keeps 5× tape speed audible, with its natural raised pitch. */
export function createTapeMusic(
  context: AudioContext,
  destination: AudioNode,
  tracks: readonly TapeTrack[],
  mix: () => { gain: number; pan: number },
) {
  const tape = createTapeTransport(tracks);
  const gain = context.createGain();
  const pan = context.createStereoPanner();
  gain.connect(pan).connect(destination);
  const buffers = new Map<number, Promise<AudioBuffer>>();
  let source: AudioBufferSourceNode | null = null;
  let last = context.currentTime;
  let sourceIndex = -1;
  let request = 0;
  let disposed = false;
  const load = (index: number) => {
    if (!buffers.has(index))
      buffers.set(
        index,
        fetch(tracks[index].url)
          .then((response) => {
            if (!response.ok)
              throw new Error(`Music unavailable: ${tracks[index].url}`);
            return response.arrayBuffer();
          })
          .then((bytes) => context.decodeAudioData(bytes))
          .catch((error) => {
            buffers.delete(index);
            throw error;
          }),
      );
    return buffers.get(index)!;
  };
  const stopSource = () => {
    request++;
    if (source) {
      source.onended = null;
      source.stop();
      source.disconnect();
      source = null;
    }
  };
  const start = async () => {
    const ownRequest = ++request;
    const index = tape.index;
    try {
      const buffer = await load(index);
      if (disposed || ownRequest !== request || tape.mode === 'stop') return;
      const next = context.createBufferSource();
      next.buffer = buffer;
      next.playbackRate.value = tapeSpeed(tape.mode);
      next.connect(gain);
      source = next;
      sourceIndex = index;
      last = context.currentTime;
      next.onended = () => {
        if (source !== next || disposed) return;
        next.disconnect();
        source = null;
        // Finish this track exactly, even if the last animation frame was early.
        tape.advance(
          (tape.track.loopEndSeconds -
            tape.track.loopStartSeconds -
            tape.position) /
            tapeSpeed(tape.mode) +
            1e-7,
        );
        void start();
      };
      const offset = tracks[index].loopStartSeconds + tape.position;
      next.start(
        0,
        offset,
        Math.min(buffer.duration, tracks[index].loopEndSeconds) - offset,
      );
      // Keep at most this track and its neighbour decoded (about 130 MB).
      const following = (index + 1) % tracks.length;
      for (const key of buffers.keys())
        if (key !== index && key !== following) buffers.delete(key);
      void load(following).catch((error) =>
        console.warn('Next cassette track could not load.', error),
      );
    } catch (error) {
      console.warn('Cassette music could not play.', error);
    }
  };
  const update = () => {
    if (disposed) return;
    const now = context.currentTime;
    if (source) {
      tape.advance(now - last);
      if (tape.index !== sourceIndex) {
        stopSource();
        void start();
      }
    }
    last = now;
    const spatial = mix();
    gain.gain.setTargetAtTime(
      0.5 * tapeVolume(tape.mode) * spatial.gain,
      now,
      0.03,
    );
    pan.pan.setTargetAtTime(spatial.pan, now, 0.03);
  };
  return {
    tape,
    update,
    press(mode: TapeMode) {
      update();
      tape.press(mode);
      if (mode === 'stop') stopSource();
      else if (source) source.playbackRate.value = tapeSpeed(mode);
      else void start();
      update();
    },
    dispose() {
      disposed = true;
      stopSource();
      buffers.clear();
      gain.disconnect();
      pan.disconnect();
    },
  };
}
