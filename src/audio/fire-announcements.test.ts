import { afterEach, expect, it, vi } from 'vitest';
import { createFireAnnouncements } from './fire-announcements';

function fixture(decode?: () => Promise<AudioBuffer>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1),
    })),
  );
  const sources: Array<{
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
    buffer: AudioBuffer | null;
  }> = [];
  const node = () => ({
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  });
  const context = {
    currentTime: 0,
    state: 'running',
    decodeAudioData: decode ?? (async () => ({ duration: 10 }) as AudioBuffer),
    createGain: () => ({ ...node(), gain: { value: 0 } }),
    createBufferSource: () => {
      const source = {
        ...node(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
        buffer: null as AudioBuffer | null,
      };
      sources.push(source);
      return source;
    },
  };
  const player = createFireAnnouncements(
    context as unknown as AudioContext,
    {} as AudioNode,
  );
  return { player, context, sources };
}
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
afterEach(() => vi.unstubAllGlobals());

it('waits six seconds after alarm onset, repeats only after a gap and never overlaps itself', async () => {
  const { player, context, sources } = fixture();
  player.setAlarm(false);
  expect(sources).toHaveLength(0);
  player.setAlarm(true);
  context.currentTime = 5.99;
  player.update();
  await settle();
  expect(sources).toHaveLength(0);
  context.currentTime = 6;
  player.update();
  await settle();
  expect(sources).toHaveLength(1);
  for (let i = 0; i < 20; i++) player.setAlarm(true);
  context.currentTime = 45;
  player.update();
  expect(sources).toHaveLength(1);
  sources[0].onended?.();
  player.update();
  await settle();
  expect(sources).toHaveLength(2);
  player.dispose();
  expect(sources[1].stop).toHaveBeenCalledOnce();
});

it('cancellation interrupts evacuation and plays one all-clear with no further repeats', async () => {
  const { player, context, sources } = fixture();
  player.setAlarm(true);
  context.currentTime = 6;
  player.update();
  await settle();
  player.cancel();
  context.currentTime += 2;
  player.update();
  await settle();
  expect(sources[0].stop).toHaveBeenCalledOnce();
  expect(sources).toHaveLength(2);
  expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain(
    'fire-cancelled-de.mp3',
  );
  player.setAlarm(false);
  expect(sources[1].stop).not.toHaveBeenCalled();
  sources[1].onended?.();
  context.currentTime = 300;
  player.update();
  await settle();
  expect(sources).toHaveLength(2);
});

it('discards an in-flight evacuation when the simulation is reset', async () => {
  let resolve!: (buffer: AudioBuffer) => void;
  const decoded = new Promise<AudioBuffer>((done) => {
    resolve = done;
  });
  const { player, context, sources } = fixture(() => decoded);
  player.setAlarm(true);
  context.currentTime = 6;
  player.update();
  await settle();
  player.reset();
  resolve({ duration: 10 } as AudioBuffer);
  await settle();
  expect(sources).toHaveLength(0);
});

it('waits for the audio gesture before announcing an active alarm', async () => {
  const { player, context, sources } = fixture();
  context.state = 'suspended';
  player.setAlarm(true);
  context.currentTime = 6;
  player.update();
  await settle();
  expect(sources).toHaveLength(0);
  context.state = 'running';
  context.currentTime = 6;
  player.update();
  await settle();
  expect(sources).toHaveLength(1);
});

it('cancellation wins over an evacuation recording that is still decoding', async () => {
  let resolve!: (buffer: AudioBuffer) => void;
  const decoded = new Promise<AudioBuffer>((done) => {
    resolve = done;
  });
  const { player, context, sources } = fixture(() => decoded);
  player.setAlarm(true);
  context.currentTime = 6;
  player.update();
  await settle();
  player.cancel();
  context.currentTime += 2;
  player.update();
  await settle();
  resolve({ duration: 10 } as AudioBuffer);
  await settle();
  expect(sources).toHaveLength(1);
  expect(sources[0].start).toHaveBeenCalledOnce();
  expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain(
    'fire-cancelled-de.mp3',
  );
});

it('a new alarm supersedes an all-clear that is currently playing', async () => {
  const { player, context, sources } = fixture();
  player.cancel();
  context.currentTime += 2;
  player.update();
  await settle();
  player.setAlarm(true);
  context.currentTime = 8;
  player.update();
  await settle();
  expect(sources[0].stop).toHaveBeenCalledOnce();
  expect(sources).toHaveLength(2);
  expect(player.speaking).toBe(true);
  // A late end event from the old message must not un-duck the sounder.
  sources[0].onended?.();
  expect(player.speaking).toBe(true);
});

it('waits two seconds for all-clear and cancels the pending six-second evacuation', async () => {
  const { player, context, sources } = fixture();
  player.setAlarm(true);
  context.currentTime = 1;
  player.cancel();
  context.currentTime = 2.99;
  player.update();
  await settle();
  expect(sources).toHaveLength(0);
  context.currentTime = 3;
  player.update();
  await settle();
  expect(sources).toHaveLength(1);
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(
    'fire-cancelled-de.mp3',
  );
  sources[0].onended?.();
  context.currentTime = 100;
  player.update();
  await settle();
  expect(sources).toHaveLength(1);
});
