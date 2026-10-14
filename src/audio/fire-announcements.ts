import { ALL_CLEAR_DELAY, EVACUATION_DELAY } from '../game/fire-sequence';
/** Rendered German PA speech, independent of the tonal alarm's loop. */
export function createFireAnnouncements(
  context: AudioContext,
  output: AudioNode,
) {
  type Message = 'evacuate' | 'cancelled';
  const urls = {
    evacuate: new URL('./assets/fire-evacuate-de.mp3', import.meta.url),
    cancelled: new URL('./assets/fire-cancelled-de.mp3', import.meta.url),
  };
  const buffers = new Map<Message, Promise<AudioBuffer>>();
  const load = (message: Message) => {
    let buffer = buffers.get(message);
    if (!buffer) {
      buffer = fetch(urls[message]).then(async (response) => {
        if (!response.ok)
          throw new Error(`Fire announcement unavailable: ${message}`);
        return context.decodeAudioData(await response.arrayBuffer());
      });
      buffers.set(message, buffer);
      void buffer.catch(() => buffers.delete(message));
    }
    return buffer;
  };
  let alarm = false;
  let queued: Message | null = null;
  let source: AudioBufferSourceNode | null = null;
  let loading = false;
  let generation = 0;
  let nextAt = 0;
  let disposed = false;
  const stop = () => {
    generation++;
    loading = false;
    source?.stop();
    source = null;
    queued = null;
  };
  const update = () => {
    if (disposed || context.state !== 'running' || source || loading) return;
    if (!queued && alarm && context.currentTime >= nextAt) queued = 'evacuate';
    if (!queued || context.currentTime < nextAt) return;
    const message = queued;
    queued = null;
    const own = ++generation;
    loading = true;
    void load(message)
      .then((buffer) => {
        if (disposed || own !== generation) return;
        loading = false;
        if (context.state !== 'running') {
          queued = message;
          return;
        }
        const voice = context.createBufferSource();
        voice.buffer = buffer;
        const level = context.createGain();
        level.gain.value = 0.65;
        voice.connect(level).connect(output);
        source = voice;
        voice.onended = () => {
          if (source === voice) source = null;
          voice.disconnect();
          level.disconnect();
        };
        nextAt = context.currentTime + buffer.duration + 20;
        voice.start();
      })
      .catch((error) => {
        if (own !== generation) return;
        loading = false;
        nextAt = context.currentTime + 20;
        console.warn('Fire PA announcement could not play.', error);
      });
  };
  return {
    setAlarm(on: boolean) {
      if (alarm === on) return;
      alarm = on;
      stop();
      if (on) {
        queued = 'evacuate';
        nextAt = context.currentTime + EVACUATION_DELAY;
      }
      update();
    },
    cancel() {
      alarm = false;
      stop();
      queued = 'cancelled';
      nextAt = context.currentTime + ALL_CLEAR_DELAY;
      update();
    },
    reset() {
      alarm = false;
      stop();
    },
    get speaking() {
      return source !== null;
    },
    update,
    preload() {
      return Promise.all([load('evacuate'), load('cancelled')]);
    },
    dispose() {
      disposed = true;
      stop();
    },
  };
}
