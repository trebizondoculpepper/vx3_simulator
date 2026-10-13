/** Rapid visible arc pulses, with steady illumination for reduced motion. */
export function mercuryArcLight(
  on: boolean,
  seconds: number,
  reducedMotion: boolean,
) {
  if (!on) return 0;
  if (reducedMotion) return 1;
  return 0.04 + 0.96 * Math.max(0, Math.sin(seconds * Math.PI * 2 * 8)) ** 2;
}
