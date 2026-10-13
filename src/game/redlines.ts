/** Physical operating limits and the full scale printed on each instrument. */
export const REDLINES = {
  spindle: { limit: 0.85, fullScale: 1, device: 'Encabulator drive' },
  field: { limit: 0.85, fullScale: 1, device: 'H-B coil pair' },
  load: { limit: 6.5, fullScale: 8, device: 'Betaform amplifier' },
} as const;

export type RedlineChannel = keyof typeof REDLINES;

export function redlineFraction(channel: RedlineChannel): number {
  const { limit, fullScale } = REDLINES[channel];
  return limit / fullScale;
}

/** Share of the available space above the redline that a reading occupies. */
export function redlineOverrun(
  channel: RedlineChannel,
  reading: number,
): number {
  const { limit, fullScale } = REDLINES[channel];
  return Math.max(0, Math.min(1, (reading - limit) / (fullScale - limit)));
}
