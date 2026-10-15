/**
 * The column's exhaust, and what it does to the people in the room.
 *
 * The VX3 has no interlocks: its drive starts whatever state the vessel
 * is in. A ferrocore run in a fouled atmosphere (oxygen left in the
 * chamber, xenon short of working pressure, the head unclamped) does not
 * bend the room's light and geometry as a clean core does. Its temporal
 * and electromagnetic disturbance goes into the gas instead, and that gas
 * is powerfully hallucinogenic. It reaches the room through the vacuum
 * pump's exhaust when the outlet is left open, through the seal when the
 * clamps are off (visibly, as smoke), and through the vessel wall as a
 * field when the chamber is fouled. A little fouling and a lot are the
 * same failure, by degree.
 *
 * The room holds the exhaust as a concentration (ppm) that clears slowly;
 * the operator takes it up as a dose that lingers longer still. The dose
 * climbs a ladder: ghosting, then apparitions at the edge of sight, then
 * geometric patterns.
 *
 * Pure functions, no DOM or Three.js.
 */
import {
  ACTIVATION,
  FULL_POWER,
  PURGE_COMPLETE_PERCENT,
  WORKING_PRESSURE,
} from './column-prep';

/** At and above this much oxygen, percent, the chamber is wholly fouled. */
export const FOUL_OXYGEN_PERCENT = 5;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ramp = (v: number, from: number, to: number) =>
  clamp01((v - from) / (to - from));

/**
 * How fouled the core's atmosphere is, 0 (clean) to 1: oxygen above a
 * finished purge, or xenon short of working pressure, whichever is worse.
 * An unsealed chamber is wholly fouled.
 */
export function fouling(sealed: boolean, oxygen: number, xenon: number) {
  if (!sealed) return 1;
  return Math.max(
    ramp(oxygen, PURGE_COMPLETE_PERCENT, FOUL_OXYGEN_PERCENT),
    ramp(WORKING_PRESSURE - xenon, 0, WORKING_PRESSURE),
  );
}

/**
 * How strongly the core is running, 0 to 1: nothing below activation, a
 * quarter as it lights, all of it at full power.
 */
export function glow(temperature: number) {
  if (temperature < ACTIVATION) return 0;
  return 0.25 + 0.75 * ramp(temperature, ACTIVATION, FULL_POWER);
}

export interface ExhaustSources {
  /** The core's glow (`glow`). */
  glow: number;
  /** The atmosphere's fouling (`fouling`). */
  fouling: number;
  /** The outlet is open: the pump exhausts the chamber into the lab. */
  outletOpen: boolean;
  /** The chamber is not sealed: gas escapes round the head. */
  unsealed: boolean;
}

/**
 * The hallucinogenic exhaust reaching the room, 0 to 1 of the most a core
 * can put out: a running core's disturbance, by the worst of its routes
 * out. A clean, sealed core with its outlet shut puts out none.
 */
export function emission(s: ExhaustSources) {
  return s.glow * Math.max(s.fouling, s.outletOpen ? 1 : 0, s.unsealed ? 1 : 0);
}

/** What the room settles to at full emission, ppm. */
export const FULL_EMISSION_PPM = 400;
/** How long the room takes to clear, seconds (its time constant). */
export const CLEAR_SECONDS = 60;
/** The dose is full at this concentration, ppm. */
export const FULL_DOSE_PPM = 250;
/** How fast the operator takes the exhaust up, and lets it go, seconds. */
export const UPTAKE_SECONDS = 12;
export const RELEASE_SECONDS = 150;
/** The ABGAS window lights above this, ppm. */
export const ALARM_PPM = 40;

export interface ExhaustState {
  /** The room's exhaust concentration, ppm. */
  room: number;
  /** The operator's dose, 0 to 1. */
  dose: number;
}

export function createExhaust(): ExhaustState {
  return { room: 0, dose: 0 };
}

/** Advance the room and the operator `dt` seconds at `emitting` (0 to 1). */
export function stepExhaust(state: ExhaustState, emitting: number, dt: number) {
  const k = Math.min(1, dt / CLEAR_SECONDS);
  state.room += (emitting * FULL_EMISSION_PPM - state.room) * k;
  const target = clamp01(state.room / FULL_DOSE_PPM);
  const lag = target > state.dose ? UPTAKE_SECONDS : RELEASE_SECONDS;
  state.dose += (target - state.dose) * Math.min(1, dt / lag);
}

/**
 * What a dose does, each 0 to 1: ghosting first, then apparitions, then
 * the geometric patterns, each coming in as the one before is well set.
 */
export function doseEffects(dose: number) {
  return {
    ghosting: ramp(dose, 0.08, 0.3),
    apparitions: ramp(dose, 0.3, 0.6),
    patterns: ramp(dose, 0.55, 0.9),
  };
}
