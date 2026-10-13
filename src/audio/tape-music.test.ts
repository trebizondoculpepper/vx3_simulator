import { afterEach, expect, it, vi } from 'vitest';
import { createTapeMusic } from './tape-music';

class Node {
  gain = { value: 0, setTargetAtTime: vi.fn() };
  pan = { value: 0, setTargetAtTime: vi.fn() };
  playbackRate = { value: 1 };
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  connect(node: Node) {
    return node;
  }
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
afterEach(() => vi.unstubAllGlobals());

it('changes the audible source speed and gain, and resumes the saved position after Stop', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    })),
  );
  const sources: Node[] = [];
  const gains: Node[] = [];
  const context = {
    currentTime: 0,
    createGain: () => {
      const node = new Node();
      gains.push(node);
      return node;
    },
    createStereoPanner: () => new Node(),
    createBufferSource: () => {
      const node = new Node();
      sources.push(node);
      return node;
    },
    decodeAudioData: async () => ({ duration: 10.5 }),
  };
  const tracks = ['one', 'two'].map((title) => ({
    title,
    url: title,
    loopStartSeconds: 0.25,
    loopEndSeconds: 10.25,
  }));
  const music = createTapeMusic(
    context as unknown as AudioContext,
    new Node() as unknown as AudioNode,
    tracks,
    () => ({ gain: 1, pan: -0.2 }),
  );
  music.press('play');
  await vi.waitFor(() => expect(sources).toHaveLength(1));
  expect(sources[0].start).toHaveBeenCalledWith(0, 0.25, 10);
  music.press('fast-forward');
  expect(sources[0].playbackRate.value).toBe(5);
  expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(
    0.125,
    0,
    0.03,
  );
  context.currentTime = 1;
  music.press('stop');
  expect(music.tape.position).toBe(5);
  expect(sources[0].stop).toHaveBeenCalledOnce();
  context.currentTime = 50;
  music.press('play');
  await vi.waitFor(() => expect(sources).toHaveLength(2));
  expect(sources[1].start).toHaveBeenCalledWith(0, 5.25, 5);
  expect(sources[1].playbackRate.value).toBe(1);
  sources[1].onended?.();
  await vi.waitFor(() => expect(sources).toHaveLength(3));
  expect(music.tape.index).toBe(1);
  expect(sources[2].start.mock.calls[0][1]).toBeCloseTo(0.25);
  music.dispose();
  expect(sources[2].stop).toHaveBeenCalledOnce();
});
