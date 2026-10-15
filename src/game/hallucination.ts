/**
 * The peripheral vision hallucination: figures that are there at the edge
 * of sight and gone when looked at.
 *
 * An apparition appears just outside the edge of the viewer's view, to the
 * left or the right, so it comes into sight as they turn. While it is out
 * of sight it waits, fully there. Once it is seen, close enough to the
 * middle of the view, it fades, and when it has faded it is gone. Looking
 * away does not bring it back. Nothing about it is ever seen head on for
 * long, which is the point: did you see it at all?
 *
 * Pure logic, no Three.js. Angles are radians, distances metres, yaw as the
 * walker's (0 faces −z, increasing to the right: facing (sin, −cos)).
 */

export interface HallucinationSettings {
  /** How often one appears, on average, per minute. */
  perMinute: number;
  /** Seconds a seen apparition takes to fade from solid to nothing. */
  fadeSeconds: number;
  /**
   * How directly it has to be looked at to count as seen: 0 anywhere in
   * view, 1 only at the very middle.
   */
  notice: number;
  /** Its height, metres. */
  size: number;
  /** At most this many at once. */
  most: number;
}

export function defaultHallucinationSettings(): HallucinationSettings {
  return { perMinute: 6, fadeSeconds: 1.6, notice: 0.35, size: 1.75, most: 3 };
}

export interface Apparition {
  id: number;
  /** Where it stands on the floor, metres. */
  x: number;
  z: number;
  /** 1 solid, 0 gone. */
  opacity: number;
  /** Whether it has been seen yet (it fades from then on, while seen). */
  seen: boolean;
}

/** Where the viewer stands and looks. */
export interface Viewer {
  x: number;
  z: number;
  yaw: number;
  /** Half the view's horizontal angle. */
  halfWidth: number;
}

/** How far it appears beyond the edge of the view, radians. */
const BEYOND = { least: 0.08, most: 0.55 };
/** How far away it appears, metres. */
const AWAY = { least: 2.2, most: 5 };
/** The narrowest "middle of the view" that counts as looking at it. */
const DEAD_CENTRE = 0.06;

/** The signed angle from the viewer's line of sight to a point. */
export function angleFromSight(viewer: Viewer, x: number, z: number) {
  const bearing = Math.atan2(x - viewer.x, -(z - viewer.z));
  let angle = bearing - viewer.yaw;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/** The widest angle from the line of sight at which it counts as seen. */
export function seenWithin(settings: HallucinationSettings, viewer: Viewer) {
  const notice = Math.min(1, Math.max(0, settings.notice));
  return DEAD_CENTRE + (viewer.halfWidth - DEAD_CENTRE) * (1 - notice);
}

export function createHallucinations(
  settings: HallucinationSettings = defaultHallucinationSettings(),
) {
  let next = 1;
  const apparitions: Apparition[] = [];
  /**
   * Make one now, just out of sight. `fits` says whether a floor point is
   * somewhere it could stand (inside the room, clear of furniture); a few
   * places are tried. Returns it, or null when none would do.
   */
  const summon = (
    viewer: Viewer,
    random: () => number,
    fits: (x: number, z: number) => boolean = () => true,
  ): Apparition | null => {
    if (apparitions.length >= settings.most) return null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const side = random() < 0.5 ? 1 : -1;
      const beyond = BEYOND.least + random() * (BEYOND.most - BEYOND.least);
      const angle = viewer.yaw + side * (viewer.halfWidth + beyond);
      const away = AWAY.least + random() * (AWAY.most - AWAY.least);
      const x = viewer.x + Math.sin(angle) * away;
      const z = viewer.z - Math.cos(angle) * away;
      if (!fits(x, z)) continue;
      const made = { id: next++, x, z, opacity: 1, seen: false };
      apparitions.push(made);
      return made;
    }
    return null;
  };
  return {
    settings,
    apparitions,
    summon,
    /**
     * Advance `seconds`: perhaps make a new one, fade those being looked
     * at, and remove those that have faded away. Returns any that appeared.
     */
    step(
      seconds: number,
      viewer: Viewer,
      random: () => number = Math.random,
      fits?: (x: number, z: number) => boolean,
    ): Apparition[] {
      const within = seenWithin(settings, viewer);
      for (const apparition of apparitions) {
        const looked =
          Math.abs(angleFromSight(viewer, apparition.x, apparition.z)) <=
          within;
        if (looked) apparition.seen = true;
        if (looked)
          apparition.opacity -= seconds / Math.max(0.05, settings.fadeSeconds);
      }
      for (let i = apparitions.length - 1; i >= 0; i--)
        if (apparitions[i].opacity <= 0) apparitions.splice(i, 1);
      // Appearances come at random, `perMinute` on average.
      const chance =
        1 - Math.exp((-Math.max(0, settings.perMinute) / 60) * seconds);
      if (random() < chance) {
        const made = summon(viewer, random, fits);
        if (made) return [made];
      }
      return [];
    },
    clear() {
      apparitions.length = 0;
    },
  };
}

export type Hallucinations = ReturnType<typeof createHallucinations>;
