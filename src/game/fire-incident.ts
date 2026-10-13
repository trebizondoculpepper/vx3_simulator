import type { OverheatState } from './overheat';
import type { RedlineChannel } from './redlines';

export type FireEvent =
  | 'alarm'
  | 'water'
  | 'water-stopped'
  | 'fire'
  | 'extinguished'
  | 'ruined-fire'
  | 'ruined-short';
export type RuinCause = 'fire' | 'short' | null;

export interface FireIncident {
  exposure: number;
  alarm: boolean;
  alarmAge: number;
  water: boolean;
  waterAge: number;
  sprinklerSpent: boolean;
  liveWater: number;
  burning: Record<RedlineChannel, boolean>;
  burnTime: number;
  puddle: number;
  ruinCause: RuinCause;
  ruinAge: number;
}

const channels: RedlineChannel[] = ['spindle', 'field', 'load'];
export const DETECTOR_LEVEL = 0.25;
export const IGNITION_HEAT = 0.9;
export const SPRINKLER_RUN_SECONDS = 45;

export function createFireIncident(): FireIncident {
  return {
    exposure: 0,
    alarm: false,
    alarmAge: 0,
    water: false,
    waterAge: 0,
    sprinklerSpent: false,
    liveWater: 0,
    burning: { spindle: false, field: false, load: false },
    burnTime: 0,
    puddle: 0,
    ruinCause: null,
    ruinAge: 0,
  };
}

export function pressFireCall(state: FireIncident): boolean {
  if (state.alarm || state.ruinCause) return false;
  state.alarm = true;
  state.alarmAge = 0;
  return true;
}

export function resetFirePanel(state: FireIncident, smoke: number): boolean {
  if (
    state.ruinCause ||
    smoke >= DETECTOR_LEVEL ||
    channels.some((id) => state.burning[id])
  )
    return false;
  Object.assign(state, createFireIncident(), { puddle: state.puddle });
  return true;
}

/** Substeps preserve the short grace period after a backgrounded tab resumes. */
export function stepFireIncident(
  state: FireIncident,
  overheat: OverheatState,
  mains: boolean,
  seconds: number,
): FireEvent[] {
  const events: FireEvent[] = [];
  let remaining = Math.max(0, seconds);
  while (remaining > 0) {
    const dt = Math.min(0.05, remaining);
    remaining -= dt;
    if (state.water) {
      state.waterAge += dt;
      if (state.waterAge >= SPRINKLER_RUN_SECONDS) {
        state.water = false;
        state.sprinklerSpent = true;
        events.push('water-stopped');
      }
    }
    if (state.ruinCause) {
      state.ruinAge += dt;
      state.puddle = state.water
        ? Math.min(1, state.puddle + dt / 20)
        : Math.max(0, state.puddle - dt / 120);
      continue;
    }
    if (!state.alarm) {
      state.exposure =
        overheat.roomSmoke >= DETECTOR_LEVEL ? state.exposure + dt : 0;
      if (state.exposure >= 20) {
        state.alarm = true;
        state.alarmAge = 0;
        events.push('alarm');
      }
    } else {
      state.alarmAge += dt;
      if (!state.water && !state.sprinklerSpent && state.alarmAge >= 3) {
        state.water = true;
        state.waterAge = 0;
        events.push('water');
      }
    }
    for (const id of channels) {
      if (!state.burning[id] && mains && overheat.heat[id] >= IGNITION_HEAT) {
        state.burning[id] = true;
        events.push('fire');
      } else if (
        state.burning[id] &&
        !mains &&
        (state.water || overheat.heat[id] < IGNITION_HEAT)
      ) {
        state.burning[id] = false;
        events.push('extinguished');
      }
    }
    if (channels.some((id) => state.burning[id])) state.burnTime += dt;
    state.liveWater = state.water && mains ? state.liveWater + dt : 0;
    state.puddle = state.water
      ? Math.min(1, state.puddle + dt / 20)
      : Math.max(0, state.puddle - dt / 120);
    if (state.liveWater >= 5) {
      state.ruinCause = 'short';
      events.push('ruined-short');
    } else if (state.burnTime >= 45) {
      state.ruinCause = 'fire';
      events.push('ruined-fire');
    }
  }
  return events;
}
