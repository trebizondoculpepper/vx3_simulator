/**
 * Geometric hallucinations: the kaleidoscopic patterns of a deep trip.
 *
 * A lattice of evolving geometry, mirrored into a kaleidoscope about the
 * middle of the view and flowing endlessly inwards, is worked into the
 * picture of the room: exclusive-or'd, and'd or colour-burnt into it, so
 * it reads as something done to the seeing, not a thing in the room. It is
 * worked into the room alone: the apparitions and the ghosts of perceptual
 * ghosting are laid over it untouched.
 *
 * Pure logic, no Three.js: the settings, the clock the pattern evolves by,
 * and the blends, which the shader in src/rendering/pattern-overlay.ts
 * repeats on the GPU. Colours here are 0 to 1, as the screen shows them.
 */

/** How the pattern is worked into the picture. */
export const PATTERN_MODES = ['XOR', 'AND', 'BURN'] as const;
export type PatternMode = (typeof PATTERN_MODES)[number];

/**
 * What the pattern is made of. LINES is a lattice of bright outlines; the
 * rest are tilings of solid, flat-coloured tiles that fit together
 * exactly: interlocking eight-pointed STARS; a HYPERBOLIC disc of
 * polygons shrinking for ever towards its rim; a five-fold QUASI-crystal
 * that never repeats and rearranges itself as it flows; living CELLS that
 * shift and stay fitted; and a TUNNEL of tiles falling into the middle.
 */
export const PATTERN_STYLES = [
  'LINES',
  'STARS',
  'HYPERBOLIC',
  'QUASI',
  'CELLS',
  'TUNNEL',
] as const;
export type PatternStyle = (typeof PATTERN_STYLES)[number];

export interface PatternSettings {
  /** How strongly the pattern is worked in: 0 none, 1 fully. */
  strength: number;
  /** Which blend: an index into PATTERN_MODES. */
  mode: number;
  /** What it is made of: an index into PATTERN_STYLES. */
  style: number;
  /**
   * The share of tiles showing at once. Waves pass through the tiling,
   * each tile coming and going in its turn; the rest leave the picture
   * alone.
   */
  cover: number;
  /** Mirrored segments of the kaleidoscope. */
  folds: number;
  /** How fine the geometry is: cells across the view. */
  scale: number;
  /** How fast the geometry evolves. */
  speed: number;
  /** How fast it flows inwards, into the middle of the view. */
  flow: number;
}

export function defaultPatternSettings(): PatternSettings {
  return {
    // Off until it is turned up.
    strength: 0,
    mode: 0,
    style: 1,
    cover: 0.5,
    folds: 8,
    scale: 3,
    speed: 0.3,
    flow: 0.25,
  };
}

export function patternMode(settings: PatternSettings): PatternMode {
  const i = Math.round(settings.mode);
  return PATTERN_MODES[Math.min(PATTERN_MODES.length - 1, Math.max(0, i))];
}

export function patternStyle(settings: PatternSettings): PatternStyle {
  const i = Math.round(settings.style);
  return PATTERN_STYLES[Math.min(PATTERN_STYLES.length - 1, Math.max(0, i))];
}

/** Each 0-to-1 colour channel as the byte the screen holds. */
const byte = (v: number) =>
  Math.min(255, Math.max(0, Math.round(Math.min(1, Math.max(0, v)) * 255)));

/**
 * One channel of the picture, `base`, with the pattern's `over` worked in
 * by `mode`, at full strength. The bitwise blends act on the screen's
 * bytes, as the old frame-buffer tricks did.
 */
export function blendChannel(mode: PatternMode, base: number, over: number) {
  switch (mode) {
    case 'XOR':
      return (byte(base) ^ byte(over)) / 255;
    case 'AND':
      return (byte(base) & byte(over)) / 255;
    case 'BURN':
      // Colour burn: the pattern darkens the picture, deepening its
      // colours, hardest where the pattern is dark.
      return over <= 0 ? 0 : Math.max(0, 1 - (1 - base) / over);
  }
}

/** The pattern's clocks: how far it has evolved and flowed. */
export function createPatterns(
  settings: PatternSettings = defaultPatternSettings(),
) {
  let evolved = 0;
  let flowed = 0;
  return {
    settings,
    get evolved() {
      return evolved;
    },
    get flowed() {
      return flowed;
    },
    /** Whether there is anything to draw. */
    get showing() {
      return settings.strength > 0;
    },
    step(seconds: number) {
      // The clocks run on while it is off, so turning it up never
      // restarts it from the same picture.
      evolved += settings.speed * seconds;
      flowed += settings.flow * seconds;
    },
  };
}

export type Patterns = ReturnType<typeof createPatterns>;
