/** Approximate readings for this installation's mercury-arc supply panel. */
export function rectifierReadings(powered: boolean, loadKw: number) {
  if (!powered) return { inputVac: 0, outputVdc: 0, outputAdc: 0 };
  const load = Math.max(0, Math.min(8, loadKw));
  const outputVdc = 180 - load * 0.9;
  return {
    inputVac: 240,
    outputVdc,
    // A small holding current sustains the arc even before the VX3 takes load.
    outputAdc: 2 + (load * 1000) / outputVdc,
  };
}
