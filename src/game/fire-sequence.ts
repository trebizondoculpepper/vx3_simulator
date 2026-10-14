/** Building fire sequence, measured from the alarm latching. */
export const SPRINKLER_DELAY = 3;
export const EVACUATION_DELAY = 6;
export const ALL_CLEAR_DELAY = 2;

/** Two red flashes per second; reduced motion holds the lens steadily lit. */
export function fireBeaconLit(
  alarm: boolean,
  seconds: number,
  reducedMotion: boolean,
) {
  return alarm && (reducedMotion || seconds % 0.5 < 0.16);
}
