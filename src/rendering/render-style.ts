import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  NeutralToneMapping,
  PCFSoftShadowMap,
  PMREMGenerator,
  WebGLRenderer,
} from 'three';
import type { Scene } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * How the game is drawn. `realistic` (the default) draws at the screen's
 * own resolution with antialiasing, smooth shading, physically based
 * materials lit by an environment map as well as the rooms' lights, soft
 * shadows and filmic tone mapping, so controls and their legends read
 * clearly. `ps1` is the original low-resolution look, with wobbling
 * vertices and dithered colour, kept for anyone who wants it:
 * `?render=ps1`.
 */
export type RenderStyle = 'realistic' | 'ps1';

const params =
  typeof location === 'undefined'
    ? new URLSearchParams()
    : new URLSearchParams(location.search);
const asked = params.get('render');
/**
 * Tuning knobs for trying the look: `?tone=neutral|agx|aces`,
 * `?exposure=1.1` and `?env=1` (a multiplier on each room's environment
 * light).
 */
const tone = params.get('tone') ?? 'neutral';
const exposure = Number(params.get('exposure') ?? 1.0);
const environmentScale = Number(params.get('env') ?? 1);

// dev0 is the realistic workshop; its former low-resolution toggle is retired.
export const renderStyle: RenderStyle =
  asked === 'ps1' && params.get('room') !== 'dev0' ? 'ps1' : 'realistic';
export const realistic = renderStyle === 'realistic';

/** The most pixels per CSS pixel drawn: sharp on a Retina screen, not wasteful. */
const MAX_PIXEL_RATIO = 2;

/** A renderer for a room, set up for the render style. */
export function createRenderer(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: realistic });
  if (realistic) {
    renderer.setPixelRatio(
      Math.min(globalThis.devicePixelRatio ?? 1, MAX_PIXEL_RATIO),
    );
    // Neutral keeps the panels' paint colours and contrast as painted.
    renderer.toneMapping =
      tone === 'aces'
        ? ACESFilmicToneMapping
        : tone === 'agx'
          ? AgXToneMapping
          : NeutralToneMapping;
    renderer.toneMappingExposure = exposure;
    renderer.shadowMap.type = PCFSoftShadowMap;
  } else renderer.setPixelRatio(1);
  return renderer;
}

/**
 * The share of a canvas's size to draw at: the PS1 style draws at most
 * 640 × 480 and lets the browser enlarge it; the realistic style draws at
 * full size.
 */
export function renderScale(width: number, height: number, ps1 = !realistic) {
  return ps1 ? Math.min(640 / width, 480 / height, 1) : 1;
}

/**
 * Light a scene's physically based materials with a neutral studio room,
 * as well as its own lights: soft fill from every side and something to
 * reflect, so chrome looks like chrome and a button's cap has a sheen.
 * `intensity` scales it; a dark room wants little. Nothing in the PS1
 * style. Returns a function that frees it.
 */
export function useEnvironment(
  renderer: WebGLRenderer,
  scene: Scene,
  intensity = 0.5,
) {
  if (!realistic) return () => {};
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const target = pmrem.fromScene(room, 0.04);
  scene.environment = target.texture;
  scene.environmentIntensity = intensity * environmentScale;
  room.dispose();
  pmrem.dispose();
  return () => {
    if (scene.environment === target.texture) scene.environment = null;
    target.dispose();
  };
}
