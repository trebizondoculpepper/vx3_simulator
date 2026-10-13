import type { ZZFXSound } from 'zzfx';

/** Cached pin-head rasp, carriage motor and a short tractor-feed rattle. */
export function createPrinterSound(
  library: typeof import('zzfx'),
): Pick<ZZFXSound, 'play'> {
  const pins = library.ZZFX.buildSamples(
    0.32,
    0,
    1850,
    0.002,
    0.14,
    0.022,
    5,
    0.7,
    0,
    0,
    160,
    0.004,
    0.009,
    0.35,
    0,
    0,
    0,
    1,
    0,
    0.8,
  );
  const motor = library.ZZFX.buildSamples(
    0.07,
    0,
    330,
    0.004,
    0.14,
    0.026,
    2,
    1,
    95,
  );
  const feed = library.ZZFX.buildSamples(
    0.1,
    0,
    120,
    0,
    0.025,
    0.035,
    4,
    1,
    -35,
  );
  const feedStart = Math.round(library.ZZFX.sampleRate * 0.13);
  const count = Math.max(pins.length, motor.length, feed.length + feedStart);
  const samples = Array.from(
    { length: count },
    (_, i) => (pins[i] ?? 0) + (motor[i] ?? 0) + (feed[i - feedStart] ?? 0),
  );
  return {
    play(volume = 1, pitch = 1, randomnessScale = 1, pan = 0, loop = false) {
      const rate = pitch * (1 + (Math.random() - 0.5) * 0.03 * randomnessScale);
      return library.ZZFX.playSamples([samples], volume, rate, pan, loop);
    },
  };
}
