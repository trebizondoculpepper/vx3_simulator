/**
 * Distance and direction for sounds that come from somewhere in the lab.
 *
 * Sound intensity falls with the inverse square of distance, so amplitude,
 * which is what a GainNode scales, falls as 1/d: twice as far away is a
 * quarter of the power and 6 dB quieter.
 *
 * Distances change only when the listener moves, so gains are cached and
 * recomputed only once the listener has moved a little way; turning on the
 * spot only changes the stereo pan. Emitters are bucketed in a grid of
 * cells as wide as the audible radius, so a move visits only the 27 cells
 * around the listener rather than every emitter in the building.
 */

export interface Emitter {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface SpatialOptions {
  /** Distance at which an emitter plays at its own level. */
  reference: number;
  /** Beyond this an emitter is silent and is not visited. */
  cutoff: number;
  /** The most an emitter is boosted when the listener is right against it. */
  maxGain: number;
  /** How far the listener must move before distances are recomputed. */
  moveThreshold: number;
}

/** Amplitude gain at a distance, under the inverse-square law. */
export function inverseSquareGain(
  distance: number,
  reference: number,
  maxGain: number,
) {
  return Math.min(maxGain, reference / Math.max(distance, 1e-6));
}

export function createSpatialMix(
  emitters: readonly Emitter[],
  options: SpatialOptions,
) {
  const { reference, cutoff, maxGain, moveThreshold } = options;
  const cellOf = (value: number) => Math.floor(value / cutoff);
  const cellKey = (i: number, j: number, k: number) => `${i},${j},${k}`;
  const cells = new Map<string, number[]>();
  emitters.forEach((emitter, index) => {
    const key = cellKey(
      cellOf(emitter.x),
      cellOf(emitter.y),
      cellOf(emitter.z),
    );
    const cell = cells.get(key);
    if (cell) cell.push(index);
    else cells.set(key, [index]);
  });
  const indexOf = new Map(emitters.map((emitter, i) => [emitter.id, i]));

  const gains = new Float32Array(emitters.length);
  const pans = new Float32Array(emitters.length);
  // Unit bearing from the listener to each audible emitter on the floor plan.
  const bearings = new Float32Array(emitters.length * 2);
  let audible: number[] = [];
  let listener: { x: number; y: number; z: number } | null = null;
  let yaw = Number.NaN;

  return {
    /**
     * Place the listener. Returns false, doing nothing, if they have not
     * moved far enough since the last recalculation to matter.
     */
    move(x: number, y: number, z: number) {
      if (
        listener &&
        Math.hypot(x - listener.x, y - listener.y, z - listener.z) <
          moveThreshold
      )
        return false;
      listener = { x, y, z };
      for (const index of audible) gains[index] = 0;
      audible = [];
      const ci = cellOf(x);
      const cj = cellOf(y);
      const ck = cellOf(z);
      for (let i = ci - 1; i <= ci + 1; i++)
        for (let j = cj - 1; j <= cj + 1; j++)
          for (let k = ck - 1; k <= ck + 1; k++)
            for (const index of cells.get(cellKey(i, j, k)) ?? []) {
              const emitter = emitters[index];
              const dx = emitter.x - x;
              const dz = emitter.z - z;
              const distance = Math.hypot(dx, emitter.y - y, dz);
              if (distance >= cutoff) continue;
              gains[index] = inverseSquareGain(distance, reference, maxGain);
              const flat = Math.hypot(dx, dz);
              bearings[index * 2] = flat > 1e-6 ? dx / flat : 0;
              bearings[index * 2 + 1] = flat > 1e-6 ? dz / flat : 0;
              audible.push(index);
            }
      yaw = Number.NaN;
      return true;
    },
    /**
     * Turn the listener. Facing (sin yaw, −cos yaw) on the floor plan, the
     * right ear points along (cos yaw, sin yaw). Returns false if unchanged.
     */
    face(nextYaw: number) {
      if (nextYaw === yaw) return false;
      yaw = nextYaw;
      const rightX = Math.cos(yaw);
      const rightZ = Math.sin(yaw);
      for (const index of audible)
        pans[index] =
          bearings[index * 2] * rightX + bearings[index * 2 + 1] * rightZ;
      return true;
    },
    /** Amplitude gain for an emitter, 0 when out of earshot or unknown. */
    gain(id: string) {
      const index = indexOf.get(id);
      return index === undefined ? 0 : gains[index];
    },
    /** Stereo pan for an emitter, −1 (left) to 1 (right). */
    pan(id: string) {
      const index = indexOf.get(id);
      return index === undefined ? 0 : pans[index];
    },
    /** How many emitters are within earshot. */
    audibleCount: () => audible.length,
  };
}

export type SpatialMix = ReturnType<typeof createSpatialMix>;
