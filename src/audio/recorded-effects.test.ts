import { afterEach, expect, it, vi } from 'vitest';
import { createRecordedEffects } from './recorded-effects';

class Node {
  buffer: AudioBuffer | null = null;
  gain = { value: 0 };
  pan = { value: 0 };
  onended: (() => void) | null = null;
  connect(node: Node) {
    return node;
  }
  start = vi.fn();
  stop = vi.fn();
  disconnect = vi.fn();
}
afterEach(() => vi.unstubAllGlobals());
it('plays five distinct quiet printer recordings through the spatial mix and suppresses hidden playback', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL) => ({
      ok: true,
      arrayBuffer: async () =>
        Uint8Array.of(Number(url.pathname.match(/printer-line-(\d)/)?.[1] ?? 0))
          .buffer,
    })),
  );
  const sources: Node[] = [],
    gains: Node[] = [],
    pans: Node[] = [];
  const context = {
    state: 'running',
    createGain: () => {
      const node = new Node();
      gains.push(node);
      return node;
    },
    createStereoPanner: () => {
      const node = new Node();
      pans.push(node);
      return node;
    },
    createBufferSource: () => {
      const node = new Node();
      sources.push(node);
      return node;
    },
    decodeAudioData: async (bytes: ArrayBuffer) => ({
      tag: new Uint8Array(bytes)[0],
    }),
  };
  const recordings = createRecordedEffects(
    context as unknown as AudioContext,
    new Node() as unknown as AudioNode,
  );
  await recordings.preload();
  for (let i = 0; i < 5; i++) {
    await recordings.play('printer', 0.5, -0.2);
    sources.at(-1)!.onended?.();
  }
  expect(
    new Set(
      sources.map(
        (source) => (source.buffer as unknown as { tag: number }).tag,
      ),
    ).size,
  ).toBe(5);
  for (const gain of gains) expect(gain.gain.value).toBeCloseTo(0.0175);
  for (const pan of pans) expect(pan.pan.value).toBe(-0.2);
  await recordings.play('door-open', 1, 0);
  expect(gains.at(-1)!.gain.value).toBe(0.03);
  context.state = 'suspended';
  await recordings.play('printer', 1, 0);
  expect(sources).toHaveLength(6);
  recordings.dispose();
});
