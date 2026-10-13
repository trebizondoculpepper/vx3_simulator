import { redlineOverrun } from './redlines';
import type { RedlineChannel } from './redlines';

export type OverheatReadings = Record<RedlineChannel, number>;

export interface OverheatState {
  /** Normalised stored heat per device. */
  heat: Record<RedlineChannel, number>;
  /** Visible smoke output, 0 to 1, excluding the ashtray. */
  smoke: Record<RedlineChannel, number>;
  /** Smoke in the laboratory air, 0 to 1. */
  roomSmoke: number;
}

const channels: RedlineChannel[] = ['spindle', 'field', 'load'];
const SMOKE_START = 0.35;

export function createOverheatState(): OverheatState {
  return {
    heat: { spindle: 0, field: 0, load: 0 },
    smoke: { spindle: 0, field: 0, load: 0 },
    roomSmoke: 0,
  };
}

/** Advance the first thermal stage. Alarm and sprinkler timing will consume roomSmoke. */
export function stepOverheat(
  state: OverheatState,
  readings: OverheatReadings,
  seconds: number,
): RedlineChannel[] {
  const beganSmoking: RedlineChannel[] = [];
  const delta = Math.max(0, seconds);
  for (const channel of channels) {
    const overrun = redlineOverrun(channel, readings[channel]);
    const previous = state.smoke[channel];
    const change = overrun > 0 ? 0.012 + overrun * 0.035 : -0.025;
    state.heat[channel] = Math.max(
      0,
      Math.min(1, state.heat[channel] + change * delta),
    );
    state.smoke[channel] = Math.max(
      0,
      (state.heat[channel] - SMOKE_START) / (1 - SMOKE_START),
    );
    if (previous === 0 && state.smoke[channel] > 0) beganSmoking.push(channel);
  }
  const smokeOutput = channels.reduce(
    (sum, channel) => sum + state.smoke[channel],
    0,
  );
  state.roomSmoke = Math.max(
    0,
    Math.min(
      1,
      state.roomSmoke + (smokeOutput * 0.015 - state.roomSmoke * 0.03) * delta,
    ),
  );
  return beganSmoking;
}
