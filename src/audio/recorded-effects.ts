import { createVariantPicker } from '../game/sound-variants';

const assets = {
  key: [new URL('./assets/key-thock.wav', import.meta.url)],
  button: [new URL('./assets/button-press.wav', import.meta.url)],
  'toggle-up': [new URL('./assets/switch-click.wav', import.meta.url)],
  'toggle-down': [new URL('./assets/switch-click.wav', import.meta.url)],
  rocker: [new URL('./assets/rocker-click.wav', import.meta.url)],
  'bakelite-switch': [
    new URL('./assets/bakelite-heavy-switch.wav', import.meta.url),
  ],
  'ballast-start': [
    new URL('./assets/fluorescent-ballast-start.wav', import.meta.url),
  ],
  knob: [new URL('./assets/switch-click.wav', import.meta.url)],
  selector: [new URL('./assets/switch-click.wav', import.meta.url)],
  'breaker-on': [new URL('./assets/rocker-click.wav', import.meta.url)],
  'breaker-off': [new URL('./assets/rocker-click.wav', import.meta.url)],
  printer: [1, 2, 3, 4, 5].map(
    (i) => new URL(`./assets/printer-line-${i}.wav`, import.meta.url),
  ),
  'door-open': [new URL('./assets/door-open.wav', import.meta.url)],
  'door-close': [new URL('./assets/door-close.wav', import.meta.url)],
};
export type RecordedCue = keyof typeof assets;
export const isRecordedCue = (cue: string): cue is RecordedCue => cue in assets;
const levels: Record<RecordedCue, number> = {
  key: 0.09,
  button: 0.07,
  'toggle-up': 0.07,
  'toggle-down': 0.07,
  rocker: 0.08,
  'bakelite-switch': 0.22,
  'ballast-start': 0.09,
  knob: 0.025,
  selector: 0.06,
  'breaker-on': 0.12,
  'breaker-off': 0.12,
  printer: 0.035,
  'door-open': 0.03,
  'door-close': 0.03,
};

/** Short edited recordings on the same spatial/master mix as the apparatus. */
export function createRecordedEffects(
  context: BaseAudioContext,
  master: AudioNode,
) {
  const buffers = new Map<string, Promise<AudioBuffer>>();
  const pickPrinter = createVariantPicker(5);
  const active = new Set<AudioBufferSourceNode>();
  let printer: AudioBufferSourceNode | null = null;
  let printerRequest = 0;
  let disposed = false;
  const load = (url: URL) => {
    if (!buffers.has(url.href))
      buffers.set(
        url.href,
        fetch(url)
          .then((response) => {
            if (!response.ok) throw new Error(`Sound unavailable: ${url}`);
            return response.arrayBuffer();
          })
          .then((bytes) => context.decodeAudioData(bytes))
          .catch((error) => {
            buffers.delete(url.href);
            throw error;
          }),
      );
    return buffers.get(url.href)!;
  };
  return {
    async preload() {
      await Promise.all(Object.values(assets).flat().map(load));
    },
    async play(cue: RecordedCue, spatialGain: number, position: number) {
      const request = cue === 'printer' ? ++printerRequest : 0;
      const index = cue === 'printer' ? pickPrinter() : 0;
      try {
        const buffer = await load(assets[cue][index]);
        if (
          disposed ||
          context.state !== 'running' ||
          (cue === 'printer' && request !== printerRequest)
        )
          return;
        if (cue === 'printer') printer?.stop();
        const source = context.createBufferSource();
        const gain = context.createGain();
        const pan = context.createStereoPanner();
        source.buffer = buffer;
        gain.gain.value = levels[cue] * spatialGain;
        pan.pan.value = position;
        source.connect(gain).connect(pan).connect(master);
        active.add(source);
        if (cue === 'printer') printer = source;
        source.onended = () => {
          source.disconnect();
          gain.disconnect();
          pan.disconnect();
          active.delete(source);
          if (printer === source) printer = null;
        };
        source.start();
      } catch (error) {
        console.warn('Recorded apparatus sound could not play.', error);
      }
    },
    dispose() {
      disposed = true;
      printerRequest++;
      for (const source of active) source.stop();
      active.clear();
      buffers.clear();
    },
  };
}
