/**
 * Perceptual ghosting: echoes of what was just seen, left on the eye.
 *
 * While the viewer holds still for a moment, the view is taken as a
 * snapshot. When they move again, that snapshot stays where it was on the
 * screen, an echo laid over the moving view, and fades, blurring as it
 * goes, a memory becoming indistinct. Each stillness
 * makes one; a restless viewer trails several. Nothing in the room is
 * wrong; only the seeing is.
 *
 * Pure logic, no Three.js: it decides when to take a snapshot and which
 * snapshots are showing, and how strongly. The renderer keeps the images,
 * one per snapshot id. Angles are radians, distances metres.
 */

export interface GhostingSettings {
  /** Seconds the view must hold still before it is taken. */
  stillSeconds: number;
  /** How fast a turn, in degrees a second, counts as moving. */
  moveDegrees: number;
  /** How strongly a ghost first shows: 0 none, 1 as solid as the view. */
  strength: number;
  /** Seconds a ghost takes to fade away. */
  fadeSeconds: number;
  /** How fast a ghost swells while it fades, as a share of the screen a second. */
  drift: number;
  /**
   * How indistinct a ghost has grown by the time it has faded: the spread
   * of its Gaussian blur, as a share of the screen's height.
   */
  blur: number;
  /** At most this many ghosts at once; the oldest goes first. */
  most: number;
}

export function defaultGhostingSettings(): GhostingSettings {
  return {
    stillSeconds: 0.35,
    moveDegrees: 12,
    // Off until it is turned up.
    strength: 0,
    fadeSeconds: 1.8,
    drift: 0.02,
    blur: 0.02,
    most: 3,
  };
}

/** Walking faster than this, metres a second, counts as moving too. */
const WALKING = 0.3;

/** Where the viewer is and how they look. */
export interface Pose {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface Ghost {
  /** The snapshot it shows. */
  snapshot: number;
  /** How strongly it shows now, 0 to 1. */
  opacity: number;
  /** How much larger than the screen it has grown. */
  scale: number;
  /** Its blur now, as a share of the screen's height. */
  blur: number;
  /** Seconds since it was let go. */
  age: number;
}

const turned = (a: number, b: number) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
};

export function createGhosting(
  settings: GhostingSettings = defaultGhostingSettings(),
) {
  let last: Pose | null = null;
  let still = 0;
  /** The snapshot of the present stillness, waiting to be let go. */
  let held: number | null = null;
  let next = 1;
  const ghosts: Ghost[] = [];
  return {
    settings,
    ghosts,
    /** The snapshot waiting to become a ghost, if any. */
    get held() {
      return held;
    },
    /**
     * Advance `seconds` with the viewer at `pose`. Returns the id of a
     * snapshot to take of this frame, if one is due, and of the ghost let
     * go this step, if any.
     */
    step(
      seconds: number,
      pose: Pose,
    ): { take: number | null; released: number | null } {
      let take: number | null = null;
      let released: number | null = null;
      const moving =
        last !== null &&
        seconds > 0 &&
        ((turned(pose.yaw, last.yaw) + turned(pose.pitch, last.pitch)) /
          seconds >
          (settings.moveDegrees * Math.PI) / 180 ||
          Math.hypot(pose.x - last.x, pose.z - last.z) / seconds > WALKING);
      last = { ...pose };
      if (moving) {
        still = 0;
        if (held !== null && settings.strength > 0) {
          ghosts.push({
            snapshot: held,
            opacity: Math.min(1, settings.strength),
            scale: 1,
            blur: 0,
            age: 0,
          });
          released = held;
          while (ghosts.length > Math.max(1, Math.round(settings.most)))
            ghosts.shift();
        }
        held = null;
      } else {
        still += seconds;
        if (held === null && still >= settings.stillSeconds) {
          held = next++;
          take = held;
        }
      }
      for (const ghost of ghosts) {
        if (ghost.snapshot === released) continue;
        ghost.age += seconds;
        ghost.opacity -=
          (Math.min(1, settings.strength) * seconds) /
          Math.max(0.05, settings.fadeSeconds);
        ghost.scale += settings.drift * seconds;
        // A memory loses its detail sooner than its presence: the blur
        // comes on quickly at first, then more slowly as the ghost goes.
        ghost.blur =
          settings.blur *
          Math.sqrt(
            Math.min(1, ghost.age / Math.max(0.05, settings.fadeSeconds)),
          );
      }
      for (let i = ghosts.length - 1; i >= 0; i--)
        if (ghosts[i].opacity <= 0) ghosts.splice(i, 1);
      return { take, released };
    },
    /** The snapshots still needed: those showing, and the one held. */
    inUse(): Set<number> {
      const used = new Set(ghosts.map((ghost) => ghost.snapshot));
      if (held !== null) used.add(held);
      return used;
    },
    clear() {
      ghosts.length = 0;
      held = null;
      still = 0;
    },
  };
}

export type Ghosting = ReturnType<typeof createGhosting>;
